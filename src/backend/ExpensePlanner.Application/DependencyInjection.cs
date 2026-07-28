using ExpensePlanner.Application.Commitments;
using ExpensePlanner.Application.ReferenceData;
using ExpensePlanner.Application.Reporting;
using Microsoft.Extensions.DependencyInjection;

namespace ExpensePlanner.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddScoped<IReferenceDataModule, ReferenceDataModule>();
        services.AddScoped<ICommitmentsModule, CommitmentsModule>();
        services.AddScoped<IMonthlyOverviewModule, MonthlyOverviewModule>();
        return services;
    }
}
