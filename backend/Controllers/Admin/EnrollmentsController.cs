using AssignmentSystem.Application.Common.Models;
using AssignmentSystem.Application.Features.Admin.Academics;
using Microsoft.AspNetCore.Mvc;

namespace AssignmentSystem.Api.Controllers.Admin;

/// <summary>
/// Student enrolments. Enrolment is what makes a class's published assignments
/// visible to a student, so this controls who can see what.
/// </summary>
[Route("api/v{version:apiVersion}/admin/enrollments")]
public sealed class EnrollmentsController(IEnrollmentService enrollments) : AdminControllerBase
{
    /// <summary>Lists enrolments, filterable by class or student.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<PagedResult<EnrollmentDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> List([FromQuery] EnrollmentListQuery query, CancellationToken ct)
        => Ok(ApiResponse<PagedResult<EnrollmentDto>>.Ok(await enrollments.ListAsync(query, ct)));

    /// <summary>Enrols a student in a class.</summary>
    /// <response code="409">Already enrolled.</response>
    /// <response code="422">The account is not a student, or is deactivated.</response>
    [HttpPost]
    [ProducesResponseType(typeof(ApiResponse<EnrollmentDto>), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status409Conflict)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> Create(CreateEnrollmentRequest request, CancellationToken ct)
    {
        var created = await enrollments.CreateAsync(request, ct);
        return StatusCode(StatusCodes.Status201Created,
            ApiResponse<EnrollmentDto>.Ok(created, "Student enrolled."));
    }

    /// <summary>Enrols several students in one class.</summary>
    /// <remarks>
    /// Students already enrolled are skipped rather than rejected, so re-running
    /// after adding one name still works. Returns only the enrolments created.
    /// </remarks>
    [HttpPost("bulk")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<EnrollmentDto>>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> BulkEnroll(BulkEnrollRequest request, CancellationToken ct)
    {
        var created = await enrollments.BulkEnrollAsync(request, ct);

        return Ok(ApiResponse<IReadOnlyList<EnrollmentDto>>.Ok(created,
            created.Count == 0
                ? "All selected students were already enrolled."
                : $"{created.Count} student(s) enrolled."));
    }

    /// <summary>Removes an enrolment.</summary>
    /// <remarks>Refused once the student has submitted work for the class.</remarks>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await enrollments.DeleteAsync(id, ct);
        return Ok(ApiResponse.Ok("Enrolment removed."));
    }
}
