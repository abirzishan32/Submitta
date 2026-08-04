using AssignmentSystem.Domain.Common;

namespace AssignmentSystem.Domain.Entities;

/// <summary>
/// A saved snapshot of a submission's document.
///
/// The event log can rebuild any moment, but replaying thousands of operations
/// to show "what did this look like yesterday?" is wasteful. Snapshots are the
/// index: taken on every manual save, on submission, and periodically during
/// autosave, so restoring a version is a read rather than a reconstruction.
/// </summary>
public class SubmissionVersion : BaseEntity
{
    public Guid SubmissionId { get; set; }
    public Submission Submission { get; set; } = null!;

    /// <summary>1-based, per submission. What the UI labels "Version 4".</summary>
    public int VersionNumber { get; set; }

    /// <summary>The Tiptap document as JSONB.</summary>
    public required string ContentJson { get; set; }

    /// <summary>Plain text, for word counts and search without parsing the JSON.</summary>
    public required string PlainText { get; set; }

    public int WordCount { get; set; }

    /// <summary>
    /// The event sequence this snapshot corresponds to, so the replay player can
    /// seek to a version and continue from exactly the right operation.
    /// </summary>
    public long AtSequence { get; set; }

    /// <summary>Why the snapshot exists: "autosave", "manual", "submit", "restore".</summary>
    public required string Reason { get; set; }
}
