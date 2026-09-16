using Asp.Versioning;
using AssignmentSystem.Api.Configuration;
using AssignmentSystem.Application.Common.Models;
using AssignmentSystem.Application.Features.Student;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AssignmentSystem.Api.Controllers;

/// <summary>
/// The student's view of their coursework.
///
/// Every endpoint is scoped to the signed-in student: only published assignments
/// for classes they are enrolled in, and only their own submissions. That scoping
/// lives in the queries themselves, so another student's work is never selected.
/// </summary>
[ApiController]
[ApiVersion("1.0")]
[Authorize(Policy = Policies.StudentOnly)]
[Route("api/v{version:apiVersion}/student")]
[Produces("application/json")]
public sealed class StudentController(IStudentService student) : ControllerBase
{
    /// <summary>Headline figures and the next few assignments due.</summary>
    /// <remarks>
    /// The average is a percentage, since assignments are marked out of different
    /// totals and a raw mean across them would be meaningless.
    /// </remarks>
    [HttpGet("dashboard")]
    [ProducesResponseType(typeof(ApiResponse<StudentDashboardDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Dashboard(CancellationToken ct)
        => Ok(ApiResponse<StudentDashboardDto>.Ok(await student.GetDashboardAsync(ct)));

    /// <summary>Lists the classes the student is enrolled in.</summary>
    [HttpGet("classes")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<ClassOptionDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> MyClasses(CancellationToken ct)
        => Ok(ApiResponse<IReadOnlyList<ClassOptionDto>>.Ok(await student.ListMyClassesAsync(ct)));

    /// <summary>Lists the subjects taught in the student's classes.</summary>
    [HttpGet("subjects")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<SubjectOptionDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> MySubjects(CancellationToken ct)
        => Ok(ApiResponse<IReadOnlyList<SubjectOptionDto>>.Ok(await student.ListMySubjectsAsync(ct)));

    /// <summary>Lists assignments for the student's classes.</summary>
    /// <remarks>
    /// Published assignments only — drafts are never visible. Filter by classId,
    /// subjectId, submitted or pastDeadline; sort by title, deadline, maxMarks
    /// or publishedAt.
    /// </remarks>
    [HttpGet("assignments")]
    [ProducesResponseType(typeof(ApiResponse<PagedResult<StudentAssignmentDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListAssignments(
        [FromQuery] StudentAssignmentListQuery query, CancellationToken ct)
        => Ok(ApiResponse<PagedResult<StudentAssignmentDto>>.Ok(
            await student.ListAssignmentsAsync(query, ct)));

    /// <summary>Returns an assignment with the student's own submission and feedback.</summary>
    /// <remarks>
    /// <c>canSubmit</c>, <c>canEdit</c> and <c>blockedReason</c> are decided
    /// server-side, so the UI can disable an action with an accurate explanation
    /// rather than re-deriving the deadline rules for itself.
    /// </remarks>
    /// <response code="404">Not published, or not a class you are enrolled in.</response>
    [HttpGet("assignments/{assignmentId:guid}")]
    [ProducesResponseType(typeof(ApiResponse<StudentAssignmentDetailDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetAssignment(Guid assignmentId, CancellationToken ct)
        => Ok(ApiResponse<StudentAssignmentDetailDto>.Ok(
            await student.GetAssignmentAsync(assignmentId, ct)));

    /// <summary>Submits an answer.</summary>
    /// <remarks>
    /// One submission per assignment. After the deadline this is accepted only if
    /// the assignment allows late work, and is then flagged late.
    /// </remarks>
    /// <response code="409">You have already submitted; update it instead.</response>
    /// <response code="422">The deadline has passed and late submissions are not accepted.</response>
    [HttpPost("assignments/{assignmentId:guid}/submit")]
    [ProducesResponseType(typeof(ApiResponse<StudentSubmissionDto>), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status409Conflict)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> Submit(
        Guid assignmentId, SubmitAssignmentRequest request, CancellationToken ct)
    {
        var created = await student.SubmitAsync(assignmentId, request, ct);

        return StatusCode(StatusCodes.Status201Created,
            ApiResponse<StudentSubmissionDto>.Ok(created,
                created.IsLate
                    ? "Submitted. Note this was after the deadline and is marked late."
                    : "Submitted successfully."));
    }

    /// <summary>Lists the student's own submissions.</summary>
    [HttpGet("submissions")]
    [ProducesResponseType(typeof(ApiResponse<PagedResult<StudentSubmissionDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListSubmissions(
        [FromQuery] PaginationQuery query, CancellationToken ct)
        => Ok(ApiResponse<PagedResult<StudentSubmissionDto>>.Ok(
            await student.ListSubmissionsAsync(query, ct)));

    /// <summary>Returns one of the student's own submissions, with marks and feedback.</summary>
    /// <response code="404">Not found, or it belongs to another student.</response>
    [HttpGet("submissions/{submissionId:guid}")]
    [ProducesResponseType(typeof(ApiResponse<StudentSubmissionDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetSubmission(Guid submissionId, CancellationToken ct)
        => Ok(ApiResponse<StudentSubmissionDto>.Ok(
            await student.GetSubmissionAsync(submissionId, ct)));

    /// <summary>Updates an existing submission.</summary>
    /// <remarks>
    /// Allowed only before the deadline, only while ungraded, and only if the
    /// assignment permits changes — or the teacher returned the work for revision,
    /// which re-opens editing and puts it back in the queue when resubmitted.
    /// </remarks>
    /// <response code="422">Past the deadline, already graded, or changes are not permitted.</response>
    [HttpPut("submissions/{submissionId:guid}")]
    [ProducesResponseType(typeof(ApiResponse<StudentSubmissionDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> UpdateSubmission(
        Guid submissionId, UpdateSubmissionRequest request, CancellationToken ct)
        => Ok(ApiResponse<StudentSubmissionDto>.Ok(
            await student.UpdateSubmissionAsync(submissionId, request, ct),
            "Submission updated."));

    /// <summary>Permanently closes the caller's own account.</summary>
    /// <remarks>
    /// Restricted to students by the policy on this controller — a teacher or
    /// administrator account is never reachable through this route. Requires the
    /// current password and the confirmation phrase, typed exactly. Refused
    /// while submitted work or an active enrolment is still attached to the
    /// account; an administrator handles that case instead.
    /// </remarks>
    /// <response code="401">Password is incorrect.</response>
    /// <response code="409">Submitted work or an active enrolment is still attached to this account.</response>
    /// <response code="422">The confirmation phrase does not match exactly.</response>
    [HttpPost("account/delete")]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status409Conflict)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> DeleteAccount(DeleteAccountRequest request, CancellationToken ct)
    {
        await student.DeleteMyAccountAsync(request, ct);
        return Ok(ApiResponse.Ok("Your account has been deleted."));
    }
}
