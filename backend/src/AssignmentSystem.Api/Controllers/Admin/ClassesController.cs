using AssignmentSystem.Application.Common.Models;
using AssignmentSystem.Application.Features.Admin.Academics;
using Microsoft.AspNetCore.Mvc;

namespace AssignmentSystem.Api.Controllers.Admin;

/// <summary>
/// Admin management of classes and courses. A "class" here covers both a school
/// section and a college course — see the README on the data model.
/// </summary>
[Route("api/v{version:apiVersion}/admin/classes")]
public sealed class ClassesController(IClassService classes) : AdminControllerBase
{
    /// <summary>Lists classes, with paging, search and filtering.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<PagedResult<ClassDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> List([FromQuery] ClassListQuery query, CancellationToken ct)
        => Ok(ApiResponse<PagedResult<ClassDto>>.Ok(await classes.ListAsync(query, ct)));

    /// <summary>Returns one class.</summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(ApiResponse<ClassDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Get(Guid id, CancellationToken ct)
        => Ok(ApiResponse<ClassDto>.Ok(await classes.GetAsync(id, ct)));

    /// <summary>Creates a class.</summary>
    [HttpPost]
    [ProducesResponseType(typeof(ApiResponse<ClassDto>), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Create(CreateClassRequest request, CancellationToken ct)
    {
        var created = await classes.CreateAsync(request, ct);

        return CreatedAtAction(nameof(Get), new { id = created.Id, version = "1.0" },
            ApiResponse<ClassDto>.Ok(created, "Class created."));
    }

    /// <summary>Updates a class.</summary>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(ApiResponse<ClassDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Update(Guid id, UpdateClassRequest request, CancellationToken ct)
        => Ok(ApiResponse<ClassDto>.Ok(await classes.UpdateAsync(id, request, ct), "Class updated."));

    /// <summary>Soft-deletes a class.</summary>
    /// <remarks>Refused while the class has subjects or enrolled students; deactivate it instead.</remarks>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await classes.DeleteAsync(id, ct);
        return Ok(ApiResponse.Ok("Class deleted."));
    }
}
