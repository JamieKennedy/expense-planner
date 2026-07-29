using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace ExpensePlanner.Infrastructure.Persistence;

public sealed class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<ExpensePlannerDbContext>
{
    public ExpensePlannerDbContext CreateDbContext(string[] args)
    {
        var connectionString =
            Environment.GetEnvironmentVariable("ConnectionStrings__expense-planner") ??
            "Host=localhost;Port=5432;Database=expense_planner;Username=expense_planner;Password=expense_planner";
        var options = new DbContextOptionsBuilder<ExpensePlannerDbContext>()
            .UseNpgsql(connectionString)
            .Options;
        return new ExpensePlannerDbContext(options);
    }
}
