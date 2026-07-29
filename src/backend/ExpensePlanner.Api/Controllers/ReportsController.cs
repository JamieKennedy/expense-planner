using ExpensePlanner.Application.Reporting;
using Microsoft.AspNetCore.Mvc;

namespace ExpensePlanner.Api.Controllers;

[ApiController]
[Route("api/reports")]
public sealed class ReportsController(IMonthlyOverviewModule module) : ControllerBase
{
    [HttpGet("monthly-overview")]
    public Task<MonthlyOverviewDto> MonthlyOverview(
        [FromQuery] string month,
        CancellationToken cancellationToken) =>
        module.GetAsync(month, cancellationToken);
}
