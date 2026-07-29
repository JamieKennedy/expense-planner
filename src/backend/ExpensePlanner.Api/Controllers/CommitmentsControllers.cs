using ExpensePlanner.Application.Commitments;
using Microsoft.AspNetCore.Mvc;

namespace ExpensePlanner.Api.Controllers;

[ApiController]
[Route("api/expenses")]
public sealed class ExpensesController(ICommitmentsModule module) : ControllerBase
{
    [HttpGet]
    public Task<ExpensePageDto> Get(
        [FromQuery] string month,
        [FromQuery] Guid[]? accountIds,
        [FromQuery] Guid[]? tagIds,
        [FromQuery] Guid[]? contributorIds,
        [FromQuery] string? search,
        [FromQuery] string sort = "dueDate",
        [FromQuery] bool descending = false,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25,
        CancellationToken cancellationToken = default) =>
        module.GetExpensesAsync(
            new ExpenseQuery(
                month,
                accountIds,
                tagIds,
                contributorIds,
                search,
                sort,
                descending,
                page,
                pageSize),
            cancellationToken);

    [HttpPost]
    public Task<ExpenseDto> Create(SaveExpenseRequest request, CancellationToken cancellationToken) =>
        module.SaveExpenseAsync(null, request, cancellationToken);

    [HttpPut("{id:guid}")]
    public Task<ExpenseDto> Update(
        Guid id,
        SaveExpenseRequest request,
        CancellationToken cancellationToken) =>
        module.SaveExpenseAsync(id, request, cancellationToken);

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        await module.DeleteExpenseAsync(id, cancellationToken);
        return NoContent();
    }
}

[ApiController]
[Route("api/income-items")]
public sealed class IncomeItemsController(ICommitmentsModule module) : ControllerBase
{
    [HttpGet]
    public Task<IReadOnlyCollection<IncomeItemDto>> Get(
        [FromQuery] string month,
        CancellationToken cancellationToken) =>
        module.GetIncomeItemsAsync(month, cancellationToken);

    [HttpPost]
    public Task<IncomeItemDto> Create(
        SaveIncomeItemRequest request,
        CancellationToken cancellationToken) =>
        module.SaveIncomeItemAsync(null, request, cancellationToken);

    [HttpPut("{id:guid}")]
    public Task<IncomeItemDto> Update(
        Guid id,
        SaveIncomeItemRequest request,
        CancellationToken cancellationToken) =>
        module.SaveIncomeItemAsync(id, request, cancellationToken);

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        await module.DeleteIncomeItemAsync(id, cancellationToken);
        return NoContent();
    }
}

[ApiController]
[Route("api/budget-template")]
public sealed class BudgetTemplateController(ICommitmentsModule module) : ControllerBase
{
    [HttpGet]
    public Task<BudgetTemplateDto> Get(CancellationToken cancellationToken) =>
        module.GetBudgetAsync(cancellationToken);

    [HttpPut]
    public Task<BudgetTemplateDto> Replace(
        ReplaceBudgetRequest request,
        CancellationToken cancellationToken) =>
        module.ReplaceBudgetAsync(request, cancellationToken);
}
