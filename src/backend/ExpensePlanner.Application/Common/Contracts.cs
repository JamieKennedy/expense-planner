namespace ExpensePlanner.Application.Common;

public sealed record PagedResult<T>(
    IReadOnlyCollection<T> Items,
    int Page,
    int PageSize,
    int TotalCount);

public sealed record ReferenceItemDto(
    Guid Id,
    string Name,
    bool IsArchived,
    string? Colour = null);

public sealed class NotFoundException(string message) : Exception(message);

public sealed class ConflictException(string message) : Exception(message);

public sealed class ForbiddenException(string message) : Exception(message);
