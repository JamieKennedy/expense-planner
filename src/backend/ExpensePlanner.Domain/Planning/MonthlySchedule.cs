using ExpensePlanner.Domain.Common;

namespace ExpensePlanner.Domain.Planning;

public static class MonthlySchedule
{
    public static int ValidateDay(int dayOfMonth) =>
        dayOfMonth is < 1 or > 31
            ? throw new DomainValidationException("Day of month must be between 1 and 31.")
            : dayOfMonth;

    public static DateOnly Resolve(
        int year,
        int month,
        int dayOfMonth,
        bool moveToNextWorkingDay,
        IReadOnlySet<DateOnly> bankHolidays)
    {
        ValidateDay(dayOfMonth);
        var clampedDay = Math.Min(dayOfMonth, DateTime.DaysInMonth(year, month));
        var date = new DateOnly(year, month, clampedDay);

        if (!moveToNextWorkingDay)
        {
            return date;
        }

        return AdvanceToWorkingDay(date, bankHolidays);
    }

    public static DateOnly AdvanceToWorkingDay(
        DateOnly date,
        IReadOnlySet<DateOnly> bankHolidays)
    {
        while (!IsWorkingDay(date, bankHolidays))
        {
            date = date.AddDays(1);
        }

        return date;
    }

    public static bool IsWorkingDay(DateOnly date, IReadOnlySet<DateOnly> bankHolidays) =>
        date.DayOfWeek is not DayOfWeek.Saturday and not DayOfWeek.Sunday &&
        !bankHolidays.Contains(date);
}
