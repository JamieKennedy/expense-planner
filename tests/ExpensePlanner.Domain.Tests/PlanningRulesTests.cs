using ExpensePlanner.Domain.Common;
using ExpensePlanner.Domain.Planning;
using ExpensePlanner.Domain.Reporting;

namespace ExpensePlanner.Domain.Tests;

public sealed class PlanningRulesTests
{
    [Fact]
    public void Owner_contributor_can_be_renamed_but_not_archived()
    {
        var contributor = new Contributor(Guid.NewGuid(), "Me", isOwner: true);

        contributor.Rename("Jamie");

        Assert.Equal("Jamie", contributor.Name);
        Assert.True(contributor.IsOwner);
        Assert.Throws<DomainValidationException>(contributor.Archive);
        Assert.False(contributor.IsArchived);
    }

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

    [Fact]
    public void One_off_schedule_occurs_only_in_its_exact_month()
    {
        var schedule = new ExpenseScheduleValue(
            null,
            new DateOnly(2026, 4, 17),
            null,
            false);

        Assert.Empty(ExpenseSchedule.ProjectNominalDates(schedule, 2026, 3));
        Assert.Equal(
            [new DateOnly(2026, 4, 17)],
            ExpenseSchedule.ProjectNominalDates(schedule, 2026, 4));
        Assert.Empty(ExpenseSchedule.ProjectNominalDates(schedule, 2026, 5));
    }

    [Fact]
    public void Monthly_schedule_honours_its_start_and_legacy_schedules_remain_unbounded()
    {
        var bounded = new ExpenseScheduleValue(
            ExpenseFrequency.Monthly,
            new DateOnly(2026, 4, 1),
            31,
            false);
        var legacy = bounded with { ScheduleAnchorDate = null };

        Assert.Empty(ExpenseSchedule.ProjectNominalDates(bounded, 2026, 3));
        Assert.Equal(
            [new DateOnly(2026, 4, 30)],
            ExpenseSchedule.ProjectNominalDates(bounded, 2026, 4));
        Assert.Equal(
            [new DateOnly(2025, 2, 28)],
            ExpenseSchedule.ProjectNominalDates(legacy, 2025, 2));
    }

    [Fact]
    public void Weekly_schedule_projects_each_charge_from_a_mid_month_anchor()
    {
        var schedule = new ExpenseScheduleValue(
            ExpenseFrequency.Weekly,
            new DateOnly(2026, 4, 15),
            null,
            false);

        Assert.Equal(
            [
                new DateOnly(2026, 4, 15),
                new DateOnly(2026, 4, 22),
                new DateOnly(2026, 4, 29),
            ],
            ExpenseSchedule.ProjectNominalDates(schedule, 2026, 4));
        Assert.Equal(
            4,
            ExpenseSchedule.ProjectNominalDates(schedule, 2026, 5).Count);
    }

    [Fact]
    public void Working_day_adjustment_can_cross_a_month_without_changing_ownership()
    {
        var schedule = new ExpenseScheduleValue(
            ExpenseFrequency.Monthly,
            new DateOnly(2026, 1, 1),
            31,
            true);

        var occurrence = Assert.Single(
            ExpenseSchedule.Project(schedule, 2026, 1, new HashSet<DateOnly>()));

        Assert.Equal(new DateOnly(2026, 1, 31), occurrence.NominalDate);
        Assert.Equal(new DateOnly(2026, 2, 2), occurrence.DueDate);
    }

    [Theory]
    [MemberData(nameof(InvalidExpenseSchedules))]
    public void Invalid_expense_schedule_combinations_are_rejected(
        ExpenseScheduleValue schedule)
    {
        Assert.Throws<DomainValidationException>(() => ExpenseSchedule.Validate(schedule));
    }

    public static TheoryData<ExpenseScheduleValue> InvalidExpenseSchedules =>
        new()
        {
            new ExpenseScheduleValue(null, null, null, false),
            new ExpenseScheduleValue(null, new DateOnly(2026, 4, 1), null, true),
            new ExpenseScheduleValue(
                ExpenseFrequency.Monthly,
                new DateOnly(2026, 4, 1),
                null,
                false),
            new ExpenseScheduleValue(
                ExpenseFrequency.Monthly,
                new DateOnly(2026, 4, 2),
                1,
                false),
            new ExpenseScheduleValue(ExpenseFrequency.Weekly, null, null, false),
            new ExpenseScheduleValue(
                ExpenseFrequency.Weekly,
                new DateOnly(2026, 4, 1),
                1,
                false),
        };

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
        var account = Guid.NewGuid();
        var contributor = Guid.NewGuid();
        var overview = MonthlyOverviewCalculator.Calculate(new MonthlyOverviewInput(
            [
                new ExpenseOverviewInput(
                    Guid.NewGuid(),
                    10_000,
                    account,
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
        Assert.Equal(10_000, overview.AccountCostsPence[account]);
    }

    [Fact]
    public void Account_costs_group_each_expense_by_its_source_account()
    {
        var accountA = Guid.NewGuid();
        var accountB = Guid.NewGuid();
        var tag = Guid.NewGuid();
        var contributor = Guid.NewGuid();
        var overview = MonthlyOverviewCalculator.Calculate(new MonthlyOverviewInput(
            [
                new ExpenseOverviewInput(
                    Guid.NewGuid(),
                    7_500,
                    accountA,
                    [tag],
                    [new ContributorShareValue(contributor, 10_000)]),
                new ExpenseOverviewInput(
                    Guid.NewGuid(),
                    2_500,
                    accountA,
                    [tag],
                    [new ContributorShareValue(contributor, 10_000)]),
                new ExpenseOverviewInput(
                    Guid.NewGuid(),
                    4_000,
                    accountB,
                    [tag],
                    [new ContributorShareValue(contributor, 10_000)]),
            ],
            [],
            [new(tag, "Bills")],
            []));

        Assert.Equal(14_000, overview.ProjectedExpensesPence);
        Assert.Equal(10_000, overview.AccountCostsPence[accountA]);
        Assert.Equal(4_000, overview.AccountCostsPence[accountB]);
    }

    [Fact]
    public void Budget_reports_projected_remaining_and_contributor_totals()
    {
        var tag = Guid.NewGuid();
        var first = Guid.Parse("00000000-0000-0000-0000-000000000001");
        var second = Guid.Parse("00000000-0000-0000-0000-000000000002");
        var account = Guid.NewGuid();
        var line = Guid.NewGuid();

        var overview = MonthlyOverviewCalculator.Calculate(new MonthlyOverviewInput(
            [
                new ExpenseOverviewInput(
                    Guid.NewGuid(),
                    7_500,
                    account,
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

    [Fact]
    public void Budget_reconciliation_updates_retained_tags_and_removes_missing_lines()
    {
        var plannerId = Guid.NewGuid();
        var retainedTag = Guid.NewGuid();
        var removedTag = Guid.NewGuid();
        var replacementTag = Guid.NewGuid();
        var firstContributor = Guid.NewGuid();
        var secondContributor = Guid.NewGuid();
        var budget = new BudgetTemplate(plannerId);
        budget.ReplaceLines(
        [
            new BudgetLineValue(
                "Household",
                10_000,
                retainedTag,
                [new ContributorShareValue(firstContributor, 10_000)]),
            new BudgetLineValue(
                "Personal",
                5_000,
                removedTag,
                [new ContributorShareValue(firstContributor, 10_000)]),
        ]);
        var retainedId = budget.Lines.Single(line => line.TagId == retainedTag).Id;

        budget.ReplaceLines(
        [
            new BudgetLineValue(
                "Shared household",
                12_500,
                retainedTag,
                [
                    new ContributorShareValue(firstContributor, 6_000),
                    new ContributorShareValue(secondContributor, 4_000),
                ]),
        ]);

        var retained = Assert.Single(budget.Lines);
        Assert.Equal(retainedId, retained.Id);
        Assert.Equal("Shared household", retained.Name);
        Assert.Equal(12_500, retained.AllowancePence);
        Assert.Equal(
            [6_000, 4_000],
            retained.ContributorShares.Select(share => share.BasisPoints).ToArray());

        budget.ReplaceLines(
        [
            new BudgetLineValue(
                "Replacement",
                8_000,
                replacementTag,
                [new ContributorShareValue(firstContributor, 10_000)]),
        ]);

        var replacement = Assert.Single(budget.Lines);
        Assert.NotEqual(retainedId, replacement.Id);
        Assert.Equal(replacementTag, replacement.TagId);

        budget.ReplaceLines([]);
        Assert.Empty(budget.Lines);
    }
}
