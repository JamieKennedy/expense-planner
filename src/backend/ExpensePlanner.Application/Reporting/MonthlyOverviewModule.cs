using ExpensePlanner.Application.Abstractions;
using ExpensePlanner.Domain.Planning;
using ExpensePlanner.Domain.Reporting;
using Microsoft.EntityFrameworkCore;

namespace ExpensePlanner.Application.Reporting;

public interface IMonthlyOverviewModule
{
    Task<MonthlyOverviewDto> GetAsync(string month, CancellationToken cancellationToken);
}

public sealed record NamedAmountDto(Guid Id, string Name, long AmountPence);

public sealed record MonthlyOverviewDto(
    string Month,
    long ProjectedIncomePence,
    long ProjectedExpensesPence,
    long ProjectedNetPence,
    IReadOnlyCollection<NamedAmountDto> ContributorCosts,
    IReadOnlyCollection<NamedAmountDto> TagCosts,
    IReadOnlyCollection<BudgetLineOverviewDto> BudgetLines,
    IReadOnlyCollection<NamedAmountDto> BudgetContributions);

public sealed record BudgetLineOverviewDto(
    Guid Id,
    string Name,
    Guid TagId,
    string TagName,
    long AllowancePence,
    long ProjectedExpensesPence,
    long RemainingPence);

public sealed class MonthlyOverviewModule(
    IExpensePlannerDbContext dbContext,
    IPlannerContext plannerContext,
    IPlannerCache cache) : IMonthlyOverviewModule
{
    public Task<MonthlyOverviewDto> GetAsync(string month, CancellationToken cancellationToken) =>
        cache.GetOrCreateAsync(
            plannerContext.PlannerId,
            $"monthly-overview:{month}",
            TimeSpan.FromMinutes(5),
            token => CalculateAsync(month, token),
            cancellationToken);

    private async Task<MonthlyOverviewDto> CalculateAsync(string month, CancellationToken cancellationToken)
    {
        var plannerId = plannerContext.PlannerId;
        var expenses = await dbContext.Expenses.AsNoTracking()
            .Include(expense => expense.Tags)
            .Include(expense => expense.ContributorShares)
            .Where(expense => expense.PlannerId == plannerId)
            .ToArrayAsync(cancellationToken);
        var income = await dbContext.IncomeItems.AsNoTracking()
            .Where(item => item.PlannerId == plannerId)
            .ToArrayAsync(cancellationToken);
        var tags = await dbContext.Tags.AsNoTracking()
            .Where(tag => tag.PlannerId == plannerId)
            .ToArrayAsync(cancellationToken);
        var contributors = await dbContext.Contributors.AsNoTracking()
            .Where(contributor => contributor.PlannerId == plannerId)
            .ToArrayAsync(cancellationToken);
        var budget = await dbContext.BudgetTemplates.AsNoTracking()
            .Include(item => item.Lines)
            .ThenInclude(line => line.ContributorShares)
            .SingleOrDefaultAsync(item => item.PlannerId == plannerId, cancellationToken);

        var result = MonthlyOverviewCalculator.Calculate(new MonthlyOverviewInput(
            month,
            expenses.Select(expense => new ExpenseOverviewInput(
                expense.Id,
                expense.AmountPence,
                expense.Tags.Select(tag => tag.TagId).ToArray(),
                expense.ContributorShares.Select(share =>
                    new ContributorShareValue(share.ContributorId, share.BasisPoints)).ToArray())).ToArray(),
            income.Select(item => new IncomeOverviewInput(item.Id, item.AmountPence)).ToArray(),
            tags.Select(tag => new TagOverviewInput(tag.Id, tag.Name)).ToArray(),
            budget?.Lines.Select(line => new BudgetLineOverviewInput(
                line.Id,
                line.Name,
                line.TagId,
                line.AllowancePence,
                line.ContributorShares.Select(share =>
                    new ContributorShareValue(share.ContributorId, share.BasisPoints)).ToArray())).ToArray() ?? []));

        var contributorNames = contributors.ToDictionary(item => item.Id, item => item.Name);
        var tagNames = tags.ToDictionary(item => item.Id, item => item.Name);
        return new MonthlyOverviewDto(
            result.Month,
            result.ProjectedIncomePence,
            result.ProjectedExpensesPence,
            result.ProjectedNetPence,
            result.ContributorCostsPence.Select(item =>
                new NamedAmountDto(item.Key, contributorNames.GetValueOrDefault(item.Key, "Archived"), item.Value))
                .OrderByDescending(item => item.AmountPence)
                .ToArray(),
            result.TagCostsPence.Select(item =>
                new NamedAmountDto(item.Key, tagNames.GetValueOrDefault(item.Key, "Archived"), item.Value))
                .OrderByDescending(item => item.AmountPence)
                .ToArray(),
            result.BudgetLines.Select(line => new BudgetLineOverviewDto(
                line.Id,
                line.Name,
                line.TagId,
                tagNames.GetValueOrDefault(line.TagId, "Archived"),
                line.AllowancePence,
                line.ProjectedExpensesPence,
                line.RemainingPence)).ToArray(),
            result.BudgetContributionsPence.Select(item =>
                new NamedAmountDto(item.Key, contributorNames.GetValueOrDefault(item.Key, "Archived"), item.Value))
                .OrderByDescending(item => item.AmountPence)
                .ToArray());
    }
}
