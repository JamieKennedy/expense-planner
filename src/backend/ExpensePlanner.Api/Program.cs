using System.Threading.RateLimiting;
using ExpensePlanner.Api;
using ExpensePlanner.Api.Security;
using ExpensePlanner.Application;
using ExpensePlanner.Application.Abstractions;
using ExpensePlanner.Infrastructure;
using ExpensePlanner.ServiceDefaults;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.HttpOverrides;

var builder = WebApplication.CreateBuilder(args);

builder.Logging.ClearProviders();
builder.Logging.AddConsole();
builder.AddServiceDefaults();
builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);
if (builder.Environment.IsDevelopment())
{
    builder.Services.AddSingleton<IDataProtectionProvider>(
        new EphemeralDataProtectionProvider());
}

builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<IPlannerContext, HttpPlannerContext>();
builder.Services.AddExceptionHandler<ApiExceptionHandler>();
builder.Services.AddProblemDetails();
builder.Services.AddControllers();
builder.Services.AddOpenApi();
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders =
        ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.KnownIPNetworks.Clear();
    options.KnownProxies.Clear();
});
builder.Services.AddAuthorizationBuilder()
    .SetFallbackPolicy(new AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build());
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy("login", context =>
        RateLimitPartition.GetFixedWindowLimiter(
            context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 10,
                Window = TimeSpan.FromMinutes(5),
                QueueLimit = 0,
            }));
});

var app = builder.Build();

app.UseExceptionHandler();
app.UseForwardedHeaders();
app.Use(async (context, next) =>
{
    context.Response.Headers.XContentTypeOptions = "nosniff";
    context.Response.Headers.XFrameOptions = "DENY";
    context.Response.Headers.ContentSecurityPolicy =
        "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'";
    context.Response.Headers["Referrer-Policy"] = "no-referrer";
    await next();
});
app.UseHttpsRedirection();
app.UseRateLimiter();
app.UseAuthentication();
app.UseMiddleware<CsrfMiddleware>();
app.UseAuthorization();
app.MapControllers();
app.MapOpenApi().AllowAnonymous();
app.MapDefaultEndpoints();

app.Run();

public partial class Program;
