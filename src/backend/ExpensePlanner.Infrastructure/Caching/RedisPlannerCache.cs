using System.Text.Json;
using ExpensePlanner.Application.Abstractions;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Logging;

namespace ExpensePlanner.Infrastructure.Caching;

public sealed class RedisPlannerCache(
    IDistributedCache cache,
    ILogger<RedisPlannerCache> logger) : IPlannerCache
{
    private static readonly Action<ILogger, string, Exception?> ReadFailed =
        LoggerMessage.Define<string>(
            LogLevel.Warning,
            new EventId(1001, nameof(ReadFailed)),
            "Redis read failed for {CacheKey}; continuing without cache.");

    private static readonly Action<ILogger, string, Exception?> WriteFailed =
        LoggerMessage.Define<string>(
            LogLevel.Warning,
            new EventId(1002, nameof(WriteFailed)),
            "Redis write failed for {CacheKey}; continuing without cache.");

    public async Task<T> GetOrCreateAsync<T>(
        Guid plannerId,
        string key,
        TimeSpan lifetime,
        Func<CancellationToken, Task<T>> factory,
        CancellationToken cancellationToken)
    {
        var generation = await TryGetGenerationAsync(plannerId, cancellationToken);
        var cacheKey = $"planner:{plannerId:N}:g{generation}:{key}";
        var cached = await TryGetAsync(cacheKey, cancellationToken);
        if (cached is not null)
        {
            var value = JsonSerializer.Deserialize<T>(cached);
            if (value is not null)
            {
                return value;
            }
        }

        var created = await factory(cancellationToken);
        await TrySetAsync(
            cacheKey,
            JsonSerializer.Serialize(created),
            new DistributedCacheEntryOptions { AbsoluteExpirationRelativeToNow = lifetime },
            cancellationToken);
        return created;
    }

    public async Task InvalidateAsync(Guid plannerId, CancellationToken cancellationToken)
    {
        var key = GenerationKey(plannerId);
        var current = await TryGetGenerationAsync(plannerId, cancellationToken);
        await TrySetAsync(
            key,
            (current + 1).ToString(System.Globalization.CultureInfo.InvariantCulture),
            new DistributedCacheEntryOptions(),
            cancellationToken);
    }

    private async Task<long> TryGetGenerationAsync(Guid plannerId, CancellationToken cancellationToken)
    {
        var value = await TryGetAsync(GenerationKey(plannerId), cancellationToken);
        return long.TryParse(value, out var generation) ? generation : 0;
    }

    private async Task<string?> TryGetAsync(string key, CancellationToken cancellationToken)
    {
        try
        {
            return await cache.GetStringAsync(key, cancellationToken);
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            ReadFailed(logger, key, exception);
            return null;
        }
    }

    private async Task TrySetAsync(
        string key,
        string value,
        DistributedCacheEntryOptions options,
        CancellationToken cancellationToken)
    {
        try
        {
            await cache.SetStringAsync(key, value, options, cancellationToken);
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            WriteFailed(logger, key, exception);
        }
    }

    private static string GenerationKey(Guid plannerId) => $"planner:{plannerId:N}:generation";
}
