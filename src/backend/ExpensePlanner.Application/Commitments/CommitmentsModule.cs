using ExpensePlanner.Application.Abstractions;
using ExpensePlanner.Application.Common;
using ExpensePlanner.Domain.Common;
using ExpensePlanner.Domain.Planning;
using Microsoft.EntityFrameworkCore;

namespace ExpensePlanner.Application.Commitments;

public interface ICommitmentsModule
{
    Task<ExpensePageDto> GetExpensesAsync(ExpenseQuery query, CancellationToken cancellationToken);
    Task<ExpenseDto> SaveExpenseAsync(Guid? id, SaveExpenseRequest request, CancellationToken cancellationToken);
    Task DeleteExpenseAsync(Guid id, CancellationToken cancellationToken);
    Task<IReadOnlyCollection<IncomeItemDto>> GetIncomeItemsAsync(string month, CancellationToken cancellationToken);
    Task<IncomeItemDto> SaveIncomeItemAsync(Guid? id, SaveIncomeItemRequest request, CancellationToken cancellationToken);
    Task DeleteIncomeItemAsync(Guid id, CancellationToken cancellationToken);
    Task<BudgetTemplateDto> GetBudgetAsync(CancellationToken cancellationToken);
    Task<BudgetTemplateDto> ReplaceBudgetAsync(ReplaceBudgetRequest request, CancellationToken cancellationToken);
}

public sealed record ContributorShareDto(Guid ContributorId, int BasisPoints, long? AllocatedPence = null);

public sealed record SaveExpenseRequest(
    string Name,
    long AmountPence,
    Guid AccountId,
    string? Frequency,
    DateOnly? ScheduleAnchorDate,
    int? DayOfMonth,
    bool MoveToNextWorkingDay,
    IReadOnlyCollection<Guid> TagIds,
    IReadOnlyCollection<ContributorShareDto> ContributorShares);

public sealed record ExpenseDto(
    Guid Id,
    string Name,
    long AmountPence,
    long AttributedAmountPence,
    Guid AccountId,
    string AccountName,
    string? Frequency,
    DateOnly? ScheduleAnchorDate,
    int? DayOfMonth,
    DateOnly NominalDate,
    DateOnly DueDate,
    bool MoveToNextWorkingDay,
    IReadOnlyCollection<Guid> TagIds,
    IReadOnlyCollection<ContributorShareDto> ContributorShares);

public sealed record ExpensePageDto(
    IReadOnlyCollection<ExpenseDto> Items,
    int Page,
    int PageSize,
    int TotalCount,
    long TotalAmountPence);

public sealed record ExpenseQuery(
    string Month,
    IReadOnlyCollection<Guid>? AccountIds = null,
    IReadOnlyCollection<Guid>? TagIds = null,
    IReadOnlyCollection<Guid>? ContributorIds = null,
    string? Search = null,
    string Sort = "dueDate",
    bool Descending = false,
    int Page = 1,
    int PageSize = 25);

public sealed record SaveIncomeItemRequest(
    string Name,
    long AmountPence,
    Guid AccountId,
    int DayOfMonth,
    bool MoveToNextWorkingDay);

public sealed record IncomeItemDto(
    Guid Id,
    string Name,
    long AmountPence,
    Guid AccountId,
    string AccountName,
    int DayOfMonth,
    DateOnly DueDate,
    bool MoveToNextWorkingDay);

public sealed record ReplaceBudgetRequest(IReadOnlyCollection<SaveBudgetLineRequest> Lines);

public sealed record SaveBudgetLineRequest(
    string Name,
    long AllowancePence,
    Guid TagId,
    IReadOnlyCollection<ContributorShareDto> ContributorShares);

public sealed record BudgetTemplateDto(Guid Id, IReadOnlyCollection<BudgetLineDto> Lines);

public sealed record BudgetLineDto(
    Guid Id,
    string Name,
    long AllowancePence,
    Guid TagId,
    IReadOnlyCollection<ContributorShareDto> ContributorShares);

public sealed class CommitmentsModule(
    IExpensePlannerDbContext dbContext,
    IPlannerContext plannerContext,
    IWorkingDayCalendar workingDayCalendar,
    IPlannerCache cache) : ICommitmentsModule
{
    public async Task<ExpensePageDto> GetExpensesAsync(
        ExpenseQuery query,
        CancellationToken cancellationToken)
    {
        var (year, month) = ParseMonth(query.Month);
        var plannerId = plannerContext.PlannerId;
        var expenses = dbContext.Expenses
            .AsNoTracking()
            .Include(expense => expense.Tags)
            .Include(expense => expense.ContributorShares)
            .Where(expense => expense.PlannerId == plannerId);

        if (query.AccountIds is { Count: > 0 })
        {
            expenses = expenses.Where(expense => query.AccountIds.Contains(expense.AccountId));
        }

        if (query.TagIds is { Count: > 0 })
        {
            expenses = expenses.Where(expense => expense.Tags.Any(tag => query.TagIds.Contains(tag.TagId)));
        }

        if (query.ContributorIds is { Count: > 0 })
        {
            expenses = expenses.Where(expense =>
                expense.ContributorShares.Any(share => query.ContributorIds.Contains(share.ContributorId)));
        }

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var search = query.Search.Trim();
            expenses = expenses.Where(expense => expense.Name.Contains(search));
        }

        var materialized = await expenses.ToArrayAsync(cancellationToken);
        var accountNames = await dbContext.Accounts.AsNoTracking()
            .Where(account => account.PlannerId == plannerId)
            .ToDictionaryAsync(account => account.Id, account => account.Name, cancellationToken);
        var holidays = materialized.Any(expense => expense.MoveToNextWorkingDay)
            ? await workingDayCalendar.GetHolidaysAsync(year, year + 1, cancellationToken)
            : new HashSet<DateOnly>();

        var attributedContributors = query.ContributorIds is { Count: > 0 }
            ? query.ContributorIds.ToHashSet()
            : null;
        var mapped = materialized.SelectMany(expense =>
                ExpenseSchedule.Project(expense.Schedule, year, month, holidays)
                    .Select(occurrence => MapExpense(
                        expense,
                        occurrence,
                        accountNames,
                        attributedContributors)))
            .ToArray();
        var totalAmountPence = mapped.Sum(expense => expense.AttributedAmountPence);
        var sorted = mapped.AsEnumerable();
        sorted = query.Sort switch
        {
            "name" => query.Descending
                ? sorted.OrderByDescending(expense => expense.Name)
                : sorted.OrderBy(expense => expense.Name),
            "amount" => query.Descending
                ? sorted.OrderByDescending(expense => expense.AttributedAmountPence)
                : sorted.OrderBy(expense => expense.AttributedAmountPence),
            _ => query.Descending
                ? sorted.OrderByDescending(expense => expense.DueDate)
                : sorted.OrderBy(expense => expense.DueDate),
        };

        var page = Math.Max(query.Page, 1);
        var pageSize = Math.Clamp(query.PageSize, 1, 100);
        return new ExpensePageDto(
            sorted.Skip((page - 1) * pageSize).Take(pageSize).ToArray(),
            page,
            pageSize,
            mapped.Length,
            totalAmountPence);
    }

    public async Task<ExpenseDto> SaveExpenseAsync(
        Guid? id,
        SaveExpenseRequest request,
        CancellationToken cancellationToken)
    {
        var schedule = Schedule(request);
        if (id is null &&
            schedule.Frequency == ExpenseFrequency.Monthly &&
            schedule.ScheduleAnchorDate is null)
        {
            throw new DomainValidationException(
                "A new monthly expense requires a starting month.");
        }

        await ValidateReferencesAsync(
            request.AccountId,
            request.TagIds,
            request.ContributorShares.Select(share => share.ContributorId),
            cancellationToken);

        Expense expense;
        if (id is null)
        {
            expense = new Expense(
                plannerContext.PlannerId,
                request.Name,
                request.AmountPence,
                request.AccountId,
                schedule,
                request.TagIds,
                Shares(request.ContributorShares));
            dbContext.Expenses.Add(expense);
        }
        else
        {
            expense = await dbContext.Expenses
                .Include(item => item.Tags)
                .Include(item => item.ContributorShares)
                .SingleOrDefaultAsync(
                    item => item.Id == id && item.PlannerId == plannerContext.PlannerId,
                    cancellationToken) ?? throw new NotFoundException("The expense was not found.");
            if (schedule.Frequency == ExpenseFrequency.Monthly &&
                schedule.ScheduleAnchorDate is null &&
                (expense.Frequency != ExpenseFrequency.Monthly ||
                 expense.ScheduleAnchorDate is not null))
            {
                throw new DomainValidationException(
                    "Only a migrated historically active monthly expense can retain an empty starting month.");
            }

            expense.Update(
                request.Name,
                request.AmountPence,
                request.AccountId,
                schedule,
                request.TagIds,
                Shares(request.ContributorShares));
        }

        await SaveAndInvalidateAsync(cancellationToken);
        var nominalDate = ResponseNominalDate(expense.Schedule);
        var holidays = expense.MoveToNextWorkingDay
            ? await workingDayCalendar.GetHolidaysAsync(
                nominalDate.Year,
                nominalDate.Year + 1,
                cancellationToken)
            : new HashSet<DateOnly>();
        var account = await dbContext.Accounts.AsNoTracking()
            .SingleAsync(item => item.Id == expense.AccountId, cancellationToken);
        var occurrence = new ExpenseOccurrence(
            nominalDate,
            expense.MoveToNextWorkingDay
                ? MonthlySchedule.AdvanceToWorkingDay(nominalDate, holidays)
                : nominalDate);
        return MapExpense(
            expense,
            occurrence,
            new Dictionary<Guid, string> { [account.Id] = account.Name });
    }

    public async Task DeleteExpenseAsync(Guid id, CancellationToken cancellationToken)
    {
        var expense = await dbContext.Expenses.SingleOrDefaultAsync(
            item => item.Id == id && item.PlannerId == plannerContext.PlannerId,
            cancellationToken) ?? throw new NotFoundException("The expense was not found.");
        dbContext.Expenses.Remove(expense);
        await SaveAndInvalidateAsync(cancellationToken);
    }

    public async Task<IReadOnlyCollection<IncomeItemDto>> GetIncomeItemsAsync(
        string month,
        CancellationToken cancellationToken)
    {
        var (year, monthNumber) = ParseMonth(month);
        var plannerId = plannerContext.PlannerId;
        var accounts = await dbContext.Accounts.AsNoTracking()
            .Where(account => account.PlannerId == plannerId)
            .ToDictionaryAsync(account => account.Id, account => account.Name, cancellationToken);
        var holidays = await workingDayCalendar.GetHolidaysAsync(year, year + 1, cancellationToken);
        var items = await dbContext.IncomeItems.AsNoTracking()
            .Where(item => item.PlannerId == plannerId)
            .OrderBy(item => item.DayOfMonth)
            .ToArrayAsync(cancellationToken);
        return items.Select(item => new IncomeItemDto(
                item.Id,
                item.Name,
                item.AmountPence,
                item.AccountId,
                accounts[item.AccountId],
                item.DayOfMonth,
                MonthlySchedule.Resolve(
                    year,
                    monthNumber,
                    item.DayOfMonth,
                    item.MoveToNextWorkingDay,
                    holidays),
                item.MoveToNextWorkingDay))
            .ToArray();
    }

    public async Task<IncomeItemDto> SaveIncomeItemAsync(
        Guid? id,
        SaveIncomeItemRequest request,
        CancellationToken cancellationToken)
    {
        await ValidateReferencesAsync(request.AccountId, [], [], cancellationToken);
        IncomeItem item;
        if (id is null)
        {
            item = new IncomeItem(
                plannerContext.PlannerId,
                request.Name,
                request.AmountPence,
                request.AccountId,
                request.DayOfMonth,
                request.MoveToNextWorkingDay);
            dbContext.IncomeItems.Add(item);
        }
        else
        {
            item = await dbContext.IncomeItems.SingleOrDefaultAsync(
                value => value.Id == id && value.PlannerId == plannerContext.PlannerId,
                cancellationToken) ?? throw new NotFoundException("The income item was not found.");
            item.Update(
                request.Name,
                request.AmountPence,
                request.AccountId,
                request.DayOfMonth,
                request.MoveToNextWorkingDay);
        }

        await SaveAndInvalidateAsync(cancellationToken);
        var now = DateTimeOffset.UtcNow;
        var holidays = await workingDayCalendar.GetHolidaysAsync(now.Year, now.Year + 1, cancellationToken);
        var account = await dbContext.Accounts.AsNoTracking()
            .SingleAsync(value => value.Id == item.AccountId, cancellationToken);
        return new IncomeItemDto(
            item.Id,
            item.Name,
            item.AmountPence,
            item.AccountId,
            account.Name,
            item.DayOfMonth,
            MonthlySchedule.Resolve(now.Year, now.Month, item.DayOfMonth, item.MoveToNextWorkingDay, holidays),
            item.MoveToNextWorkingDay);
    }

    public async Task DeleteIncomeItemAsync(Guid id, CancellationToken cancellationToken)
    {
        var item = await dbContext.IncomeItems.SingleOrDefaultAsync(
            value => value.Id == id && value.PlannerId == plannerContext.PlannerId,
            cancellationToken) ?? throw new NotFoundException("The income item was not found.");
        dbContext.IncomeItems.Remove(item);
        await SaveAndInvalidateAsync(cancellationToken);
    }

    public async Task<BudgetTemplateDto> GetBudgetAsync(CancellationToken cancellationToken)
    {
        var budget = await dbContext.BudgetTemplates.AsNoTracking()
            .Include(item => item.Lines)
            .ThenInclude(line => line.ContributorShares)
            .SingleOrDefaultAsync(item => item.PlannerId == plannerContext.PlannerId, cancellationToken);
        return budget is null
            ? new BudgetTemplateDto(Guid.Empty, [])
            : MapBudget(budget);
    }

    public async Task<BudgetTemplateDto> ReplaceBudgetAsync(
        ReplaceBudgetRequest request,
        CancellationToken cancellationToken)
    {
        var tagIds = request.Lines.Select(line => line.TagId).ToArray();
        var contributorIds = request.Lines.SelectMany(line => line.ContributorShares)
            .Select(share => share.ContributorId)
            .ToArray();
        await ValidateReferencesAsync(null, tagIds, contributorIds, cancellationToken);

        var budget = await dbContext.BudgetTemplates
            .Include(item => item.Lines)
            .ThenInclude(line => line.ContributorShares)
            .SingleOrDefaultAsync(item => item.PlannerId == plannerContext.PlannerId, cancellationToken);
        var isNew = budget is null;
        if (budget is null)
        {
            budget = new BudgetTemplate(plannerContext.PlannerId);
        }

        var previousLines = budget.Lines.ToArray();
        budget.ReplaceLines(request.Lines.Select(line => new BudgetLineValue(
            line.Name,
            line.AllowancePence,
            line.TagId,
            Shares(line.ContributorShares))));
        if (isNew)
        {
            dbContext.BudgetTemplates.Add(budget);
        }
        else
        {
            var currentIds = budget.Lines.Select(line => line.Id).ToHashSet();
            var previousIds = previousLines.Select(line => line.Id).ToHashSet();
            dbContext.BudgetLines.RemoveRange(
                previousLines.Where(line => !currentIds.Contains(line.Id)));
            dbContext.BudgetLines.AddRange(
                budget.Lines.Where(line => !previousIds.Contains(line.Id)));
        }

        await SaveAndInvalidateAsync(cancellationToken);
        return MapBudget(budget);
    }

    private async Task ValidateReferencesAsync(
        Guid? accountId,
        IEnumerable<Guid> tagIds,
        IEnumerable<Guid> contributorIds,
        CancellationToken cancellationToken)
    {
        var plannerId = plannerContext.PlannerId;
        if (accountId.HasValue && !await dbContext.Accounts.AnyAsync(
                account => account.Id == accountId && account.PlannerId == plannerId && !account.IsArchived,
                cancellationToken))
        {
            throw new NotFoundException("The selected account was not found.");
        }

        var requestedTags = tagIds.Distinct().ToArray();
        if (requestedTags.Length > 0 &&
            await dbContext.Tags.CountAsync(
                tag => requestedTags.Contains(tag.Id) && tag.PlannerId == plannerId && !tag.IsArchived,
                cancellationToken) != requestedTags.Length)
        {
            throw new NotFoundException("One or more selected tags were not found.");
        }

        var requestedContributors = contributorIds.Distinct().ToArray();
        if (requestedContributors.Length > 0 &&
            await dbContext.Contributors.CountAsync(
                contributor => requestedContributors.Contains(contributor.Id) &&
                               contributor.PlannerId == plannerId &&
                               !contributor.IsArchived,
                cancellationToken) != requestedContributors.Length)
        {
            throw new NotFoundException("One or more selected contributors were not found.");
        }
    }

    private static ExpenseDto MapExpense(
        Expense expense,
        ExpenseOccurrence occurrence,
        IReadOnlyDictionary<Guid, string> accountNames,
        HashSet<Guid>? attributedContributors = null)
    {
        var shares = expense.ContributorShares
            .Select(share => new ContributorShareValue(share.ContributorId, share.BasisPoints))
            .ToArray();
        var allocations = ContributorSplit.AllocatePence(expense.AmountPence, shares);
        var attributedAmountPence = attributedContributors is { Count: > 0 }
            ? allocations
                .Where(allocation => attributedContributors.Contains(allocation.Key))
                .Sum(allocation => allocation.Value)
            : expense.AmountPence;
        return new ExpenseDto(
            expense.Id,
            expense.Name,
            expense.AmountPence,
            attributedAmountPence,
            expense.AccountId,
            accountNames.GetValueOrDefault(expense.AccountId, "Archived account"),
            FrequencyName(expense.Frequency),
            expense.ScheduleAnchorDate,
            expense.DayOfMonth,
            occurrence.NominalDate,
            occurrence.DueDate,
            expense.MoveToNextWorkingDay,
            expense.Tags.Select(tag => tag.TagId).ToArray(),
            shares.Select(share => new ContributorShareDto(
                share.ContributorId,
                share.BasisPoints,
                allocations[share.ContributorId])).ToArray());
    }

    private static ExpenseScheduleValue Schedule(SaveExpenseRequest request) =>
        new(
            ParseFrequency(request.Frequency),
            request.ScheduleAnchorDate,
            request.DayOfMonth,
            request.MoveToNextWorkingDay);

    private static ExpenseFrequency? ParseFrequency(string? value) =>
        value?.Trim().ToLowerInvariant() switch
        {
            null => null,
            "monthly" => ExpenseFrequency.Monthly,
            "weekly" => ExpenseFrequency.Weekly,
            _ => throw new DomainValidationException(
                "Expense frequency must be monthly, weekly, or null for a one-off."),
        };

    private static string? FrequencyName(ExpenseFrequency? value) =>
        value switch
        {
            null => null,
            ExpenseFrequency.Monthly => "monthly",
            ExpenseFrequency.Weekly => "weekly",
            _ => throw new InvalidOperationException(
                "The stored expense frequency is not supported."),
        };

    private static DateOnly ResponseNominalDate(ExpenseScheduleValue schedule)
    {
        if (schedule.Frequency is null or ExpenseFrequency.Weekly)
        {
            return schedule.ScheduleAnchorDate!.Value;
        }

        var reference = schedule.ScheduleAnchorDate ??
                        DateOnly.FromDateTime(DateTime.UtcNow);
        return ExpenseSchedule.ProjectNominalDates(
                schedule,
                reference.Year,
                reference.Month)
            .Single();
    }

    private static BudgetTemplateDto MapBudget(BudgetTemplate budget) =>
        new(
            budget.Id,
            budget.Lines.Select(line => new BudgetLineDto(
                line.Id,
                line.Name,
                line.AllowancePence,
                line.TagId,
                line.ContributorShares.Select(share =>
                    new ContributorShareDto(share.ContributorId, share.BasisPoints)).ToArray())).ToArray());

    private static ContributorShareValue[] Shares(
        IEnumerable<ContributorShareDto> shares) =>
        shares.Select(share => new ContributorShareValue(share.ContributorId, share.BasisPoints)).ToArray();

    private static (int Year, int Month) ParseMonth(string value)
    {
        if (!DateOnly.TryParseExact(
                $"{value}-01",
                "yyyy-MM-dd",
                null,
                System.Globalization.DateTimeStyles.None,
                out var parsed))
        {
            throw new ArgumentException("Month must use YYYY-MM format.", nameof(value));
        }

        return (parsed.Year, parsed.Month);
    }

    private async Task SaveAndInvalidateAsync(CancellationToken cancellationToken)
    {
        await dbContext.SaveChangesAsync(cancellationToken);
        await cache.InvalidateAsync(plannerContext.PlannerId, cancellationToken);
    }
}
