using Asp.Versioning;
using AssignmentSystem.Api.Configuration;
using AssignmentSystem.Application.Common.Models;
using AssignmentSystem.Application.Features.Teacher.Assignments;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AssignmentSystem.Api.Controllers;

/// <summary>
/// Assignment management for teachers.
///
/// Results are scoped to offerings the caller teaches; an Admin sees everything.
/// The scoping happens in the query itself, so another teacher's assignments are
/// never selected rather than merely filtered from the response.
/// </summary>
[ApiController]
[ApiVersion("1.0")]
[Authorize(Policy = Policies.AdminOrTeacher)]
[Route("api/v{version:apiVersion}/assignments")]
[Produces("application/json")]
public sealed class AssignmentsController(
    IAssignmentService assignments,
    IAttachmentService attachments) : ControllerBase
{
    /// <summary>Lists the class-subject offerings you may create assignments for.</summary>
    /// <remarks>
    /// A teacher gets their own offerings, an admin gets all of them. This backs
    /// the class/subject picker — the admin offerings endpoint is not reachable
    /// by a teacher.
    /// </remarks>
    [HttpGet("offerings")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<OfferingOptionDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> MyOfferings(CancellationToken ct)
        => Ok(ApiResponse<IReadOnlyList<OfferingOptionDto>>.Ok(
            await assignments.ListMyOfferingsAsync(ct)));

    /// <summary>Lists assignments, with paging, search and filtering.</summary>
    /// <remarks>
    /// Filter by classSubjectId, classId, subjectId, status or pastDeadline.
    /// Sort by title, deadline, maxMarks, status or createdAt.
    /// </remarks>
    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<PagedResult<AssignmentDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> List([FromQuery] AssignmentListQuery query, CancellationToken ct)
        => Ok(ApiResponse<PagedResult<AssignmentDto>>.Ok(await assignments.ListAsync(query, ct)));

    /// <summary>Returns one assignment in full.</summary>
    /// <response code="404">Not found, or it belongs to a class you do not teach.</response>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(ApiResponse<AssignmentDetailDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Get(Guid id, CancellationToken ct)
        => Ok(ApiResponse<AssignmentDetailDto>.Ok(await assignments.GetAsync(id, ct)));

    /// <summary>Creates an assignment, as a draft or published immediately.</summary>
    /// <remarks>
    /// Publishing requires a deadline in the future. A draft may carry any date,
    /// since it is not yet visible to students.
    /// </remarks>
    /// <response code="403">You are not assigned to this class and subject.</response>
    /// <response code="422">The deadline has already passed and publishing was requested.</response>
    [HttpPost]
    [ProducesResponseType(typeof(ApiResponse<AssignmentDetailDto>), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> Create(CreateAssignmentRequest request, CancellationToken ct)
    {
        var created = await assignments.CreateAsync(request, ct);

        return CreatedAtAction(nameof(Get), new { id = created.Id, version = "1.0" },
            ApiResponse<AssignmentDetailDto>.Ok(created,
                created.Status == Domain.Enums.AssignmentStatus.Published
                    ? "Assignment published."
                    : "Draft saved."));
    }

    /// <summary>Updates an assignment.</summary>
    /// <remarks>
    /// Maximum marks cannot be lowered below marks already awarded, and a
    /// published deadline cannot be moved into the past.
    /// </remarks>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(ApiResponse<AssignmentDetailDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> Update(
        Guid id, UpdateAssignmentRequest request, CancellationToken ct)
        => Ok(ApiResponse<AssignmentDetailDto>.Ok(
            await assignments.UpdateAsync(id, request, ct), "Assignment updated."));

    /// <summary>Publishes a draft, making it visible to enrolled students.</summary>
    /// <response code="422">Already published, or the deadline has passed.</response>
    [HttpPost("{id:guid}/publish")]
    [ProducesResponseType(typeof(ApiResponse<AssignmentDetailDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> Publish(Guid id, CancellationToken ct)
        => Ok(ApiResponse<AssignmentDetailDto>.Ok(
            await assignments.PublishAsync(id, ct), "Assignment published."));

    /// <summary>Returns a published assignment to draft.</summary>
    /// <response code="409">Students have already submitted; archive it instead.</response>
    [HttpPost("{id:guid}/unpublish")]
    [ProducesResponseType(typeof(ApiResponse<AssignmentDetailDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Unpublish(Guid id, CancellationToken ct)
        => Ok(ApiResponse<AssignmentDetailDto>.Ok(
            await assignments.UnpublishAsync(id, ct), "Assignment returned to draft."));

    /// <summary>Archives an assignment, withdrawing it while keeping its submissions.</summary>
    [HttpPost("{id:guid}/archive")]
    [ProducesResponseType(typeof(ApiResponse<AssignmentDetailDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Archive(Guid id, CancellationToken ct)
        => Ok(ApiResponse<AssignmentDetailDto>.Ok(
            await assignments.ArchiveAsync(id, ct), "Assignment archived."));

    /// <summary>Soft-deletes an assignment.</summary>
    /// <response code="409">Students have already submitted; archive it instead.</response>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await assignments.DeleteAsync(id, ct);
        return Ok(ApiResponse.Ok("Assignment deleted."));
    }

    // -----------------------------------------------------------------------
    // Attachments — the question paper, when a teacher would rather upload than
    // type. Multipart rather than JSON, so a PDF is not base64-inflated by a
    // third on the way up.
    // -----------------------------------------------------------------------

    /// <summary>Attaches a PDF to an assignment.</summary>
    /// <remarks>
    /// PDF only, verified by reading the file's first bytes rather than trusting
    /// the declared content type or the extension — both come from the caller.
    /// Capped at 10 MB and 5 files per assignment.
    /// </remarks>
    /// <response code="200">Stored.</response>
    /// <response code="422">Not a PDF, too large, or the assignment is full.</response>
    [HttpPost("{id:guid}/attachments")]
    [RequestSizeLimit(AttachmentService.MaxSizeBytes + 4096)]
    [ProducesResponseType(typeof(ApiResponse<AttachmentDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> Upload(Guid id, IFormFile file, CancellationToken ct)
    {
        if (file is null || file.Length == 0)
        {
            return BadRequest(ApiResponse.Fail("Choose a PDF to upload."));
        }

        if (file.Length > AttachmentService.MaxSizeBytes)
        {
            // Checked before reading, so an oversized file is refused rather
            // than buffered into memory first.
            return UnprocessableEntity(ApiResponse.Fail(
                $"That file is larger than the {AttachmentService.MaxSizeBytes / 1024 / 1024} MB limit."));
        }

        using var buffer = new MemoryStream();
        await file.CopyToAsync(buffer, ct);

        var result = await attachments.UploadAsync(
            id,
            new AttachmentUpload(file.FileName, file.ContentType, buffer.ToArray()),
            ct);

        return Ok(ApiResponse<AttachmentDto>.Ok(result, "File attached."));
    }

    /// <summary>Removes an attached file.</summary>
    [HttpDelete("{id:guid}/attachments/{attachmentId:guid}")]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> RemoveAttachment(Guid id, Guid attachmentId, CancellationToken ct)
    {
        await attachments.DeleteAsync(id, attachmentId, ct);
        return Ok(ApiResponse.Ok("File removed."));
    }
}
