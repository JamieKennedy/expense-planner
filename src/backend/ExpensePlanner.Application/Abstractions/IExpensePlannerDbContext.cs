using ExpensePlanner.Domain.Planning;
using Microsoft.EntityFrameworkCore;

namespace ExpensePlanner.Application.Abstractions;

public interface IExpensePlannerDbContext
{
    DbSet<Planner> Planners { get; }
    DbSet<Account> Accounts { get; }
    DbSet<Contributor> Contributors { get; }
    DbSet<Tag> Tags { get; }
    DbSet<Expense> Expenses { get; }
    DbSet<IncomeItem> IncomeItems { get; }
    DbSet<BudgetTemplate> BudgetTemplates { get; }
    DbSet<BudgetLine> BudgetLines { get; }
    DbSet<BankHoliday> BankHolidays { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}

public interface IPlannerContext
{
    Guid PlannerId { get; }
    Guid UserId { get; }
}

public interface IWorkingDayCalendar
{
    Task<IReadOnlySet<DateOnly>> GetHolidaysAsync(
        int fromYear,
        int toYear,
        CancellationToken cancellationToken);
}

public interface IPlannerCache
{
    Task<T> GetOrCreateAsync<T>(
        Guid plannerId,
        string key,
        TimeSpan lifetime,
        Func<CancellationToken, Task<T>> factory,
        CancellationToken cancellationToken);

    Task InvalidateAsync(Guid plannerId, CancellationToken cancellationToken);
}
