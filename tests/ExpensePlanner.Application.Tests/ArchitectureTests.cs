using ExpensePlanner.Application.Reporting;

namespace ExpensePlanner.Application.Tests;

public sealed class ArchitectureTests
{
    [Fact]
    public void Application_does_not_reference_api_or_infrastructure()
    {
        var references = typeof(IMonthlyOverviewModule).Assembly
            .GetReferencedAssemblies()
            .Select(assembly => assembly.Name)
            .ToArray();

        Assert.DoesNotContain("ExpensePlanner.Api", references);
        Assert.DoesNotContain("ExpensePlanner.Infrastructure", references);
    }
}
