namespace ExpensePlanner.Infrastructure.Identity;

public sealed class JwtOptions
{
    public const string SectionName = "Jwt";
    public string Issuer { get; init; } = "https://expense-planner.local";
    public string Audience { get; init; } = "expense-planner-api";
    public string? SigningKeyPath { get; init; }
}

public static class AuthCookies
{
    public const string AccessToken = "__Host-expense-access";
    public const string RefreshToken = "__Secure-expense-refresh";
    public const string CsrfToken = "expense-csrf";
}
