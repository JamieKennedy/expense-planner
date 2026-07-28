using System.Security.Cryptography;
using System.Text;
using ExpensePlanner.Infrastructure.Identity;
using Microsoft.AspNetCore.Mvc;

namespace ExpensePlanner.Api.Security;

public sealed class CsrfMiddleware(RequestDelegate next)
{
    private static readonly HashSet<string> SafeMethods =
        new(StringComparer.OrdinalIgnoreCase) { "GET", "HEAD", "OPTIONS", "TRACE" };

    public async Task InvokeAsync(HttpContext context)
    {
        var requiresCsrf = !SafeMethods.Contains(context.Request.Method) &&
                           context.User.Identity?.IsAuthenticated == true &&
                           !context.Request.Path.StartsWithSegments("/api/auth/refresh");
        if (requiresCsrf)
        {
            var cookie = context.Request.Cookies[AuthCookies.CsrfToken];
            var header = context.Request.Headers["X-CSRF-Token"].ToString();
            if (string.IsNullOrWhiteSpace(cookie) ||
                string.IsNullOrWhiteSpace(header) ||
                !CryptographicOperations.FixedTimeEquals(
                    Encoding.UTF8.GetBytes(cookie),
                    Encoding.UTF8.GetBytes(header)))
            {
                context.Response.StatusCode = StatusCodes.Status400BadRequest;
                await context.Response.WriteAsJsonAsync(new ProblemDetails
                {
                    Status = StatusCodes.Status400BadRequest,
                    Title = "Invalid CSRF token",
                    Detail = "State-changing requests require a matching CSRF cookie and header.",
                });
                return;
            }
        }

        await next(context);
    }
}
