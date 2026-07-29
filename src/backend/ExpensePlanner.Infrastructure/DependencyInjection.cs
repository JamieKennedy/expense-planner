using System.Security.Cryptography;
using ExpensePlanner.Application.Abstractions;
using ExpensePlanner.Application.Identity;
using ExpensePlanner.Infrastructure.Caching;
using ExpensePlanner.Infrastructure.Calendars;
using ExpensePlanner.Infrastructure.Identity;
using ExpensePlanner.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.IdentityModel.Tokens;

namespace ExpensePlanner.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("expense-planner")
            ?? configuration.GetConnectionString("postgres")
            ?? throw new InvalidOperationException("The PostgreSQL connection string is missing.");
        services.AddDbContext<ExpensePlannerDbContext>(options => options.UseNpgsql(connectionString));
        services.AddScoped<IExpensePlannerDbContext>(provider =>
            provider.GetRequiredService<ExpensePlannerDbContext>());

        services.AddIdentityCore<ApplicationUser>(options =>
            {
                options.SignIn.RequireConfirmedEmail = true;
                options.Password.RequiredLength = 12;
                options.Password.RequireDigit = false;
                options.Password.RequireLowercase = false;
                options.Password.RequireUppercase = false;
                options.Password.RequireNonAlphanumeric = false;
                options.Lockout.MaxFailedAccessAttempts = 5;
                options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
            })
            .AddEntityFrameworkStores<ExpensePlannerDbContext>()
            .AddDefaultTokenProviders();

        services.Configure<JwtOptions>(configuration.GetSection(JwtOptions.SectionName));
        var jwt = configuration.GetSection(JwtOptions.SectionName).Get<JwtOptions>() ?? new JwtOptions();
        var rsa = LoadRsa(jwt.SigningKeyPath);
        var securityKey = new RsaSecurityKey(rsa) { KeyId = "expense-planner" };
        services.AddSingleton(new SigningCredentials(securityKey, SecurityAlgorithms.RsaSha256));
        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(options =>
            {
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = true,
                    ValidIssuer = jwt.Issuer,
                    ValidateAudience = true,
                    ValidAudience = jwt.Audience,
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = securityKey,
                    ValidateLifetime = true,
                    ClockSkew = TimeSpan.FromSeconds(30),
                    NameClaimType = System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub,
                };
                options.Events = new JwtBearerEvents
                {
                    OnMessageReceived = context =>
                    {
                        var environment = context.HttpContext.RequestServices
                            .GetRequiredService<IHostEnvironment>();
                        context.Token = context.Request.Cookies[
                            AuthCookies.AccessToken(!environment.IsDevelopment())];
                        return Task.CompletedTask;
                    },
                };
            });

        var redisConnection = configuration.GetConnectionString("cache")
            ?? configuration.GetConnectionString("redis")
            ?? "localhost:6379";
        services.AddStackExchangeRedisCache(options => options.Configuration = redisConnection);
        services.AddScoped<IPlannerCache, RedisPlannerCache>();
        services.AddHttpClient("gov-uk-bank-holidays", client =>
        {
            client.BaseAddress = new Uri("https://www.gov.uk/");
            client.Timeout = TimeSpan.FromSeconds(10);
        });
        services.AddScoped<GovUkWorkingDayCalendar>();
        services.AddScoped<IWorkingDayCalendar>(provider =>
            provider.GetRequiredService<GovUkWorkingDayCalendar>());
        services.AddScoped<IdentityModule>();
        services.AddScoped<IIdentityModule>(provider => provider.GetRequiredService<IdentityModule>());
        services.AddScoped<IIdentityAdministration>(provider => provider.GetRequiredService<IdentityModule>());
        return services;
    }

    private static RSA LoadRsa(string? path)
    {
        var rsa = RSA.Create(2048);
        if (!string.IsNullOrWhiteSpace(path) && File.Exists(path))
        {
            rsa.ImportFromPem(File.ReadAllText(path));
        }

        return rsa;
    }
}
