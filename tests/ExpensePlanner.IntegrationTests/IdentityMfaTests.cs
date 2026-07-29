using System.Buffers.Binary;
using System.Globalization;
using System.Security.Cryptography;
using ExpensePlanner.Application.Abstractions;
using ExpensePlanner.Application.Common;
using ExpensePlanner.Application.Identity;
using ExpensePlanner.Infrastructure;
using ExpensePlanner.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Testcontainers.PostgreSql;
using Testcontainers.Redis;

namespace ExpensePlanner.IntegrationTests;

public sealed class IdentityMfaTests
{
    [Fact]
    public async Task Mfa_is_optional_at_setup_and_can_be_enabled_and_disabled_later()
    {
        if (!string.Equals(
                Environment.GetEnvironmentVariable("RUN_INTEGRATION_TESTS"),
                "true",
                StringComparison.OrdinalIgnoreCase))
        {
            return;
        }

        await using var postgres = new PostgreSqlBuilder()
            .WithImage("postgres:18-alpine")
            .Build();
        await using var redis = new RedisBuilder()
            .WithImage("redis:8.2-alpine")
            .Build();
        await Task.WhenAll(postgres.StartAsync(), redis.StartAsync());

        var plannerContext = new MutablePlannerContext();
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:expense-planner"] = postgres.GetConnectionString(),
                ["ConnectionStrings:cache"] = redis.GetConnectionString(),
            })
            .Build();
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddInfrastructure(configuration);
        services.AddSingleton<IPlannerContext>(plannerContext);

        await using var provider = services.BuildServiceProvider();
        await using var scope = provider.CreateAsyncScope();
        var database = scope.ServiceProvider.GetRequiredService<ExpensePlannerDbContext>();
        await database.Database.MigrateAsync();
        var identity = scope.ServiceProvider.GetRequiredService<IIdentityModule>();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();

        var registration = await identity.RegisterFirstOwnerAsync(
            "password-only@example.com",
            CancellationToken.None);
        await identity.PrepareSetupAsync(registration.SetupCode, CancellationToken.None);
        var completed = await identity.CompleteSetupAsync(
            registration.SetupCode,
            "a sufficiently long password",
            false,
            null,
            CancellationToken.None);

        Assert.False(completed.MfaEnabled);
        Assert.Empty(completed.RecoveryCodes);
        var owner = await users.FindByEmailAsync("password-only@example.com");
        Assert.NotNull(owner);
        plannerContext.Set(owner.Id, owner.PlannerId);
        Assert.False(owner.TwoFactorEnabled);
        Assert.Equal(0, await users.CountRecoveryCodesAsync(owner));

        var passwordOnlyLogin = await identity.CheckPasswordAsync(
            owner.Email!,
            "a sufficiently long password",
            CancellationToken.None);
        Assert.False(passwordOnlyLogin.RequiresMfa);
        Assert.Null(passwordOnlyLogin.ChallengeId);
        Assert.NotNull(passwordOnlyLogin.Tokens);

        await Assert.ThrowsAsync<ForbiddenException>(() =>
            identity.PrepareMfaEnrollmentAsync(
                "wrong password",
                CancellationToken.None));
        var enrollment = await identity.PrepareMfaEnrollmentAsync(
            "a sufficiently long password",
            CancellationToken.None);
        await Assert.ThrowsAsync<ForbiddenException>(() =>
            identity.EnableMfaAsync(
                "invalid-challenge",
                "000000",
                CancellationToken.None));

        var authenticatorCode = GenerateAuthenticatorCode(enrollment.SharedKey);
        var enabled = await identity.EnableMfaAsync(
            enrollment.ChallengeId,
            authenticatorCode,
            CancellationToken.None);

        Assert.Equal(10, enabled.RecoveryCodes.Count);
        Assert.True((await identity.GetSecurityStatusAsync(CancellationToken.None)).MfaEnabled);
        var mfaLogin = await identity.CheckPasswordAsync(
            owner.Email!,
            "a sufficiently long password",
            CancellationToken.None);
        Assert.True(mfaLogin.RequiresMfa);
        Assert.NotNull(mfaLogin.ChallengeId);
        Assert.Null(mfaLogin.Tokens);
        var currentCode = GenerateAuthenticatorCode(enrollment.SharedKey);
        Assert.NotNull(await identity.VerifyMfaAsync(
            mfaLogin.ChallengeId!,
            currentCode,
            CancellationToken.None));

        var oldAuthenticatorKey = await users.GetAuthenticatorKeyAsync(owner);
        await Assert.ThrowsAsync<ForbiddenException>(() =>
            identity.DisableMfaAsync(
                "wrong password",
                enabled.RecoveryCodes.First(),
                CancellationToken.None));
        await identity.DisableMfaAsync(
            "a sufficiently long password",
            enabled.RecoveryCodes.First(),
            CancellationToken.None);

        Assert.False((await identity.GetSecurityStatusAsync(CancellationToken.None)).MfaEnabled);
        Assert.Equal(0, await users.CountRecoveryCodesAsync(owner));
        Assert.NotEqual(oldAuthenticatorKey, await users.GetAuthenticatorKeyAsync(owner));
        Assert.All(
            await database.RefreshTokens.Where(token => token.UserId == owner.Id).ToArrayAsync(),
            token => Assert.NotNull(token.RevokedAtUtc));

        var invitation = await identity.CreateInvitationAsync(
            "mfa-user@example.com",
            CancellationToken.None);
        var invitationSetup = await identity.PrepareSetupAsync(
            invitation.Code,
            CancellationToken.None);
        var invitedUser = await users.FindByEmailAsync("mfa-user@example.com");
        Assert.NotNull(invitedUser);
        var invitationCode = GenerateAuthenticatorCode(invitationSetup.SharedKey);
        var mfaSetup = await identity.CompleteSetupAsync(
            invitation.Code,
            "another sufficiently long password",
            true,
            invitationCode,
            CancellationToken.None);
        Assert.True(mfaSetup.MfaEnabled);
        Assert.Equal(10, mfaSetup.RecoveryCodes.Count);

        await redis.StopAsync();
        var loginWithoutRedis = await identity.CheckPasswordAsync(
            owner.Email!,
            "a sufficiently long password",
            CancellationToken.None);
        Assert.False(loginWithoutRedis.RequiresMfa);
        Assert.NotNull(loginWithoutRedis.Tokens);
    }

    private static string GenerateAuthenticatorCode(string sharedKey)
    {
        const string alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
        var normalized = sharedKey
            .Replace(" ", string.Empty, StringComparison.Ordinal)
            .TrimEnd('=')
            .ToUpperInvariant();
        var bytes = new List<byte>();
        var buffer = 0;
        var bits = 0;
        foreach (var character in normalized)
        {
            var value = alphabet.IndexOf(character, StringComparison.Ordinal);
            Assert.InRange(value, 0, 31);
            buffer = (buffer << 5) | value;
            bits += 5;
            if (bits < 8)
            {
                continue;
            }

            bits -= 8;
            bytes.Add((byte)(buffer >> bits));
            buffer &= (1 << bits) - 1;
        }

        Span<byte> counter = stackalloc byte[sizeof(long)];
        BinaryPrimitives.WriteInt64BigEndian(
            counter,
            DateTimeOffset.UtcNow.ToUnixTimeSeconds() / 30);
#pragma warning disable CA5350 // RFC 6238 / ASP.NET Identity authenticator tokens require HMAC-SHA1.
        var hash = HMACSHA1.HashData(bytes.ToArray(), counter);
#pragma warning restore CA5350
        var offset = hash[^1] & 0x0f;
        var binaryCode =
            ((hash[offset] & 0x7f) << 24) |
            ((hash[offset + 1] & 0xff) << 16) |
            ((hash[offset + 2] & 0xff) << 8) |
            (hash[offset + 3] & 0xff);
        return (binaryCode % 1_000_000).ToString("D6", CultureInfo.InvariantCulture);
    }

    private sealed class MutablePlannerContext : IPlannerContext
    {
        private Guid? _plannerId;
        private Guid? _userId;

        public Guid PlannerId =>
            _plannerId ?? throw new InvalidOperationException("No planner is authenticated.");

        public Guid UserId =>
            _userId ?? throw new InvalidOperationException("No user is authenticated.");

        public void Set(Guid userId, Guid plannerId)
        {
            _userId = userId;
            _plannerId = plannerId;
        }
    }
}
