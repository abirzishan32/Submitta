using AssignmentSystem.Application.Common.Interfaces;
using AssignmentSystem.Application.Common.Security;
using AssignmentSystem.Domain.Entities;
using AssignmentSystem.Domain.Enums;
using AssignmentSystem.Domain.Exceptions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace AssignmentSystem.Application.Features.Teacher.Assignments;

/// <summary>A file to store, as it arrives from the request.</summary>
public sealed record AttachmentUpload(string FileName, string ContentType, byte[] Content);

/// <summary>An attachment's bytes, ready to send back.</summary>
public sealed record AttachmentDownload(string FileName, string ContentType, byte[] Content);

public interface IAttachmentService
{
    Task<AttachmentDto> UploadAsync(
        Guid assignmentId, AttachmentUpload upload, CancellationToken ct = default);

    Task<AttachmentDownload> DownloadAsync(
        Guid assignmentId, Guid attachmentId, CancellationToken ct = default);

    Task DeleteAsync(Guid assignmentId, Guid attachmentId, CancellationToken ct = default);
}

/// <summary>
/// Files attached to an assignment — in practice, the question paper.
/// </summary>
public sealed class AttachmentService(
    IAppDbContext context,
    IAccessControl access,
    ICurrentUser currentUser,
    ILogger<AttachmentService> logger) : IAttachmentService
{
    /// <summary>
    /// Per file. Generous for a question paper, small enough that a handful of
    /// them cannot bloat the database or a response.
    /// </summary>
    public const int MaxSizeBytes = 10 * 1024 * 1024;

    /// <summary>
    /// Enough for a paper plus a data sheet or two. A cap exists mainly so a
    /// single assignment cannot be used as file storage.
    /// </summary>
    public const int MaxPerAssignment = 5;

    private const string Pdf = "application/pdf";

    /// <summary>
    /// Every PDF starts with these bytes.
    /// </summary>
    /// <remarks>
    /// Checked because the declared content type and the file extension are both
    /// supplied by the caller and neither is evidence of anything. Reading the
    /// first bytes is the only part of an upload the server can actually trust.
    /// </remarks>
    private static ReadOnlySpan<byte> PdfMagic => "%PDF-"u8;

    public async Task<AttachmentDto> UploadAsync(
        Guid assignmentId, AttachmentUpload upload, CancellationToken ct = default)
    {
        var assignment = await LoadForWriteAsync(assignmentId, ct);

        if (upload.Content.Length == 0)
        {
            throw new BusinessRuleException("That file is empty.");
        }

        if (upload.Content.Length > MaxSizeBytes)
        {
            throw new BusinessRuleException(
                $"That file is {upload.Content.Length / 1024 / 1024} MB. The limit is "
                + $"{MaxSizeBytes / 1024 / 1024} MB.");
        }

        if (!upload.Content.AsSpan().StartsWith(PdfMagic))
        {
            throw new BusinessRuleException(
                "Only PDF files can be attached, and that file is not a PDF whatever it is "
                + "named.");
        }

        var count = await context.AssignmentAttachments
            .CountAsync(a => a.AssignmentId == assignmentId, ct);

        if (count >= MaxPerAssignment)
        {
            throw new BusinessRuleException(
                $"This assignment already has {MaxPerAssignment} files, which is the limit. "
                + "Remove one before adding another.");
        }

        var attachment = new AssignmentAttachment
        {
            AssignmentId = assignment.Id,
            // Stripped to a bare name: a browser may send a full path, and the
            // value ends up in a Content-Disposition header.
            FileName = SafeFileName(upload.FileName),
            // Not taken from the request. The bytes have been checked; the
            // declared type has not.
            ContentType = Pdf,
            SizeBytes = upload.Content.Length,
            Content = upload.Content,
        };

        context.AssignmentAttachments.Add(attachment);
        await context.SaveChangesAsync(ct);

        logger.LogInformation(
            "Teacher {TeacherId} attached {FileName} ({Size} bytes) to assignment {AssignmentId}.",
            currentUser.UserId, attachment.FileName, attachment.SizeBytes, assignmentId);

        return new AttachmentDto(
            attachment.Id, attachment.FileName, attachment.ContentType,
            attachment.SizeBytes, attachment.CreatedAt);
    }

    public async Task<AttachmentDownload> DownloadAsync(
        Guid assignmentId, Guid attachmentId, CancellationToken ct = default)
    {
        await EnsureCanReadAsync(assignmentId, ct);

        var file = await context.AssignmentAttachments
            .AsNoTracking()
            .Where(a => a.Id == attachmentId && a.AssignmentId == assignmentId)
            .Select(a => new AttachmentDownload(a.FileName, a.ContentType, a.Content))
            .FirstOrDefaultAsync(ct)
            ?? throw new NotFoundException("Attachment", attachmentId);

        return file;
    }

    public async Task DeleteAsync(
        Guid assignmentId, Guid attachmentId, CancellationToken ct = default)
    {
        await LoadForWriteAsync(assignmentId, ct);

        var file = await context.AssignmentAttachments
            .FirstOrDefaultAsync(a => a.Id == attachmentId && a.AssignmentId == assignmentId, ct)
            ?? throw new NotFoundException("Attachment", attachmentId);

        context.AssignmentAttachments.Remove(file);
        await context.SaveChangesAsync(ct);

        logger.LogInformation(
            "Teacher {TeacherId} removed attachment {AttachmentId}.",
            currentUser.UserId, attachmentId);
    }

    // -----------------------------------------------------------------------

    private async Task<Domain.Entities.Assignment> LoadForWriteAsync(Guid id, CancellationToken ct)
    {
        var assignment = await context.Assignments
            .AsNoTracking()
            .FirstOrDefaultAsync(a => a.Id == id, ct)
            ?? throw new NotFoundException("Assignment", id);

        await access.EnsureCanManageOfferingAsync(assignment.ClassSubjectId, ct);
        return assignment;
    }

    /// <summary>
    /// Who may download the question paper: the teachers of the offering, an
    /// administrator, or a student enrolled in the class — but only once the
    /// assignment is published. A draft's paper is not yet set work.
    /// </summary>
    private async Task EnsureCanReadAsync(Guid assignmentId, CancellationToken ct)
    {
        var assignment = await context.Assignments
            .AsNoTracking()
            .Where(a => a.Id == assignmentId)
            .Select(a => new { a.ClassSubjectId, a.Status, a.ClassSubject.ClassId })
            .FirstOrDefaultAsync(ct)
            ?? throw new NotFoundException("Assignment", assignmentId);

        if (access.IsAdmin) return;

        var userId = currentUser.RequireUserId();

        var teaches = await context.TeacherAssignments
            .AnyAsync(ta => ta.ClassSubjectId == assignment.ClassSubjectId
                            && ta.TeacherId == userId, ct);

        if (teaches) return;

        var enrolled = assignment.Status == AssignmentStatus.Published
            && await context.Enrollments
                .AnyAsync(e => e.ClassId == assignment.ClassId && e.StudentId == userId, ct);

        if (!enrolled)
        {
            // Reported as missing rather than forbidden, so the response does
            // not confirm that another class's paper exists.
            throw new NotFoundException("Assignment", assignmentId);
        }
    }

    /// <summary>
    /// Reduces an uploaded name to something safe to echo back.
    /// </summary>
    /// <remarks>
    /// The name reaches a <c>Content-Disposition</c> header and a Save-As
    /// dialogue. Directory parts are dropped so a name cannot describe a path,
    /// and control characters — including the newlines that would let a name
    /// inject a second header — are removed.
    /// </remarks>
    private static string SafeFileName(string raw)
    {
        var name = Path.GetFileName(raw.Trim());

        var cleaned = new string([.. name.Where(c => !char.IsControl(c) && c != '"' && c != '\\')]);

        if (string.IsNullOrWhiteSpace(cleaned)) cleaned = "question.pdf";

        if (!cleaned.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase)) cleaned += ".pdf";

        return cleaned.Length <= 200 ? cleaned : cleaned[^200..];
    }
}
