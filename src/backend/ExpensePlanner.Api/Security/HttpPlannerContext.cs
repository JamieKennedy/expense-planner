using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using ExpensePlanner.Application.Abstractions;

namespace ExpensePlanner.Api.Security;

public sealed class HttpPlannerContext(IHttpContextAccessor httpContextAccessor) : IPlannerContext
{
    public Guid PlannerId => ClaimGuid("planner_id");
    public Guid UserId => ClaimGuid(JwtRegisteredClaimNames.Sub, ClaimTypes.NameIdentifier);

    private Guid ClaimGuid(params string[] claimTypes)
    {
        var principal = httpContextAccessor.HttpContext?.User
            ?? throw new InvalidOperationException("No HTTP user is available.");
        var value = claimTypes.Select(principal.FindFirstValue).FirstOrDefault(item => item is not null);
        return Guid.TryParse(value, out var id)
            ? id
            : throw new InvalidOperationException($"Required claim '{claimTypes[0]}' is missing.");
    }
}
