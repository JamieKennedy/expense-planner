using System.Globalization;
using System.Net.Http.Json;
using System.Text.Json.Serialization;
using ExpensePlanner.Application.Abstractions;
using ExpensePlanner.Domain.Planning;
using ExpensePlanner.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Distributed;

namespace ExpensePlanner.Infrastructure.Calendars;

public sealed class CalendarUnavailableException(string message, Exception? innerException = null)
    : Exception(message, innerException);

public sealed class GovUkWorkingDayCalendar(
    ExpensePlannerDbContext dbContext,
    IDistributedCache cache,
    IHttpClientFactory httpClientFactory) : IWorkingDayCalendar
{
    public async Task<IReadOnlySet<DateOnly>> GetHolidaysAsync(
        int fromYear,
        int toYear,
        CancellationToken cancellationToken)
    {
        var cacheKey = $"bank-holidays:england-wales:{fromYear}:{toYear}";
        try
        {
            var cached = await cache.GetStringAsync(cacheKey, cancellationToken);
            if (!string.IsNullOrWhiteSpace(cached))
            {
                return cached.Split(',', StringSplitOptions.RemoveEmptyEntries)
                    .Select(DateOnly.Parse)
                    .ToHashSet();
            }
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            _ = exception;
        }

        var dates = await LoadFromDatabaseAsync(fromYear, toYear, cancellationToken);
        if (!CoversYears(dates, fromYear, toYear))
        {
            await RefreshAsync(cancellationToken);
            dates = await LoadFromDatabaseAsync(fromYear, toYear, cancellationToken);
        }

        if (!CoversYears(dates, fromYear, toYear))
        {
            throw new CalendarUnavailableException(
                $"Bank-holiday data is unavailable for {fromYear}–{toYear}.");
        }

        try
        {
            await cache.SetStringAsync(
                cacheKey,
                string.Join(',', dates.Order()),
                new DistributedCacheEntryOptions { AbsoluteExpirationRelativeToNow = TimeSpan.FromHours(24) },
                cancellationToken);
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            _ = exception;
        }

        return dates;
    }

    public async Task<int> RefreshAsync(CancellationToken cancellationToken)
    {
        GovUkHolidayResponse response;
        try
        {
            var client = httpClientFactory.CreateClient("gov-uk-bank-holidays");
            response = await client.GetFromJsonAsync<GovUkHolidayResponse>(
                "bank-holidays.json",
                cancellationToken) ?? throw new CalendarUnavailableException("GOV.UK returned no holiday data.");
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            throw new CalendarUnavailableException("Unable to refresh bank holidays from GOV.UK.", exception);
        }

        var incoming = response.EnglandAndWales.Events
            .Select(item => new BankHoliday(
                DateOnly.ParseExact(item.Date, "yyyy-MM-dd", CultureInfo.InvariantCulture),
                item.Title))
            .ToArray();
        var existing = await dbContext.BankHolidays.ToDictionaryAsync(item => item.Date, cancellationToken);
        foreach (var holiday in incoming.Where(holiday => !existing.ContainsKey(holiday.Date)))
        {
            dbContext.BankHolidays.Add(holiday);
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        return incoming.Length;
    }

    private async Task<HashSet<DateOnly>> LoadFromDatabaseAsync(
        int fromYear,
        int toYear,
        CancellationToken cancellationToken)
    {
        var from = new DateOnly(fromYear, 1, 1);
        var to = new DateOnly(toYear, 12, 31);
        return (await dbContext.BankHolidays.AsNoTracking()
                .Where(item => item.Date >= from && item.Date <= to)
                .Select(item => item.Date)
                .ToArrayAsync(cancellationToken))
            .ToHashSet();
    }

    private static bool CoversYears(IReadOnlySet<DateOnly> dates, int fromYear, int toYear) =>
        Enumerable.Range(fromYear, toYear - fromYear + 1)
            .All(year => dates.Any(date => date.Year == year));

    private sealed record GovUkHolidayResponse(
        [property: JsonPropertyName("england-and-wales")] GovUkDivision EnglandAndWales);

    private sealed record GovUkDivision(
        [property: JsonPropertyName("events")] IReadOnlyCollection<GovUkHoliday> Events);

    private sealed record GovUkHoliday(
        [property: JsonPropertyName("title")] string Title,
        [property: JsonPropertyName("date")] string Date);
}
