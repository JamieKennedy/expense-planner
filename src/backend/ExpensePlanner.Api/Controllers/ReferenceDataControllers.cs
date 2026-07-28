using ExpensePlanner.Application.Common;
using ExpensePlanner.Application.ReferenceData;
using Microsoft.AspNetCore.Mvc;

namespace ExpensePlanner.Api.Controllers;

[ApiController]
[Route("api/reference-data")]
public sealed class ReferenceDataController(IReferenceDataModule module) : ControllerBase
{
    [HttpGet]
    public Task<ReferenceDataSnapshot> Get(
        [FromQuery] bool includeArchived,
        CancellationToken cancellationToken) =>
        module.GetAsync(includeArchived, cancellationToken);
}

[ApiController]
[Route("api/accounts")]
public sealed class AccountsController(IReferenceDataModule module) : ControllerBase
{
    [HttpPost]
    public Task<ReferenceItemDto> Create(
        SaveNameRequest request,
        CancellationToken cancellationToken) =>
        module.SaveAccountAsync(null, request.Name, cancellationToken);

    [HttpPut("{id:guid}")]
    public Task<ReferenceItemDto> Update(
        Guid id,
        SaveNameRequest request,
        CancellationToken cancellationToken) =>
        module.SaveAccountAsync(id, request.Name, cancellationToken);

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Archive(Guid id, CancellationToken cancellationToken)
    {
        await module.ArchiveAsync(ReferenceDataKind.Account, id, cancellationToken);
        return NoContent();
    }
}

[ApiController]
[Route("api/contributors")]
public sealed class ContributorsController(IReferenceDataModule module) : ControllerBase
{
    [HttpPost]
    public Task<ReferenceItemDto> Create(
        SaveNameRequest request,
        CancellationToken cancellationToken) =>
        module.SaveContributorAsync(null, request.Name, cancellationToken);

    [HttpPut("{id:guid}")]
    public Task<ReferenceItemDto> Update(
        Guid id,
        SaveNameRequest request,
        CancellationToken cancellationToken) =>
        module.SaveContributorAsync(id, request.Name, cancellationToken);

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Archive(Guid id, CancellationToken cancellationToken)
    {
        await module.ArchiveAsync(ReferenceDataKind.Contributor, id, cancellationToken);
        return NoContent();
    }
}

[ApiController]
[Route("api/tags")]
public sealed class TagsController(IReferenceDataModule module) : ControllerBase
{
    [HttpPost]
    public Task<ReferenceItemDto> Create(
        SaveTagRequest request,
        CancellationToken cancellationToken) =>
        module.SaveTagAsync(null, request.Name, request.Colour, cancellationToken);

    [HttpPut("{id:guid}")]
    public Task<ReferenceItemDto> Update(
        Guid id,
        SaveTagRequest request,
        CancellationToken cancellationToken) =>
        module.SaveTagAsync(id, request.Name, request.Colour, cancellationToken);

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Archive(Guid id, CancellationToken cancellationToken)
    {
        await module.ArchiveAsync(ReferenceDataKind.Tag, id, cancellationToken);
        return NoContent();
    }
}

public sealed record SaveNameRequest(string Name);
public sealed record SaveTagRequest(string Name, string Colour);
