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
    public const string CsrfToken = "expense-csrf";

    public static string AccessToken(bool secure) =>
        secure ? "__Host-expense-access" : "expense-access";

    public static string RefreshToken(bool secure) =>
        secure ? "__Secure-expense-refresh" : "expense-refresh";
}
