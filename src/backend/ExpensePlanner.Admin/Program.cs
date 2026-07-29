using ExpensePlanner.Application.Abstractions;
using ExpensePlanner.Application.Identity;
using ExpensePlanner.Infrastructure;
using ExpensePlanner.Infrastructure.Calendars;
using ExpensePlanner.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

var builder = Host.CreateApplicationBuilder(args);
builder.Configuration.AddJsonFile("appsettings.json", optional: true)
    .AddEnvironmentVariables();
builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddScoped<IPlannerContext, NoPlannerContext>();

using var host = builder.Build();
await using var scope = host.Services.CreateAsyncScope();
var cancellationToken = CancellationToken.None;

if (args.Length == 0)
{
    Usage();
    return 1;
}

try
{
    switch (args[0])
    {
        case "migrate":
            await scope.ServiceProvider.GetRequiredService<ExpensePlannerDbContext>()
                .Database.MigrateAsync(cancellationToken);
            Console.WriteLine("Database migrations applied.");
            break;
        case "reset-user":
            Console.WriteLine(await SetupCodeAsync(
                scope.ServiceProvider,
                args,
                (admin, email, token) => admin.ResetUserAsync(email, token),
                cancellationToken));
            break;
        case "sync-bank-holidays":
            var count = await scope.ServiceProvider.GetRequiredService<GovUkWorkingDayCalendar>()
                .RefreshAsync(cancellationToken);
            Console.WriteLine($"Synchronized {count} England and Wales bank holidays.");
            break;
        case "health":
            var canConnect = await scope.ServiceProvider.GetRequiredService<ExpensePlannerDbContext>()
                .Database.CanConnectAsync(cancellationToken);
            Console.WriteLine(canConnect ? "PostgreSQL connection healthy." : "PostgreSQL connection failed.");
            return canConnect ? 0 : 2;
        default:
            Usage();
            return 1;
    }
}
catch (Exception exception)
{
    Console.Error.WriteLine(exception.Message);
    return 2;
}

return 0;

static async Task<string> SetupCodeAsync(
    IServiceProvider services,
    string[] arguments,
    Func<IIdentityAdministration, string, CancellationToken, Task<string>> action,
    CancellationToken cancellationToken)
{
    var email = Option(arguments, "--email")
        ?? throw new ArgumentException("--email is required.");
    var code = await action(
        services.GetRequiredService<IIdentityAdministration>(),
        email,
        cancellationToken);
    return $"Open /setup?code={Uri.EscapeDataString(code)} within one hour.";
}

static string? Option(IReadOnlyList<string> arguments, string name)
{
    for (var index = 0; index < arguments.Count - 1; index++)
    {
        if (string.Equals(arguments[index], name, StringComparison.OrdinalIgnoreCase))
        {
            return arguments[index + 1];
        }
    }

    return null;
}

static void Usage()
{
    Console.WriteLine(
        """
        Expense Planner administration

          migrate
          reset-user --email <address>
          sync-bank-holidays
          health
        """);
}

file sealed class NoPlannerContext : IPlannerContext
{
    public Guid PlannerId => throw new InvalidOperationException("No planner is available to the Admin CLI.");
    public Guid UserId => throw new InvalidOperationException("No user is available to the Admin CLI.");
}
