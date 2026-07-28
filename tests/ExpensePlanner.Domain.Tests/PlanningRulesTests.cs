using ExpensePlanner.Domain.Common;
using ExpensePlanner.Domain.Planning;
using ExpensePlanner.Domain.Reporting;

namespace ExpensePlanner.Domain.Tests;

public sealed class PlanningRulesTests
{
    [Fact]
    public void Schedule_clamps_short_month_then_advances_to_next_working_day()
    {
        var holidays = new HashSet<DateOnly> { new(2026, 3, 2) };

        var dueDate = MonthlySchedule.Resolve(2026, 2, 31, true, holidays);

        Assert.Equal(new DateOnly(2026, 3, 3), dueDate);
    }

    [Fact]
    public void Schedule_keeps_calendar_date_when_adjustment_is_disabled()
    {
        var dueDate = MonthlySchedule.Resolve(2026, 2, 31, false, new HashSet<DateOnly>());

        Assert.Equal(new DateOnly(2026, 2, 28), dueDate);
    }

    [Theory]
    [InlineData(1, 10_000, 10_000)]
    [InlineData(2, 5_000, 5_000)]
    [InlineData(3, 3_334, 3_333)]
    public void Even_split_is_deterministic_and_totals_ten_thousand_basis_points(
        int count,
        int firstShare,
        int lastShare)
    {
        var contributors = Enumerable.Range(1, count)
            .Select(value => Guid.Parse($"00000000-0000-0000-0000-{value:D12}"))
            .ToArray();

        var result = ContributorSplit.Even(contributors);

        Assert.Equal(10_000, result.Sum(share => share.BasisPoints));
        Assert.Equal(firstShare, result[0].BasisPoints);
        Assert.Equal(lastShare, result[^1].BasisPoints);
    }

    [Fact]
    public void Pence_allocation_distributes_rounding_remainder_without_losing_money()
    {
        var first = Guid.Parse("00000000-0000-0000-0000-000000000001");
        var second = Guid.Parse("00000000-0000-0000-0000-000000000002");
        var result = ContributorSplit.AllocatePence(
            1_001,
            [new(first, 5_000), new(second, 5_000)]);

        Assert.Equal(1_001, result.Values.Sum());
        Assert.Equal(501, result[first]);
        Assert.Equal(500, result[second]);
    }

    [Fact]
    public void Split_must_total_one_hundred_percent()
    {
        var exception = Assert.Throws<DomainValidationException>(() =>
            ContributorSplit.Validate([new(Guid.NewGuid(), 9_999)]));

        Assert.Contains("10,000", exception.Message, StringComparison.Ordinal);
    }

    [Fact]
    public void Tag_totals_are_intentionally_non_additive_but_overall_expense_is_not_duplicated()
    {
        var tagA = Guid.NewGuid();
        var tagB = Guid.NewGuid();
        var contributor = Guid.NewGuid();
        var overview = MonthlyOverviewCalculator.Calculate(new MonthlyOverviewInput(
            "2026-07",
            [
                new ExpenseOverviewInput(
                    Guid.NewGuid(),
                    10_000,
                    [tagA, tagB],
                    [new ContributorShareValue(contributor, 10_000)]),
            ],
            [],
            [new(tagA, "Home"), new(tagB, "Essential")],
            []));

        Assert.Equal(10_000, overview.ProjectedExpensesPence);
        Assert.Equal(10_000, overview.TagCostsPence[tagA]);
        Assert.Equal(10_000, overview.TagCostsPence[tagB]);
        Assert.Equal(10_000, overview.ContributorCostsPence[contributor]);
    }

    [Fact]
    public void Budget_reports_projected_remaining_and_contributor_totals()
    {
        var tag = Guid.NewGuid();
        var first = Guid.Parse("00000000-0000-0000-0000-000000000001");
        var second = Guid.Parse("00000000-0000-0000-0000-000000000002");
        var line = Guid.NewGuid();

        var overview = MonthlyOverviewCalculator.Calculate(new MonthlyOverviewInput(
            "2026-07",
            [
                new ExpenseOverviewInput(
                    Guid.NewGuid(),
                    7_500,
                    [tag],
                    [new ContributorShareValue(first, 10_000)]),
            ],
            [new(Guid.NewGuid(), 20_000)],
            [new(tag, "Household")],
            [
                new BudgetLineOverviewInput(
                    line,
                    "Household allowance",
                    tag,
                    10_001,
                    [
                        new ContributorShareValue(first, 5_000),
                        new ContributorShareValue(second, 5_000),
                    ]),
            ]));

        Assert.Equal(12_500, overview.ProjectedNetPence);
        var budget = Assert.Single(overview.BudgetLines);
        Assert.Equal(7_500, budget.ProjectedExpensesPence);
        Assert.Equal(2_501, budget.RemainingPence);
        Assert.Equal(5_001, overview.BudgetContributionsPence[first]);
        Assert.Equal(5_000, overview.BudgetContributionsPence[second]);
    }
}
