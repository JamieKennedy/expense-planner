using ExpensePlanner.Application.Abstractions;
using ExpensePlanner.Application.Identity;
using ExpensePlanner.Infrastructure.Identity;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace ExpensePlanner.Api.Controllers;

[ApiController]
[Route("api/auth")]
public sealed class AuthController(
    IIdentityModule identityModule,
    IPlannerContext plannerContext,
    IWebHostEnvironment environment) : ControllerBase
{
    [AllowAnonymous]
    [HttpGet("registration")]
    public async Task<RegistrationAvailabilityResponse> RegistrationAvailability(
        CancellationToken cancellationToken) =>
        new(await identityModule.IsRegistrationOpenAsync(cancellationToken));

    [AllowAnonymous]
    [EnableRateLimiting("login")]
    [HttpPost("registration")]
    public async Task<FirstOwnerRegistrationResponse> RegisterFirstOwner(
        FirstOwnerRegistrationRequest request,
        CancellationToken cancellationToken)
    {
        var result = await identityModule.RegisterFirstOwnerAsync(
            request.Email,
            cancellationToken);
        return new FirstOwnerRegistrationResponse(result.SetupCode);
    }

    [HttpGet("session")]
    public ActionResult<SessionResponse> Session() =>
        new SessionResponse(
            plannerContext.UserId,
            plannerContext.PlannerId,
            User.FindFirst("email")?.Value ?? User.Identity?.Name ?? string.Empty);

    [AllowAnonymous]
    [EnableRateLimiting("login")]
    [HttpPost("login")]
    public async Task<LoginResponse> Login(
        LoginRequest request,
        CancellationToken cancellationToken)
    {
        var result = await identityModule.CheckPasswordAsync(
            request.Email,
            request.Password,
            cancellationToken);
        if (result.Tokens is not null)
        {
            SetCookies(result.Tokens);
        }

        return new LoginResponse(result.RequiresMfa, result.ChallengeId);
    }

    [AllowAnonymous]
    [EnableRateLimiting("login")]
    [HttpPost("mfa")]
    public async Task<ActionResult> VerifyMfa(
        MfaRequest request,
        CancellationToken cancellationToken)
    {
        SetCookies(await identityModule.VerifyMfaAsync(
            request.ChallengeId,
            request.Code,
            cancellationToken));
        return NoContent();
    }

    [AllowAnonymous]
    [HttpPost("refresh")]
    public async Task<ActionResult> Refresh(CancellationToken cancellationToken)
    {
        var refresh = Request.Cookies[AuthCookies.RefreshToken(SecureCookies)]
            ?? throw new Application.Common.ForbiddenException("The refresh cookie is missing.");
        SetCookies(await identityModule.RefreshAsync(refresh, cancellationToken));
        return NoContent();
    }

    [HttpPost("logout")]
    public async Task<ActionResult> Logout(CancellationToken cancellationToken)
    {
        await identityModule.RevokeAsync(
            Request.Cookies[AuthCookies.RefreshToken(SecureCookies)],
            cancellationToken);
        DeleteCookies();
        return NoContent();
    }

    [HttpPost("invitations")]
    public Task<InvitationResult> Invite(
        InvitationRequest request,
        CancellationToken cancellationToken) =>
        identityModule.CreateInvitationAsync(request.Email, cancellationToken);

    [AllowAnonymous]
    [HttpPost("setup/prepare")]
    public Task<MfaSetupResult> PrepareSetup(
        SetupCodeRequest request,
        CancellationToken cancellationToken) =>
        identityModule.PrepareSetupAsync(request.Code, cancellationToken);

    [AllowAnonymous]
    [HttpPost("setup/complete")]
    public async Task<ActionResult<SetupCompletionResponse>> CompleteSetup(
        CompleteSetupRequest request,
        CancellationToken cancellationToken)
    {
        var completed = await identityModule.CompleteSetupAsync(
            request.Code,
            request.Password,
            request.EnableMfa ?? true,
            request.TotpCode,
            cancellationToken);
        SetCookies(completed.Tokens);
        return new SetupCompletionResponse(
            completed.Email,
            completed.MfaEnabled,
            completed.RecoveryCodes);
    }

    [HttpGet("security")]
    public Task<SecurityStatus> SecurityStatus(
        CancellationToken cancellationToken) =>
        identityModule.GetSecurityStatusAsync(cancellationToken);

    [EnableRateLimiting("login")]
    [HttpPost("security/mfa/prepare")]
    public Task<MfaEnrollmentResult> PrepareMfaEnrollment(
        PrepareMfaEnrollmentRequest request,
        CancellationToken cancellationToken) =>
        identityModule.PrepareMfaEnrollmentAsync(
            request.Password,
            cancellationToken);

    [EnableRateLimiting("login")]
    [HttpPost("security/mfa/enable")]
    public async Task<MfaChangeResponse> EnableMfa(
        EnableMfaRequest request,
        CancellationToken cancellationToken)
    {
        var result = await identityModule.EnableMfaAsync(
            request.ChallengeId,
            request.Code,
            cancellationToken);
        DeleteCookies();
        return new MfaChangeResponse(true, result.RecoveryCodes);
    }

    [EnableRateLimiting("login")]
    [HttpPost("security/mfa/disable")]
    public async Task<MfaChangeResponse> DisableMfa(
        DisableMfaRequest request,
        CancellationToken cancellationToken)
    {
        await identityModule.DisableMfaAsync(
            request.Password,
            request.Code,
            cancellationToken);
        DeleteCookies();
        return new MfaChangeResponse(false, []);
    }

    private void SetCookies(TokenPair tokens)
    {
        var secure = SecureCookies;
        Response.Cookies.Append(AuthCookies.AccessToken(secure), tokens.AccessToken, new CookieOptions
        {
            HttpOnly = true,
            Secure = secure,
            SameSite = SameSiteMode.Strict,
            Path = "/",
            Expires = tokens.AccessTokenExpiresAt,
        });
        Response.Cookies.Append(AuthCookies.RefreshToken(secure), tokens.RefreshToken, new CookieOptions
        {
            HttpOnly = true,
            Secure = secure,
            SameSite = SameSiteMode.Strict,
            Path = "/api/auth",
            Expires = tokens.RefreshTokenExpiresAt,
        });
        Response.Cookies.Append(AuthCookies.CsrfToken, tokens.CsrfToken, new CookieOptions
        {
            HttpOnly = false,
            Secure = secure,
            SameSite = SameSiteMode.Strict,
            Path = "/",
            Expires = tokens.RefreshTokenExpiresAt,
        });
    }

    private void DeleteCookies()
    {
        Response.Cookies.Delete(
            AuthCookies.AccessToken(SecureCookies),
            new CookieOptions { Path = "/" });
        Response.Cookies.Delete(
            AuthCookies.RefreshToken(SecureCookies),
            new CookieOptions { Path = "/api/auth" });
        Response.Cookies.Delete(AuthCookies.CsrfToken, new CookieOptions { Path = "/" });
    }

    private bool SecureCookies => !environment.IsDevelopment();
}

public sealed record LoginRequest(string Email, string Password);
public sealed record LoginResponse(bool RequiresMfa, string? ChallengeId);
public sealed record RegistrationAvailabilityResponse(bool Available);
public sealed record FirstOwnerRegistrationRequest(string Email);
public sealed record FirstOwnerRegistrationResponse(string SetupCode);
public sealed record MfaRequest(string ChallengeId, string Code);
public sealed record InvitationRequest(string Email);
public sealed record SetupCodeRequest(string Code);
public sealed class CompleteSetupRequest
{
    public required string Code { get; init; }
    public required string Password { get; init; }
    public bool? EnableMfa { get; init; }
    public string? TotpCode { get; init; }
}
public sealed record SetupCompletionResponse(
    string Email,
    bool MfaEnabled,
    IReadOnlyCollection<string> RecoveryCodes);
public sealed record PrepareMfaEnrollmentRequest(string Password);
public sealed record EnableMfaRequest(string ChallengeId, string Code);
public sealed record DisableMfaRequest(string Password, string Code);
public sealed record MfaChangeResponse(
    bool MfaEnabled,
    IReadOnlyCollection<string> RecoveryCodes);
public sealed record SessionResponse(Guid UserId, Guid PlannerId, string Email);
