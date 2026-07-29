using ExpensePlanner.Domain.Common;

namespace ExpensePlanner.Domain.Planning;

public abstract class Entity
{
    public Guid Id { get; protected set; } = Guid.NewGuid();
}

public abstract class PlannerOwnedEntity : Entity
{
    public Guid PlannerId { get; protected set; }
    public DateTimeOffset CreatedAtUtc { get; protected set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAtUtc { get; protected set; } = DateTimeOffset.UtcNow;

    protected void Touch() => UpdatedAtUtc = DateTimeOffset.UtcNow;
}

public sealed class Planner : Entity
{
    private Planner()
    {
    }

    public Planner(Guid id, string name)
    {
        Id = id;
        Name = RequiredName(name);
    }

    public string Name { get; private set; } = string.Empty;

    private static string RequiredName(string value) =>
        string.IsNullOrWhiteSpace(value)
            ? throw new DomainValidationException("A planner name is required.")
            : value.Trim();
}

public abstract class ReferenceData : PlannerOwnedEntity
{
    public string Name { get; protected set; } = string.Empty;
    public bool IsArchived { get; protected set; }

    protected void SetName(string value)
    {
        Name = string.IsNullOrWhiteSpace(value)
            ? throw new DomainValidationException("A name is required.")
            : value.Trim();
        Touch();
    }

    public virtual void Archive()
    {
        IsArchived = true;
        Touch();
    }
}

public sealed class Account : ReferenceData
{
    private Account()
    {
    }

    public Account(Guid plannerId, string name)
    {
        PlannerId = plannerId;
        SetName(name);
    }

    public void Rename(string name) => SetName(name);
}

public sealed class Contributor : ReferenceData
{
    private Contributor()
    {
    }

    public Contributor(Guid plannerId, string name, bool isOwner = false)
    {
        PlannerId = plannerId;
        IsOwner = isOwner;
        SetName(name);
    }

    public bool IsOwner { get; private set; }

    public void Rename(string name) => SetName(name);

    public override void Archive()
    {
        if (IsOwner)
        {
            throw new DomainValidationException("The planner owner contributor cannot be archived.");
        }

        base.Archive();
    }
}

public sealed class Tag : ReferenceData
{
    private Tag()
    {
    }

    public Tag(Guid plannerId, string name, string colour)
    {
        PlannerId = plannerId;
        SetName(name);
        SetColour(colour);
    }

    public string Colour { get; private set; } = "#64748b";

    public void Update(string name, string colour)
    {
        SetName(name);
        SetColour(colour);
    }

    private void SetColour(string colour)
    {
        if (colour.Length != 7 || colour[0] != '#' || !colour[1..].All(Uri.IsHexDigit))
        {
            throw new DomainValidationException("Tag colour must be a six-digit hex colour.");
        }

        Colour = colour.ToLowerInvariant();
        Touch();
    }
}

public sealed class Expense : PlannerOwnedEntity
{
    private readonly List<ExpenseTag> _tags = [];
    private readonly List<ExpenseContributorShare> _contributorShares = [];

    private Expense()
    {
    }

    public Expense(
        Guid plannerId,
        string name,
        long amountPence,
        Guid accountId,
        ExpenseScheduleValue schedule,
        IEnumerable<Guid> tagIds,
        IEnumerable<ContributorShareValue> shares)
    {
        PlannerId = plannerId;
        Update(name, amountPence, accountId, schedule, tagIds, shares);
    }

    public string Name { get; private set; } = string.Empty;
    public long AmountPence { get; private set; }
    public Guid AccountId { get; private set; }
    public ExpenseFrequency? Frequency { get; private set; }
    public DateOnly? ScheduleAnchorDate { get; private set; }
    public int? DayOfMonth { get; private set; }
    public bool MoveToNextWorkingDay { get; private set; }
    public IReadOnlyCollection<ExpenseTag> Tags => _tags;
    public IReadOnlyCollection<ExpenseContributorShare> ContributorShares => _contributorShares;

    public void Update(
        string name,
        long amountPence,
        Guid accountId,
        ExpenseScheduleValue schedule,
        IEnumerable<Guid> tagIds,
        IEnumerable<ContributorShareValue> shares)
    {
        Name = RequiredName(name);
        AmountPence = PositiveAmount(amountPence);
        AccountId = accountId;
        var validatedSchedule = ExpenseSchedule.Validate(schedule);
        Frequency = validatedSchedule.Frequency;
        ScheduleAnchorDate = validatedSchedule.ScheduleAnchorDate;
        DayOfMonth = validatedSchedule.DayOfMonth;
        MoveToNextWorkingDay = validatedSchedule.MoveToNextWorkingDay;

        var distinctTags = tagIds.Distinct().ToArray();
        if (distinctTags.Length == 0)
        {
            throw new DomainValidationException("An expense requires at least one tag.");
        }

        _tags.Clear();
        _tags.AddRange(distinctTags.Select(tagId => new ExpenseTag(Id, tagId)));

        var validatedShares = ContributorSplit.Validate(shares);
        _contributorShares.Clear();
        _contributorShares.AddRange(
            validatedShares.Select(share => new ExpenseContributorShare(Id, share.ContributorId, share.BasisPoints)));

        Touch();
    }

    public ExpenseScheduleValue Schedule => new(
        Frequency,
        ScheduleAnchorDate,
        DayOfMonth,
        MoveToNextWorkingDay);

    private static string RequiredName(string value) =>
        string.IsNullOrWhiteSpace(value)
            ? throw new DomainValidationException("An expense name is required.")
            : value.Trim();

    internal static long PositiveAmount(long amountPence) =>
        amountPence <= 0
            ? throw new DomainValidationException("Amount must be greater than zero.")
            : amountPence;
}

public sealed class ExpenseTag
{
    private ExpenseTag()
    {
    }

    public ExpenseTag(Guid expenseId, Guid tagId)
    {
        ExpenseId = expenseId;
        TagId = tagId;
    }

    public Guid ExpenseId { get; private set; }
    public Guid TagId { get; private set; }
}

public sealed class ExpenseContributorShare
{
    private ExpenseContributorShare()
    {
    }

    public ExpenseContributorShare(Guid expenseId, Guid contributorId, int basisPoints)
    {
        ExpenseId = expenseId;
        ContributorId = contributorId;
        BasisPoints = basisPoints;
    }

    public Guid ExpenseId { get; private set; }
    public Guid ContributorId { get; private set; }
    public int BasisPoints { get; private set; }
}

public sealed class IncomeItem : PlannerOwnedEntity
{
    private IncomeItem()
    {
    }

    public IncomeItem(
        Guid plannerId,
        string name,
        long amountPence,
        Guid accountId,
        int dayOfMonth,
        bool moveToNextWorkingDay)
    {
        PlannerId = plannerId;
        Update(name, amountPence, accountId, dayOfMonth, moveToNextWorkingDay);
    }

    public string Name { get; private set; } = string.Empty;
    public long AmountPence { get; private set; }
    public Guid AccountId { get; private set; }
    public int DayOfMonth { get; private set; }
    public bool MoveToNextWorkingDay { get; private set; }

    public void Update(
        string name,
        long amountPence,
        Guid accountId,
        int dayOfMonth,
        bool moveToNextWorkingDay)
    {
        Name = string.IsNullOrWhiteSpace(name)
            ? throw new DomainValidationException("An income name is required.")
            : name.Trim();
        AmountPence = Expense.PositiveAmount(amountPence);
        AccountId = accountId;
        DayOfMonth = MonthlySchedule.ValidateDay(dayOfMonth);
        MoveToNextWorkingDay = moveToNextWorkingDay;
        Touch();
    }
}

public sealed class BudgetTemplate : PlannerOwnedEntity
{
    private readonly List<BudgetLine> _lines = [];

    private BudgetTemplate()
    {
    }

    public BudgetTemplate(Guid plannerId)
    {
        PlannerId = plannerId;
    }

    public IReadOnlyCollection<BudgetLine> Lines => _lines;

    public void ReplaceLines(IEnumerable<BudgetLineValue> lines)
    {
        var values = lines.ToArray();
        if (values.Select(line => line.TagId).Distinct().Count() != values.Length)
        {
            throw new DomainValidationException("A budget can contain only one line for each tag.");
        }

        var requestedTags = values.Select(line => line.TagId).ToHashSet();
        _lines.RemoveAll(line => !requestedTags.Contains(line.TagId));
        foreach (var value in values)
        {
            var existing = _lines.SingleOrDefault(line => line.TagId == value.TagId);
            if (existing is null)
            {
                _lines.Add(new BudgetLine(
                    Id,
                    PlannerId,
                    value.Name,
                    value.AllowancePence,
                    value.TagId,
                    value.Shares));
            }
            else
            {
                existing.Update(value.Name, value.AllowancePence, value.Shares);
            }
        }

        Touch();
    }
}

public sealed class BudgetLine : PlannerOwnedEntity
{
    private readonly List<BudgetLineContributorShare> _contributorShares = [];

    private BudgetLine()
    {
    }

    internal BudgetLine(
        Guid budgetTemplateId,
        Guid plannerId,
        string name,
        long allowancePence,
        Guid tagId,
        IEnumerable<ContributorShareValue> shares)
    {
        BudgetTemplateId = budgetTemplateId;
        PlannerId = plannerId;
        TagId = tagId;
        Update(name, allowancePence, shares);
    }

    internal void Update(
        string name,
        long allowancePence,
        IEnumerable<ContributorShareValue> shares)
    {
        Name = string.IsNullOrWhiteSpace(name)
            ? throw new DomainValidationException("A budget line name is required.")
            : name.Trim();
        AllowancePence = Expense.PositiveAmount(allowancePence);
        var validatedShares = ContributorSplit.Validate(shares);
        var requestedContributors = validatedShares
            .Select(share => share.ContributorId)
            .ToHashSet();
        _contributorShares.RemoveAll(share =>
            !requestedContributors.Contains(share.ContributorId));
        foreach (var share in validatedShares)
        {
            var existing = _contributorShares.SingleOrDefault(item =>
                item.ContributorId == share.ContributorId);
            if (existing is null)
            {
                _contributorShares.Add(new BudgetLineContributorShare(
                    Id,
                    share.ContributorId,
                    share.BasisPoints));
            }
            else
            {
                existing.UpdateBasisPoints(share.BasisPoints);
            }
        }

        Touch();
    }

    public Guid BudgetTemplateId { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public long AllowancePence { get; private set; }
    public Guid TagId { get; private set; }
    public IReadOnlyCollection<BudgetLineContributorShare> ContributorShares => _contributorShares;
}

public sealed class BudgetLineContributorShare
{
    private BudgetLineContributorShare()
    {
    }

    public BudgetLineContributorShare(Guid budgetLineId, Guid contributorId, int basisPoints)
    {
        BudgetLineId = budgetLineId;
        ContributorId = contributorId;
        BasisPoints = basisPoints;
    }

    public Guid BudgetLineId { get; private set; }
    public Guid ContributorId { get; private set; }
    public int BasisPoints { get; private set; }

    internal void UpdateBasisPoints(int basisPoints) => BasisPoints = basisPoints;
}

public sealed class BankHoliday
{
    private BankHoliday()
    {
    }

    public BankHoliday(DateOnly date, string title)
    {
        Date = date;
        Title = title;
    }

    public DateOnly Date { get; private set; }
    public string Title { get; private set; } = string.Empty;
}

public sealed record ContributorShareValue(Guid ContributorId, int BasisPoints);

public sealed record BudgetLineValue(
    string Name,
    long AllowancePence,
    Guid TagId,
    IReadOnlyCollection<ContributorShareValue> Shares);
