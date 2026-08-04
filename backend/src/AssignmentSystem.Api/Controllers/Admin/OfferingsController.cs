using AssignmentSystem.Application.Common.Models;
using AssignmentSystem.Application.Features.Admin.Academics;
using Microsoft.AspNetCore.Mvc;

namespace AssignmentSystem.Api.Controllers.Admin;

/// <summary>
/// Class-subject offerings, and the teachers assigned to them.
///
/// An offering is one subject taught to one class. Assignments belong to an
/// offering, and a teacher's permissions come from being assigned to it — so
/// this is where "assign teachers to subjects/classes" is carried out.
/// </summary>
[Route("api/v{version:apiVersion}/admin/offerings")]
public sealed class OfferingsController(IOfferingService offerings) : AdminControllerBase
{
    /// <summary>Lists offerings with their assigned teachers.</summary>
    /// <remarks>Filter by classId, subjectId or teacherId; search matches class and subject names and codes.</remarks>
    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<PagedResult<OfferingDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> List([FromQuery] OfferingListQuery query, CancellationToken ct)
        => Ok(ApiResponse<PagedResult<OfferingDto>>.Ok(await offerings.ListAsync(query, ct)));

    /// <summary>Returns one offering.</summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(ApiResponse<OfferingDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Get(Guid id, CancellationToken ct)
        => Ok(ApiResponse<OfferingDto>.Ok(await offerings.GetAsync(id, ct)));

    /// <summary>Offers a subject to a class.</summary>
    /// <response code="409">This subject is already offered to this class.</response>
    [HttpPost]
    [ProducesResponseType(typeof(ApiResponse<OfferingDto>), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Create(CreateOfferingRequest request, CancellationToken ct)
    {
        var created = await offerings.CreateAsync(request, ct);

        return CreatedAtAction(nameof(Get), new { id = created.Id, version = "1.0" },
            ApiResponse<OfferingDto>.Ok(created, "Subject added to class."));
    }

    /// <summary>Removes an offering.</summary>
    /// <remarks>Refused once assignments exist for it, since their submissions would be stranded.</remarks>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await offerings.DeleteAsync(id, ct);
        return Ok(ApiResponse.Ok("Offering removed."));
    }

    /// <summary>Assigns a teacher to an offering, granting them access to it.</summary>
    /// <remarks>
    /// The account must belong to an active Teacher. This is what lets that
    /// teacher create assignments for the class and grade its submissions.
    /// </remarks>
    /// <response code="422">The account is not a teacher, or is deactivated.</response>
    [HttpPost("teachers")]
    [ProducesResponseType(typeof(ApiResponse<OfferingDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status409Conflict)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> AssignTeacher(AssignTeacherRequest request, CancellationToken ct)
        => Ok(ApiResponse<OfferingDto>.Ok(
            await offerings.AssignTeacherAsync(request, ct), "Teacher assigned."));

    /// <summary>Removes a teacher from an offering.</summary>
    /// <remarks>Assignments they authored remain; they simply lose access to the class.</remarks>
    [HttpDelete("teachers/{teacherAssignmentId:guid}")]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> RemoveTeacher(Guid teacherAssignmentId, CancellationToken ct)
    {
        await offerings.RemoveTeacherAsync(teacherAssignmentId, ct);
        return Ok(ApiResponse.Ok("Teacher unassigned."));
    }
}
