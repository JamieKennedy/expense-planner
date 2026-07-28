using ExpensePlanner.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Testcontainers.PostgreSql;

namespace ExpensePlanner.IntegrationTests;

public sealed class PostgreSqlSchemaTests
{
    [Fact]
    public async Task Initial_migration_creates_a_queryable_schema()
    {
        if (!string.Equals(
                Environment.GetEnvironmentVariable("RUN_INTEGRATION_TESTS"),
                "true",
                StringComparison.OrdinalIgnoreCase))
        {
            return;
        }

        await using var postgres = new PostgreSqlBuilder()
            .WithImage("postgres:18-alpine")
            .Build();
        await postgres.StartAsync();
        var options = new DbContextOptionsBuilder<ExpensePlannerDbContext>()
            .UseNpgsql(postgres.GetConnectionString())
            .Options;
        await using var dbContext = new ExpensePlannerDbContext(options);

        await dbContext.Database.MigrateAsync();

        Assert.Empty(await dbContext.Planners.ToArrayAsync());
        Assert.True(await dbContext.Database.CanConnectAsync());
    }
}
