using ExpensePlanner.Application.Abstractions;
using ExpensePlanner.Application.Common;
using ExpensePlanner.Domain.Planning;
using Microsoft.EntityFrameworkCore;

namespace ExpensePlanner.Application.ReferenceData;

public interface IReferenceDataModule
{
    Task<ReferenceDataSnapshot> GetAsync(bool includeArchived, CancellationToken cancellationToken);
    Task<ReferenceItemDto> SaveAccountAsync(Guid? id, string name, CancellationToken cancellationToken);
    Task<ReferenceItemDto> SaveContributorAsync(Guid? id, string name, CancellationToken cancellationToken);
    Task<ReferenceItemDto> SaveTagAsync(Guid? id, string name, string colour, CancellationToken cancellationToken);
    Task ArchiveAsync(ReferenceDataKind kind, Guid id, CancellationToken cancellationToken);
}

public enum ReferenceDataKind
{
    Account,
    Contributor,
    Tag,
}

public sealed record ReferenceDataSnapshot(
    IReadOnlyCollection<ReferenceItemDto> Accounts,
    IReadOnlyCollection<ReferenceItemDto> Contributors,
    IReadOnlyCollection<ReferenceItemDto> Tags);

public sealed class ReferenceDataModule(
    IExpensePlannerDbContext dbContext,
    IPlannerContext plannerContext,
    IPlannerCache cache) : IReferenceDataModule
{
    public async Task<ReferenceDataSnapshot> GetAsync(
        bool includeArchived,
        CancellationToken cancellationToken)
    {
        var plannerId = plannerContext.PlannerId;
        var accounts = await dbContext.Accounts
            .AsNoTracking()
            .Where(item => item.PlannerId == plannerId && (includeArchived || !item.IsArchived))
            .OrderBy(item => item.Name)
            .Select(item => new ReferenceItemDto(item.Id, item.Name, item.IsArchived))
            .ToArrayAsync(cancellationToken);
        var contributors = await dbContext.Contributors
            .AsNoTracking()
            .Where(item => item.PlannerId == plannerId && (includeArchived || !item.IsArchived))
            .OrderBy(item => item.Name)
            .Select(item => new ReferenceItemDto(
                item.Id,
                item.Name,
                item.IsArchived,
                null,
                item.IsOwner))
            .ToArrayAsync(cancellationToken);
        var tags = await dbContext.Tags
            .AsNoTracking()
            .Where(item => item.PlannerId == plannerId && (includeArchived || !item.IsArchived))
            .OrderBy(item => item.Name)
            .Select(item => new ReferenceItemDto(item.Id, item.Name, item.IsArchived, item.Colour))
            .ToArrayAsync(cancellationToken);

        return new ReferenceDataSnapshot(accounts, contributors, tags);
    }

    public Task<ReferenceItemDto> SaveAccountAsync(
        Guid? id,
        string name,
        CancellationToken cancellationToken) =>
        SaveReferenceAsync(
            id,
            name,
            dbContext.Accounts,
            value => new Account(plannerContext.PlannerId, value),
            (item, value) => item.Rename(value),
            item => new ReferenceItemDto(item.Id, item.Name, item.IsArchived),
            cancellationToken);

    public Task<ReferenceItemDto> SaveContributorAsync(
        Guid? id,
        string name,
        CancellationToken cancellationToken) =>
        SaveReferenceAsync(
            id,
            name,
            dbContext.Contributors,
            value => new Contributor(plannerContext.PlannerId, value),
            (item, value) => item.Rename(value),
            item => new ReferenceItemDto(
                item.Id,
                item.Name,
                item.IsArchived,
                null,
                item.IsOwner),
            cancellationToken);

    public async Task<ReferenceItemDto> SaveTagAsync(
        Guid? id,
        string name,
        string colour,
        CancellationToken cancellationToken)
    {
        await EnsureUniqueNameAsync(dbContext.Tags, id, name, cancellationToken);
        Tag tag;
        if (id is null)
        {
            tag = new Tag(plannerContext.PlannerId, name, colour);
            dbContext.Tags.Add(tag);
        }
        else
        {
            tag = await Owned(dbContext.Tags, id.Value, cancellationToken);
            tag.Update(name, colour);
        }

        await SaveAndInvalidateAsync(cancellationToken);
        return new ReferenceItemDto(tag.Id, tag.Name, tag.IsArchived, tag.Colour);
    }

    public async Task ArchiveAsync(
        ReferenceDataKind kind,
        Guid id,
        CancellationToken cancellationToken)
    {
        switch (kind)
        {
            case ReferenceDataKind.Account:
                (await Owned(dbContext.Accounts, id, cancellationToken)).Archive();
                break;
            case ReferenceDataKind.Contributor:
                (await Owned(dbContext.Contributors, id, cancellationToken)).Archive();
                break;
            case ReferenceDataKind.Tag:
                (await Owned(dbContext.Tags, id, cancellationToken)).Archive();
                break;
            default:
                throw new ArgumentOutOfRangeException(nameof(kind), kind, null);
        }

        await SaveAndInvalidateAsync(cancellationToken);
    }

    private async Task<ReferenceItemDto> SaveReferenceAsync<T>(
        Guid? id,
        string name,
        DbSet<T> set,
        Func<string, T> create,
        Action<T, string> update,
        Func<T, ReferenceItemDto> map,
        CancellationToken cancellationToken)
        where T : Domain.Planning.ReferenceData
    {
        await EnsureUniqueNameAsync(set, id, name, cancellationToken);
        T item;
        if (id is null)
        {
            item = create(name);
            set.Add(item);
        }
        else
        {
            item = await Owned(set, id.Value, cancellationToken);
            update(item, name);
        }

        await SaveAndInvalidateAsync(cancellationToken);
        return map(item);
    }

    private async Task EnsureUniqueNameAsync<T>(
        DbSet<T> set,
        Guid? id,
        string name,
        CancellationToken cancellationToken)
        where T : Domain.Planning.ReferenceData
    {
        var normalized = name.Trim();
        if (await set.AnyAsync(
                item => item.PlannerId == plannerContext.PlannerId &&
                        item.Id != id &&
                        item.Name == normalized,
                cancellationToken))
        {
            throw new ConflictException($"'{name}' already exists.");
        }
    }

    private async Task<T> Owned<T>(DbSet<T> set, Guid id, CancellationToken cancellationToken)
        where T : PlannerOwnedEntity =>
        await set.SingleOrDefaultAsync(
            item => item.Id == id && item.PlannerId == plannerContext.PlannerId,
            cancellationToken) ?? throw new NotFoundException("The requested item was not found.");

    private async Task SaveAndInvalidateAsync(CancellationToken cancellationToken)
    {
        await dbContext.SaveChangesAsync(cancellationToken);
        await cache.InvalidateAsync(plannerContext.PlannerId, cancellationToken);
    }
}
