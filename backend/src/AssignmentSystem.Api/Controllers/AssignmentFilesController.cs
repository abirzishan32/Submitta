using Asp.Versioning;
using AssignmentSystem.Application.Common.Models;
using AssignmentSystem.Application.Features.Teacher.Assignments;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AssignmentSystem.Api.Controllers;

/// <summary>
/// Downloading an assignment's question paper.
/// </summary>
/// <remarks>
/// Separate from <see cref="AssignmentsController"/>, which is restricted to
/// teachers and administrators. Students have to be able to read the paper —
/// that is the whole point of attaching one — so this controller admits any
/// signed-in user and leaves the decision to the service, which knows who
/// teaches the offering and who is enrolled in the class.
///
/// Uploading and removing files stay on the teacher-only controller.
/// </remarks>
[ApiController]
[ApiVersion("1.0")]
[Authorize]
[Route("api/v{version:apiVersion}/assignments/{id:guid}/attachments")]
public sealed class AssignmentFilesController(IAttachmentService attachments) : ControllerBase
{
    /// <summary>Downloads an attached file.</summary>
    /// <remarks>
    /// Open to the teachers of the offering, an administrator, and students
    /// enrolled in the class once the assignment is published — a draft's paper
    /// is not yet set work.
    /// </remarks>
    /// <response code="200">The file.</response>
    /// <response code="404">No such file, or not yours to read.</response>
    [HttpGet("{attachmentId:guid}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Download(Guid id, Guid attachmentId, CancellationToken ct)
    {
        var file = await attachments.DownloadAsync(id, attachmentId, ct);

        return File(file.Content, file.ContentType, file.FileName, enableRangeProcessing: true);
    }
}
