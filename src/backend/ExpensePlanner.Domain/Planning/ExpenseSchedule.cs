using ExpensePlanner.Domain.Common;

namespace ExpensePlanner.Domain.Planning;

public enum ExpenseFrequency
{
    Monthly,
    Weekly,
}

public sealed record ExpenseScheduleValue(
    ExpenseFrequency? Frequency,
    DateOnly? ScheduleAnchorDate,
    int? DayOfMonth,
    bool MoveToNextWorkingDay);

public sealed record ExpenseOccurrence(DateOnly NominalDate, DateOnly DueDate);

public static class ExpenseSchedule
{
    public static ExpenseScheduleValue Validate(ExpenseScheduleValue value)
    {
        switch (value.Frequency)
        {
            case null:
                if (value.ScheduleAnchorDate is null ||
                    value.DayOfMonth is not null ||
                    value.MoveToNextWorkingDay)
                {
                    throw new DomainValidationException(
                        "A one-off expense requires an exact date and cannot use recurring schedule options.");
                }

                break;
            case ExpenseFrequency.Monthly:
                if (value.DayOfMonth is null)
                {
                    throw new DomainValidationException(
                        "A monthly expense requires a day of month.");
                }

                MonthlySchedule.ValidateDay(value.DayOfMonth.Value);
                if (value.ScheduleAnchorDate is { Day: not 1 })
                {
                    throw new DomainValidationException(
                        "A monthly expense start must be the first day of a month.");
                }

                break;
            case ExpenseFrequency.Weekly:
                if (value.ScheduleAnchorDate is null || value.DayOfMonth is not null)
                {
                    throw new DomainValidationException(
                        "A weekly expense requires a first charge date and cannot use a day of month.");
                }

                break;
            default:
                throw new DomainValidationException("The expense frequency is not supported.");
        }

        return value;
    }

    public static IReadOnlyCollection<DateOnly> ProjectNominalDates(
        ExpenseScheduleValue schedule,
        int year,
        int month)
    {
        Validate(schedule);
        var monthStart = new DateOnly(year, month, 1);
        var monthEnd = monthStart.AddMonths(1).AddDays(-1);

        if (schedule.Frequency is null)
        {
            var occurrenceDate = schedule.ScheduleAnchorDate!.Value;
            return occurrenceDate.Year == year && occurrenceDate.Month == month
                ? [occurrenceDate]
                : [];
        }

        if (schedule.Frequency == ExpenseFrequency.Monthly)
        {
            if (schedule.ScheduleAnchorDate is { } startsOn &&
                startsOn > monthStart)
            {
                return [];
            }

            var day = Math.Min(schedule.DayOfMonth!.Value, monthEnd.Day);
            return [new DateOnly(year, month, day)];
        }

        var anchor = schedule.ScheduleAnchorDate!.Value;
        if (anchor > monthEnd)
        {
            return [];
        }

        var weekdayOffset =
            ((int)anchor.DayOfWeek - (int)monthStart.DayOfWeek + 7) % 7;
        var first = monthStart.AddDays(weekdayOffset);
        if (first < anchor)
        {
            var weeks = (anchor.DayNumber - first.DayNumber + 6) / 7;
            first = first.AddDays(weeks * 7);
        }

        var dates = new List<DateOnly>();
        for (var date = first; date <= monthEnd; date = date.AddDays(7))
        {
            dates.Add(date);
        }

        return dates;
    }

    public static IReadOnlyCollection<ExpenseOccurrence> Project(
        ExpenseScheduleValue schedule,
        int year,
        int month,
        IReadOnlySet<DateOnly> bankHolidays) =>
        ProjectNominalDates(schedule, year, month)
            .Select(date => new ExpenseOccurrence(
                date,
                schedule.MoveToNextWorkingDay
                    ? MonthlySchedule.AdvanceToWorkingDay(date, bankHolidays)
                    : date))
            .ToArray();
}
