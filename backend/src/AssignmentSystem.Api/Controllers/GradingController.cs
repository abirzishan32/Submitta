using Asp.Versioning;
using AssignmentSystem.Api.Configuration;
using AssignmentSystem.Application.Common.Models;
using AssignmentSystem.Application.Features.Teacher.Grading;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AssignmentSystem.Api.Controllers;

/// <summary>
/// Teacher review of student submissions: marks, feedback and workflow status.
///
/// Scoped to offerings the caller teaches; an Admin sees everything.
/// </summary>
[ApiController]
[ApiVersion("1.0")]
[Authorize(Policy = Policies.AdminOrTeacher)]
[Route("api/v{version:apiVersion}/grading")]
[Produces("application/json")]
public sealed class GradingController(IGradingService grading) : ControllerBase
{
    /// <summary>Lists submissions across assignments, with paging and filtering.</summary>
    /// <remarks>Filter by assignmentId, classSubjectId, studentId, status or isLate.</remarks>
    [HttpGet("submissions")]
    [ProducesResponseType(typeof(ApiResponse<PagedResult<SubmissionSummaryDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> List([FromQuery] SubmissionListQuery query, CancellationToken ct)
        => Ok(ApiResponse<PagedResult<SubmissionSummaryDto>>.Ok(await grading.ListAsync(query, ct)));

    /// <summary>Returns everything needed to grade one assignment.</summary>
    /// <remarks>
    /// Includes the submissions received and, just as importantly, the enrolled
    /// students who have not submitted.
    /// </remarks>
    /// <response code="403">You are not assigned to this class and subject.</response>
    [HttpGet("assignments/{assignmentId:guid}/submissions")]
    [ProducesResponseType(typeof(ApiResponse<AssignmentSubmissionsDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> ListForAssignment(Guid assignmentId, CancellationToken ct)
        => Ok(ApiResponse<AssignmentSubmissionsDto>.Ok(
            await grading.ListForAssignmentAsync(assignmentId, ct)));

    /// <summary>Returns one submission with its answer and feedback history.</summary>
    [HttpGet("submissions/{submissionId:guid}")]
    [ProducesResponseType(typeof(ApiResponse<SubmissionDetailDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Get(Guid submissionId, CancellationToken ct)
        => Ok(ApiResponse<SubmissionDetailDto>.Ok(await grading.GetAsync(submissionId, ct)));

    /// <summary>Awards marks, optionally with feedback.</summary>
    /// <remarks>
    /// Sets the status to Graded and records who graded it and when. Marks must
    /// fall between zero and the assignment's maximum.
    /// </remarks>
    /// <response code="422">Marks are negative or above the assignment's maximum.</response>
    [HttpPost("submissions/{submissionId:guid}/grade")]
    [ProducesResponseType(typeof(ApiResponse<SubmissionDetailDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> Grade(
        Guid submissionId, GradeSubmissionRequest request, CancellationToken ct)
        => Ok(ApiResponse<SubmissionDetailDto>.Ok(
            await grading.GradeAsync(submissionId, request, ct), "Marks recorded."));

    /// <summary>Adds a comment without changing marks or status.</summary>
    [HttpPost("submissions/{submissionId:guid}/feedback")]
    [ProducesResponseType(typeof(ApiResponse<SubmissionDetailDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> AddFeedback(
        Guid submissionId, AddFeedbackRequest request, CancellationToken ct)
        => Ok(ApiResponse<SubmissionDetailDto>.Ok(
            await grading.AddFeedbackAsync(submissionId, request, ct), "Feedback added."));

    /// <summary>Changes a submission's workflow status.</summary>
    /// <remarks>
    /// Submitted, UnderReview, Graded or ReturnedForRevision. Moving to Graded
    /// requires marks; moving away from it withdraws them, so a submission never
    /// carries marks while ungraded. ReturnedForRevision re-opens editing for the
    /// student, though the deadline still applies.
    /// </remarks>
    /// <response code="422">Set to Graded without marks having been awarded.</response>
    [HttpPatch("submissions/{submissionId:guid}/status")]
    [ProducesResponseType(typeof(ApiResponse<SubmissionDetailDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> ChangeStatus(
        Guid submissionId, ChangeSubmissionStatusRequest request, CancellationToken ct)
        => Ok(ApiResponse<SubmissionDetailDto>.Ok(
            await grading.ChangeStatusAsync(submissionId, request, ct), "Status updated."));
}
