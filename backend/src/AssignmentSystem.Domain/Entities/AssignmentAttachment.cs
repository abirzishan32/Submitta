using AssignmentSystem.Domain.Common;

namespace AssignmentSystem.Domain.Entities;

/// <summary>
/// A file the teacher attached to an assignment — typically the question paper.
///
/// The bytes live in the database rather than in object storage. That is a
/// deliberate trade: this project has no storage service and adding one would
/// mean another account, another set of credentials and another thing to
/// configure before the application runs at all. A question paper is small and
/// read rarely, so a <c>bytea</c> column costs little and keeps the system to
/// one dependency. A deployment serving large files at volume should move this
/// to object storage and keep only the key here — which is why the bytes sit in
/// their own table, away from every assignment query.
/// </summary>
public class AssignmentAttachment : BaseEntity
{
    public Guid AssignmentId { get; set; }
    public Assignment Assignment { get; set; } = null!;

    /// <summary>The name as uploaded, shown to students and used on download.</summary>
    public required string FileName { get; set; }

    public required string ContentType { get; set; }

    public long SizeBytes { get; set; }

    /// <summary>
    /// The file itself. Never selected by list or detail queries — only by the
    /// download endpoint, which is the one place that needs it.
    /// </summary>
    public required byte[] Content { get; set; }
}
