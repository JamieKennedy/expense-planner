using ExpensePlanner.Domain.Planning;

namespace ExpensePlanner.Domain.Reporting;

public static class MonthlyOverviewCalculator
{
    public static MonthlyOverview Calculate(MonthlyOverviewInput input)
    {
        var projectedExpenses = input.Expenses.Sum(expense => expense.AmountPence);
        var projectedIncome = input.IncomeItems.Sum(income => income.AmountPence);

        var contributorCosts = new Dictionary<Guid, long>();
        foreach (var expense in input.Expenses)
        {
            var shares = ContributorSplit.AllocatePence(expense.AmountPence, expense.Shares);
            foreach (var share in shares)
            {
                contributorCosts[share.Key] = contributorCosts.GetValueOrDefault(share.Key) + share.Value;
            }
        }

        var tagCosts = input.Tags.ToDictionary(
            tag => tag.Id,
            tag => input.Expenses
                .Where(expense => expense.TagIds.Contains(tag.Id))
                .Sum(expense => expense.AmountPence));

        var budgetContributions = new Dictionary<Guid, long>();
        var budgetLines = input.BudgetLines.Select(line =>
        {
            var projected = tagCosts.GetValueOrDefault(line.TagId);
            foreach (var share in ContributorSplit.AllocatePence(line.AllowancePence, line.Shares))
            {
                budgetContributions[share.Key] =
                    budgetContributions.GetValueOrDefault(share.Key) + share.Value;
            }

            return new BudgetLineOverview(
                line.Id,
                line.Name,
                line.TagId,
                line.AllowancePence,
                projected,
                line.AllowancePence - projected);
        }).ToArray();

        return new MonthlyOverview(
            input.Month,
            projectedIncome,
            projectedExpenses,
            projectedIncome - projectedExpenses,
            contributorCosts,
            tagCosts,
            budgetLines,
            budgetContributions);
    }
}

public sealed record MonthlyOverviewInput(
    string Month,
    IReadOnlyCollection<ExpenseOverviewInput> Expenses,
    IReadOnlyCollection<IncomeOverviewInput> IncomeItems,
    IReadOnlyCollection<TagOverviewInput> Tags,
    IReadOnlyCollection<BudgetLineOverviewInput> BudgetLines);

public sealed record ExpenseOverviewInput(
    Guid Id,
    long AmountPence,
    IReadOnlyCollection<Guid> TagIds,
    IReadOnlyCollection<ContributorShareValue> Shares);

public sealed record IncomeOverviewInput(Guid Id, long AmountPence);

public sealed record TagOverviewInput(Guid Id, string Name);

public sealed record BudgetLineOverviewInput(
    Guid Id,
    string Name,
    Guid TagId,
    long AllowancePence,
    IReadOnlyCollection<ContributorShareValue> Shares);

public sealed record MonthlyOverview(
    string Month,
    long ProjectedIncomePence,
    long ProjectedExpensesPence,
    long ProjectedNetPence,
    IReadOnlyDictionary<Guid, long> ContributorCostsPence,
    IReadOnlyDictionary<Guid, long> TagCostsPence,
    IReadOnlyCollection<BudgetLineOverview> BudgetLines,
    IReadOnlyDictionary<Guid, long> BudgetContributionsPence);

public sealed record BudgetLineOverview(
    Guid Id,
    string Name,
    Guid TagId,
    long AllowancePence,
    long ProjectedExpensesPence,
    long RemainingPence);
