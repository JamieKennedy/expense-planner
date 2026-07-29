using ExpensePlanner.Domain.Common;

namespace ExpensePlanner.Domain.Planning;

public static class ContributorSplit
{
    public const int TotalBasisPoints = 10_000;

    public static IReadOnlyList<ContributorShareValue> Even(IEnumerable<Guid> contributorIds)
    {
        var ids = contributorIds.Distinct().Order().ToArray();
        if (ids.Length == 0)
        {
            throw new DomainValidationException("At least one contributor is required.");
        }

        var quotient = TotalBasisPoints / ids.Length;
        var remainder = TotalBasisPoints % ids.Length;

        return ids
            .Select((id, index) => new ContributorShareValue(id, quotient + (index < remainder ? 1 : 0)))
            .ToArray();
    }

    public static IReadOnlyList<ContributorShareValue> Validate(IEnumerable<ContributorShareValue> shares)
    {
        var values = shares.ToArray();
        if (values.Length == 0)
        {
            throw new DomainValidationException("At least one contributor share is required.");
        }

        if (values.Select(value => value.ContributorId).Distinct().Count() != values.Length)
        {
            throw new DomainValidationException("A contributor can appear only once in a split.");
        }

        if (values.Any(value => value.BasisPoints <= 0) ||
            values.Sum(value => value.BasisPoints) != TotalBasisPoints)
        {
            throw new DomainValidationException("Contributor shares must be positive and total 10,000 basis points.");
        }

        return values;
    }

    public static IReadOnlyDictionary<Guid, long> AllocatePence(
        long amountPence,
        IEnumerable<ContributorShareValue> shares)
    {
        Expense.PositiveAmount(amountPence);
        var values = Validate(shares).OrderBy(value => value.ContributorId).ToArray();
        var allocated = new Dictionary<Guid, long>();
        long used = 0;

        foreach (var value in values)
        {
            var share = amountPence * value.BasisPoints / TotalBasisPoints;
            allocated[value.ContributorId] = share;
            used += share;
        }

        var remainder = amountPence - used;
        for (var index = 0; index < remainder; index++)
        {
            allocated[values[index % values.Length].ContributorId]++;
        }

        return allocated;
    }
}
