using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;
using ExpensePlanner.Application.Abstractions;
using ExpensePlanner.Application.Common;
using ExpensePlanner.Application.Identity;
using ExpensePlanner.Domain.Planning;
using ExpensePlanner.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace ExpensePlanner.Infrastructure.Identity;

public sealed class IdentityModule(
    UserManager<ApplicationUser> userManager,
    ExpensePlannerDbContext dbContext,
    IDistributedCache cache,
    IPlannerContext plannerContext,
    SigningCredentials signingCredentials,
    IOptions<JwtOptions> options) : IIdentityModule, IIdentityAdministration
{
    private readonly JwtOptions _options = options.Value;

    public async Task<PasswordLoginResult> CheckPasswordAsync(
        string email,
        string password,
        CancellationToken cancellationToken)
    {
        var user = await userManager.FindByEmailAsync(email);
        if (user is null || !user.SetupComplete || await userManager.IsLockedOutAsync(user))
        {
            throw new ForbiddenException("Email or password is incorrect.");
        }

        if (!await userManager.CheckPasswordAsync(user, password))
        {
            await userManager.AccessFailedAsync(user);
            throw new ForbiddenException("Email or password is incorrect.");
        }

        await userManager.ResetAccessFailedCountAsync(user);
        var challengeId = RandomToken();
        await cache.SetStringAsync(
            $"mfa:{Hash(challengeId)}",
            JsonSerializer.Serialize(new MfaChallenge(user.Id, DateTimeOffset.UtcNow.AddMinutes(5))),
            new DistributedCacheEntryOptions { AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5) },
            cancellationToken);
        return new PasswordLoginResult(true, challengeId);
    }

    public async Task<TokenPair> VerifyMfaAsync(
        string challengeId,
        string code,
        CancellationToken cancellationToken)
    {
        var key = $"mfa:{Hash(challengeId)}";
        var value = await cache.GetStringAsync(key, cancellationToken);
        var challenge = value is null ? null : JsonSerializer.Deserialize<MfaChallenge>(value);
        if (challenge is null || challenge.ExpiresAtUtc <= DateTimeOffset.UtcNow)
        {
            throw new ForbiddenException("The MFA challenge is invalid or expired.");
        }

        var user = await userManager.FindByIdAsync(challenge.UserId.ToString());
        if (user is null)
        {
            throw new ForbiddenException("The MFA challenge is invalid.");
        }

        var valid = await userManager.VerifyTwoFactorTokenAsync(
            user,
            TokenOptions.DefaultAuthenticatorProvider,
            code.Replace(" ", string.Empty, StringComparison.Ordinal));
        if (!valid)
        {
            valid = (await userManager.RedeemTwoFactorRecoveryCodeAsync(user, code)).Succeeded;
        }

        if (!valid)
        {
            throw new ForbiddenException("The authenticator or recovery code is invalid.");
        }

        await cache.RemoveAsync(key, cancellationToken);
        return await IssueTokensAsync(user, null, cancellationToken);
    }

    public async Task<TokenPair> RefreshAsync(string refreshToken, CancellationToken cancellationToken)
    {
        var hash = Hash(refreshToken);
        var stored = await dbContext.RefreshTokens
            .Include(item => item.User)
            .SingleOrDefaultAsync(item => item.TokenHash == hash, cancellationToken)
            ?? throw new ForbiddenException("The refresh token is invalid.");

        if (stored.RevokedAtUtc is not null)
        {
            await RevokeFamilyAsync(stored.UserId, stored.FamilyId, cancellationToken);
            throw new ForbiddenException("Refresh token reuse was detected; the session has been revoked.");
        }

        var now = DateTimeOffset.UtcNow;
        if (stored.ExpiresAtUtc <= now || stored.FamilyExpiresAtUtc <= now || !stored.User.SetupComplete)
        {
            stored.RevokedAtUtc = now;
            await dbContext.SaveChangesAsync(cancellationToken);
            throw new ForbiddenException("The refresh token is expired.");
        }

        return await IssueTokensAsync(stored.User, stored, cancellationToken);
    }

    public async Task RevokeAsync(string? refreshToken, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(refreshToken))
        {
            return;
        }

        var hash = Hash(refreshToken);
        var stored = await dbContext.RefreshTokens.SingleOrDefaultAsync(
            item => item.TokenHash == hash,
            cancellationToken);
        if (stored is not null && stored.RevokedAtUtc is null)
        {
            stored.RevokedAtUtc = DateTimeOffset.UtcNow;
            await dbContext.SaveChangesAsync(cancellationToken);
        }
    }

    public async Task<InvitationResult> CreateInvitationAsync(
        string email,
        CancellationToken cancellationToken)
    {
        var normalizedEmail = email.Trim().ToLowerInvariant();
        if (await userManager.FindByEmailAsync(normalizedEmail) is not null)
        {
            throw new ConflictException("A user with this email already exists.");
        }

        var rawCode = RandomToken();
        var expires = DateTimeOffset.UtcNow.AddHours(24);
        dbContext.Invitations.Add(new InvitationEntity
        {
            InvitedByUserId = plannerContext.UserId,
            Email = normalizedEmail,
            CodeHash = Hash(rawCode),
            ExpiresAtUtc = expires,
        });
        await dbContext.SaveChangesAsync(cancellationToken);
        return new InvitationResult(normalizedEmail, rawCode, expires);
    }

    public async Task<MfaSetupResult> PrepareSetupAsync(
        string code,
        CancellationToken cancellationToken)
    {
        var user = await ResolveSetupUserAsync(code, cancellationToken);
        await userManager.ResetAuthenticatorKeyAsync(user);
        var sharedKey = await userManager.GetAuthenticatorKeyAsync(user)
            ?? throw new InvalidOperationException("Unable to create an authenticator key.");
        var issuer = UrlEncoder.Default.Encode("Expense Planner");
        var account = UrlEncoder.Default.Encode(user.Email ?? user.UserName ?? user.Id.ToString());
        var uri = $"otpauth://totp/{issuer}:{account}?secret={sharedKey}&issuer={issuer}&digits=6";
        return new MfaSetupResult(user.Email!, sharedKey, uri);
    }

    public async Task<SetupCompletionResult> CompleteSetupAsync(
        string code,
        string password,
        string totpCode,
        CancellationToken cancellationToken)
    {
        var user = await ResolveSetupUserAsync(code, cancellationToken);
        IdentityResult passwordResult;
        if (await userManager.HasPasswordAsync(user))
        {
            var remove = await userManager.RemovePasswordAsync(user);
            if (!remove.Succeeded)
            {
                throw new ConflictException(Errors(remove));
            }
        }

        passwordResult = await userManager.AddPasswordAsync(user, password);
        if (!passwordResult.Succeeded)
        {
            throw new ConflictException(Errors(passwordResult));
        }

        if (!await userManager.VerifyTwoFactorTokenAsync(
                user,
                TokenOptions.DefaultAuthenticatorProvider,
                totpCode.Replace(" ", string.Empty, StringComparison.Ordinal)))
        {
            await userManager.RemovePasswordAsync(user);
            throw new ForbiddenException("The authenticator code is invalid.");
        }

        user.SetupComplete = true;
        user.TwoFactorEnabled = true;
        await userManager.UpdateAsync(user);
        var recoveryCodes = (await userManager.GenerateNewTwoFactorRecoveryCodesAsync(user, 10))?.ToArray() ?? [];
        await MarkSetupCodeUsedAsync(code, cancellationToken);
        var tokens = await IssueTokensAsync(user, null, cancellationToken);
        return new SetupCompletionResult(user.Email!, recoveryCodes, tokens);
    }

    public async Task<string> BootstrapUserAsync(string email, CancellationToken cancellationToken)
    {
        if (await userManager.Users.AnyAsync(cancellationToken))
        {
            throw new ConflictException("Bootstrap is allowed only while no users exist.");
        }

        var user = await CreatePendingUserAsync(email, cancellationToken);
        return await CreateSetupTokenAsync(user.Id, "bootstrap", cancellationToken);
    }

    public async Task<string> ResetUserAsync(string email, CancellationToken cancellationToken)
    {
        var user = await userManager.FindByEmailAsync(email)
            ?? throw new NotFoundException("The user was not found.");
        user.SetupComplete = false;
        user.TwoFactorEnabled = false;
        await userManager.UpdateAsync(user);
        await userManager.ResetAuthenticatorKeyAsync(user);
        await RevokeAllAsync(user.Id, cancellationToken);
        return await CreateSetupTokenAsync(user.Id, "reset", cancellationToken);
    }

    private async Task<ApplicationUser> ResolveSetupUserAsync(
        string code,
        CancellationToken cancellationToken)
    {
        var hash = Hash(code);
        var now = DateTimeOffset.UtcNow;
        var setup = await dbContext.SetupTokens.SingleOrDefaultAsync(
            item => item.CodeHash == hash && item.UsedAtUtc == null && item.ExpiresAtUtc > now,
            cancellationToken);
        if (setup is not null)
        {
            return await userManager.FindByIdAsync(setup.UserId.ToString())
                ?? throw new NotFoundException("The setup user was not found.");
        }

        var invitation = await dbContext.Invitations.SingleOrDefaultAsync(
            item => item.CodeHash == hash && item.UsedAtUtc == null && item.ExpiresAtUtc > now,
            cancellationToken) ?? throw new ForbiddenException("The setup code is invalid or expired.");
        if (invitation.UserId is null)
        {
            var user = await CreatePendingUserAsync(invitation.Email, cancellationToken);
            invitation.UserId = user.Id;
            await dbContext.SaveChangesAsync(cancellationToken);
            return user;
        }

        return await userManager.FindByIdAsync(invitation.UserId.Value.ToString())
            ?? throw new NotFoundException("The invited user was not found.");
    }

    private async Task<ApplicationUser> CreatePendingUserAsync(
        string email,
        CancellationToken cancellationToken)
    {
        var normalized = email.Trim().ToLowerInvariant();
        if (await userManager.FindByEmailAsync(normalized) is not null)
        {
            throw new ConflictException("A user with this email already exists.");
        }

        var plannerId = Guid.NewGuid();
        dbContext.Planners.Add(new Planner(plannerId, $"{normalized}'s planner"));
        dbContext.Contributors.Add(new Contributor(plannerId, "Me"));
        await dbContext.SaveChangesAsync(cancellationToken);

        var user = new ApplicationUser
        {
            Id = Guid.NewGuid(),
            PlannerId = plannerId,
            Email = normalized,
            UserName = normalized,
            EmailConfirmed = true,
            SetupComplete = false,
        };
        var result = await userManager.CreateAsync(user);
        if (!result.Succeeded)
        {
            throw new ConflictException(Errors(result));
        }

        return user;
    }

    private async Task<string> CreateSetupTokenAsync(
        Guid userId,
        string purpose,
        CancellationToken cancellationToken)
    {
        var raw = RandomToken();
        dbContext.SetupTokens.Add(new SetupTokenEntity
        {
            UserId = userId,
            CodeHash = Hash(raw),
            Purpose = purpose,
            ExpiresAtUtc = DateTimeOffset.UtcNow.AddHours(1),
        });
        await dbContext.SaveChangesAsync(cancellationToken);
        return raw;
    }

    private async Task MarkSetupCodeUsedAsync(string code, CancellationToken cancellationToken)
    {
        var hash = Hash(code);
        var setup = await dbContext.SetupTokens.SingleOrDefaultAsync(
            item => item.CodeHash == hash,
            cancellationToken);
        if (setup is not null)
        {
            setup.UsedAtUtc = DateTimeOffset.UtcNow;
        }
        else
        {
            var invitation = await dbContext.Invitations.SingleAsync(
                item => item.CodeHash == hash,
                cancellationToken);
            invitation.UsedAtUtc = DateTimeOffset.UtcNow;
        }

        await dbContext.SaveChangesAsync(cancellationToken);
    }

    private async Task<TokenPair> IssueTokensAsync(
        ApplicationUser user,
        RefreshTokenEntity? replaced,
        CancellationToken cancellationToken)
    {
        var now = DateTimeOffset.UtcNow;
        var accessExpires = now.AddMinutes(15);
        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new Claim(JwtRegisteredClaimNames.Email, user.Email ?? string.Empty),
            new Claim("planner_id", user.PlannerId.ToString()),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
        };
        var descriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(claims),
            Issuer = _options.Issuer,
            Audience = _options.Audience,
            NotBefore = now.UtcDateTime,
            IssuedAt = now.UtcDateTime,
            Expires = accessExpires.UtcDateTime,
            SigningCredentials = signingCredentials,
        };
        var handler = new JwtSecurityTokenHandler();
        var access = handler.WriteToken(handler.CreateToken(descriptor));

        var rawRefresh = RandomToken();
        var refreshHash = Hash(rawRefresh);
        var familyId = replaced?.FamilyId ?? Guid.NewGuid();
        var familyExpires = replaced?.FamilyExpiresAtUtc ?? now.AddDays(90);
        var refreshExpires = now.AddDays(30) < familyExpires ? now.AddDays(30) : familyExpires;
        dbContext.RefreshTokens.Add(new RefreshTokenEntity
        {
            UserId = user.Id,
            FamilyId = familyId,
            TokenHash = refreshHash,
            ExpiresAtUtc = refreshExpires,
            FamilyExpiresAtUtc = familyExpires,
        });
        if (replaced is not null)
        {
            replaced.RevokedAtUtc = now;
            replaced.ReplacedByHash = refreshHash;
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        return new TokenPair(access, accessExpires, rawRefresh, refreshExpires, RandomToken());
    }

    private async Task RevokeFamilyAsync(Guid userId, Guid familyId, CancellationToken cancellationToken)
    {
        var tokens = await dbContext.RefreshTokens
            .Where(item => item.UserId == userId && item.FamilyId == familyId && item.RevokedAtUtc == null)
            .ToArrayAsync(cancellationToken);
        foreach (var token in tokens)
        {
            token.RevokedAtUtc = DateTimeOffset.UtcNow;
        }

        await dbContext.SaveChangesAsync(cancellationToken);
    }

    private async Task RevokeAllAsync(Guid userId, CancellationToken cancellationToken)
    {
        var tokens = await dbContext.RefreshTokens
            .Where(item => item.UserId == userId && item.RevokedAtUtc == null)
            .ToArrayAsync(cancellationToken);
        foreach (var token in tokens)
        {
            token.RevokedAtUtc = DateTimeOffset.UtcNow;
        }

        await dbContext.SaveChangesAsync(cancellationToken);
    }

    private static string RandomToken() =>
        Microsoft.AspNetCore.WebUtilities.WebEncoders.Base64UrlEncode(RandomNumberGenerator.GetBytes(32));

    private static string Hash(string value) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value))).ToLowerInvariant();

    private static string Errors(IdentityResult result) =>
        string.Join(" ", result.Errors.Select(error => error.Description));

    private sealed record MfaChallenge(Guid UserId, DateTimeOffset ExpiresAtUtc);
}
