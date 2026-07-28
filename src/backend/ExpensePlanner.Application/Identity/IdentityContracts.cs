namespace ExpensePlanner.Application.Identity;

public interface IIdentityModule
{
    Task<PasswordLoginResult> CheckPasswordAsync(
        string email,
        string password,
        CancellationToken cancellationToken);

    Task<TokenPair> VerifyMfaAsync(
        string challengeId,
        string code,
        CancellationToken cancellationToken);

    Task<TokenPair> RefreshAsync(string refreshToken, CancellationToken cancellationToken);
    Task RevokeAsync(string? refreshToken, CancellationToken cancellationToken);
    Task<InvitationResult> CreateInvitationAsync(string email, CancellationToken cancellationToken);
    Task<MfaSetupResult> PrepareSetupAsync(string code, CancellationToken cancellationToken);
    Task<SetupCompletionResult> CompleteSetupAsync(
        string code,
        string password,
        string totpCode,
        CancellationToken cancellationToken);
}

public interface IIdentityAdministration
{
    Task<string> BootstrapUserAsync(string email, CancellationToken cancellationToken);
    Task<string> ResetUserAsync(string email, CancellationToken cancellationToken);
}

public sealed record PasswordLoginResult(bool RequiresMfa, string ChallengeId);

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
    IReadOnlyCollection<string> RecoveryCodes,
    TokenPair Tokens);
