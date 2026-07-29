namespace ExpensePlanner.Application.Identity;

public interface IIdentityModule
{
    Task<bool> IsRegistrationOpenAsync(CancellationToken cancellationToken);
    Task<FirstOwnerRegistrationResult> RegisterFirstOwnerAsync(
        string email,
        CancellationToken cancellationToken);

    Task<PasswordLoginResult> CheckPasswordAsync(
        string email,
        string password,
        CancellationToken cancellationToken);

    Task<TokenPair> VerifyMfaAsync(
        string challengeId,
        string code,
        CancellationToken cancellationToken);

    Task<SecurityStatus> GetSecurityStatusAsync(CancellationToken cancellationToken);
    Task<MfaEnrollmentResult> PrepareMfaEnrollmentAsync(
        string password,
        CancellationToken cancellationToken);
    Task<MfaChangeResult> EnableMfaAsync(
        string challengeId,
        string code,
        CancellationToken cancellationToken);
    Task DisableMfaAsync(
        string password,
        string code,
        CancellationToken cancellationToken);

    Task<TokenPair> RefreshAsync(string refreshToken, CancellationToken cancellationToken);
    Task RevokeAsync(string? refreshToken, CancellationToken cancellationToken);
    Task<InvitationResult> CreateInvitationAsync(string email, CancellationToken cancellationToken);
    Task<MfaSetupResult> PrepareSetupAsync(string code, CancellationToken cancellationToken);
    Task<SetupCompletionResult> CompleteSetupAsync(
        string code,
        string password,
        bool enableMfa,
        string? totpCode,
        CancellationToken cancellationToken);
}

public interface IIdentityAdministration
{
    Task<string> ResetUserAsync(string email, CancellationToken cancellationToken);
}

public sealed record FirstOwnerRegistrationResult(string SetupCode);

public sealed record PasswordLoginResult(
    bool RequiresMfa,
    string? ChallengeId,
    TokenPair? Tokens);

public sealed record TokenPair(
    string AccessToken,
    DateTimeOffset AccessTokenExpiresAt,
    string RefreshToken,
    DateTimeOffset RefreshTokenExpiresAt,
    string CsrfToken);

public sealed record InvitationResult(string Email, string Code, DateTimeOffset ExpiresAt);

public sealed record MfaSetupResult(string Email, string SharedKey, string AuthenticatorUri);

public sealed record SetupCompletionResult(
    string Email,
    bool MfaEnabled,
    IReadOnlyCollection<string> RecoveryCodes,
    TokenPair Tokens);

public sealed record SecurityStatus(bool MfaEnabled);

public sealed record MfaEnrollmentResult(
    string ChallengeId,
    string SharedKey,
    string AuthenticatorUri);

public sealed record MfaChangeResult(IReadOnlyCollection<string> RecoveryCodes);
