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
    IPlannerContext plannerContext) : ControllerBase
{
    [HttpGet("session")]
    public ActionResult<SessionResponse> Session() =>
        new SessionResponse(
            plannerContext.UserId,
            plannerContext.PlannerId,
            User.FindFirst("email")?.Value ?? User.Identity?.Name ?? string.Empty);

    [AllowAnonymous]
    [EnableRateLimiting("login")]
    [HttpPost("login")]
    public Task<PasswordLoginResult> Login(
        LoginRequest request,
        CancellationToken cancellationToken) =>
        identityModule.CheckPasswordAsync(request.Email, request.Password, cancellationToken);

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
        var refresh = Request.Cookies[AuthCookies.RefreshToken]
            ?? throw new Application.Common.ForbiddenException("The refresh cookie is missing.");
        SetCookies(await identityModule.RefreshAsync(refresh, cancellationToken));
        return NoContent();
    }

    [HttpPost("logout")]
    public async Task<ActionResult> Logout(CancellationToken cancellationToken)
    {
        await identityModule.RevokeAsync(Request.Cookies[AuthCookies.RefreshToken], cancellationToken);
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
            request.TotpCode,
            cancellationToken);
        SetCookies(completed.Tokens);
        return new SetupCompletionResponse(completed.Email, completed.RecoveryCodes);
    }

    private void SetCookies(TokenPair tokens)
    {
        var secure = !HttpContext.RequestServices.GetRequiredService<IWebHostEnvironment>().IsDevelopment();
        Response.Cookies.Append(AuthCookies.AccessToken, tokens.AccessToken, new CookieOptions
        {
            HttpOnly = true,
            Secure = secure,
            SameSite = SameSiteMode.Strict,
            Path = "/",
            Expires = tokens.AccessTokenExpiresAt,
        });
        Response.Cookies.Append(AuthCookies.RefreshToken, tokens.RefreshToken, new CookieOptions
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
        Response.Cookies.Delete(AuthCookies.AccessToken, new CookieOptions { Path = "/" });
        Response.Cookies.Delete(AuthCookies.RefreshToken, new CookieOptions { Path = "/api/auth" });
        Response.Cookies.Delete(AuthCookies.CsrfToken, new CookieOptions { Path = "/" });
    }
}

public sealed record LoginRequest(string Email, string Password);
public sealed record MfaRequest(string ChallengeId, string Code);
public sealed record InvitationRequest(string Email);
public sealed record SetupCodeRequest(string Code);
public sealed record CompleteSetupRequest(string Code, string Password, string TotpCode);
public sealed record SetupCompletionResponse(string Email, IReadOnlyCollection<string> RecoveryCodes);
public sealed record SessionResponse(Guid UserId, Guid PlannerId, string Email);
