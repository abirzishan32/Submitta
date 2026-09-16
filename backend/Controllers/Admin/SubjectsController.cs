using AssignmentSystem.Application.Common.Models;
using AssignmentSystem.Application.Features.Admin.Academics;
using Microsoft.AspNetCore.Mvc;

namespace AssignmentSystem.Api.Controllers.Admin;

/// <summary>Admin management of subjects.</summary>
[Route("api/v{version:apiVersion}/admin/subjects")]
public sealed class SubjectsController(ISubjectService subjects) : AdminControllerBase
{
    /// <summary>Lists subjects, with paging, search and filtering.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<PagedResult<SubjectDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> List([FromQuery] SubjectListQuery query, CancellationToken ct)
        => Ok(ApiResponse<PagedResult<SubjectDto>>.Ok(await subjects.ListAsync(query, ct)));

    /// <summary>Returns one subject.</summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(ApiResponse<SubjectDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Get(Guid id, CancellationToken ct)
        => Ok(ApiResponse<SubjectDto>.Ok(await subjects.GetAsync(id, ct)));

    /// <summary>Creates a subject.</summary>
    [HttpPost]
    [ProducesResponseType(typeof(ApiResponse<SubjectDto>), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Create(CreateSubjectRequest request, CancellationToken ct)
    {
        var created = await subjects.CreateAsync(request, ct);

        return CreatedAtAction(nameof(Get), new { id = created.Id, version = "1.0" },
            ApiResponse<SubjectDto>.Ok(created, "Subject created."));
    }

    /// <summary>Updates a subject.</summary>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(ApiResponse<SubjectDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Update(Guid id, UpdateSubjectRequest request, CancellationToken ct)
        => Ok(ApiResponse<SubjectDto>.Ok(await subjects.UpdateAsync(id, request, ct), "Subject updated."));

    /// <summary>Soft-deletes a subject.</summary>
    /// <remarks>Refused while the subject is offered to any class; deactivate it instead.</remarks>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await subjects.DeleteAsync(id, ct);
        return Ok(ApiResponse.Ok("Subject deleted."));
    }
}
