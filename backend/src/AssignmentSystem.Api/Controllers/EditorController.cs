using Asp.Versioning;
using AssignmentSystem.Application.Common.Models;
using AssignmentSystem.Application.Features.Editor;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AssignmentSystem.Api.Controllers;

/// <summary>
/// The editing log behind a submission: recording it, replaying it, and the
/// version history it produces.
/// </summary>
[ApiController]
[ApiVersion("1.0")]
[Authorize]
[Route("api/v{version:apiVersion}/submissions/{submissionId:guid}")]
[Produces("application/json")]
public sealed class EditorController(IEditorService editor) : ControllerBase
{
    /// <summary>Returns what the editor needs to resume this document.</summary>
    /// <remarks>
    /// The sequence and offset let a reopened editor continue the existing log
    /// rather than starting a second one. Author-only, like recording itself.
    /// </remarks>
    /// <response code="404">Not found, or not your submission.</response>
    [HttpGet("session")]
    [ProducesResponseType(typeof(ApiResponse<EditorSessionDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Session(Guid submissionId, CancellationToken ct)
        => Ok(ApiResponse<EditorSessionDto>.Ok(await editor.GetSessionAsync(submissionId, ct)));

    /// <summary>Records a batch of editing operations.</summary>
    /// <remarks>
    /// Batched rather than one request per keystroke. Events carry a sequence
    /// number that is unique per submission, so a retried batch is
    /// deduplicated server-side rather than doubling the log.
    ///
    /// Only the student who owns the submission may write to its log.
    /// </remarks>
    /// <response code="200">Accepted; returns the new high-water sequence.</response>
    /// <response code="404">Not found, or not your submission.</response>
    /// <response code="422">The submission is graded and no longer editable.</response>
    [HttpPost("events")]
    [ProducesResponseType(typeof(ApiResponse<RecordEventsResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> Record(
        Guid submissionId, RecordEventsRequest request, CancellationToken ct)
        => Ok(ApiResponse<RecordEventsResponse>.Ok(
            await editor.RecordAsync(submissionId, request, ct)));

    /// <summary>Returns the full operation log, final document and analytics.</summary>
    /// <remarks>
    /// Everything the replay player needs in one response. Available to the
    /// teacher of the assignment's offering and to the student who wrote it.
    /// </remarks>
    /// <response code="403">You do not have access to this submission.</response>
    [HttpGet("replay")]
    [ProducesResponseType(typeof(ApiResponse<ReplayDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Replay(Guid submissionId, CancellationToken ct)
        => Ok(ApiResponse<ReplayDto>.Ok(await editor.GetReplayAsync(submissionId, ct)));

    /// <summary>Returns writing analytics without the full event log.</summary>
    /// <remarks>
    /// Derived from the log on read, so the figures can never drift from the
    /// operations that produced them.
    /// </remarks>
    [HttpGet("analytics")]
    [ProducesResponseType(typeof(ApiResponse<WritingAnalyticsDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Analytics(Guid submissionId, CancellationToken ct)
        => Ok(ApiResponse<WritingAnalyticsDto>.Ok(
            await editor.GetAnalyticsAsync(submissionId, ct)));

    /// <summary>Lists saved versions, newest first.</summary>
    [HttpGet("versions")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<VersionDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Versions(Guid submissionId, CancellationToken ct)
        => Ok(ApiResponse<IReadOnlyList<VersionDto>>.Ok(
            await editor.ListVersionsAsync(submissionId, ct)));

    /// <summary>Returns one version's full document.</summary>
    [HttpGet("versions/{versionNumber:int}")]
    [ProducesResponseType(typeof(ApiResponse<VersionDetailDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Version(
        Guid submissionId, int versionNumber, CancellationToken ct)
        => Ok(ApiResponse<VersionDetailDto>.Ok(
            await editor.GetVersionAsync(submissionId, versionNumber, ct)));

    /// <summary>Restores the document to an earlier version.</summary>
    /// <remarks>
    /// Recorded as a new version rather than by rewinding history, so the trail
    /// shows that a restore happened and to which version.
    /// </remarks>
    /// <response code="422">The submission is graded and no longer editable.</response>
    [HttpPost("versions/{versionNumber:int}/restore")]
    [ProducesResponseType(typeof(ApiResponse<VersionDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> Restore(
        Guid submissionId, int versionNumber, CancellationToken ct)
        => Ok(ApiResponse<VersionDto>.Ok(
            await editor.RestoreVersionAsync(submissionId, versionNumber, ct),
            "Version restored."));
}
