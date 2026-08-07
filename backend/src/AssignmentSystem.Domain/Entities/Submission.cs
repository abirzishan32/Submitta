using AssignmentSystem.Domain.Common;
using AssignmentSystem.Domain.Enums;

namespace AssignmentSystem.Domain.Entities;

/// <summary>
/// A student's answer to an assignment.
///
/// One row per (assignment, student), enforced by a unique index — the duplicate
/// rule is a database constraint, not merely a service check, so a race between
/// two concurrent submits cannot slip past it.
/// </summary>
public class Submission : BaseEntity
{
    public Guid AssignmentId { get; set; }
    public Assignment Assignment { get; set; } = null!;

    public Guid StudentId { get; set; }
    public User Student { get; set; } = null!;

    /// <summary>
    /// The answer as plain text.
    ///
    /// Retained alongside <see cref="ContentJson"/> rather than replaced by it:
    /// word counts, search and any client that cannot render a rich document
    /// all want text, and deriving it on every read means parsing JSON to
    /// answer "how long is this?".
    /// </summary>
    public required string Content { get; set; }

    /// <summary>
    /// The rich document, as a Tiptap/ProseMirror JSON tree.
    ///
    /// Null for submissions made through the plain-text path, which is why
    /// every reader must fall back to <see cref="Content"/>.
    /// </summary>
    public string? ContentJson { get; set; }

    /// <summary>Optional link to supporting work. File upload is out of scope.</summary>
    public string? AttachmentUrl { get; set; }

    public DateTimeOffset SubmittedAt { get; set; }

    /// <summary>Set when the student edits an existing submission. Null if never edited.</summary>
    public DateTimeOffset? LastUpdatedAt { get; set; }

    /// <summary>
    /// Recorded at submission time rather than derived on read, so that editing
    /// the assignment's deadline afterwards cannot retroactively change whether
    /// a student was late.
    /// </summary>
    public bool IsLate { get; set; }

    public SubmissionStatus Status { get; set; } = SubmissionStatus.Submitted;

    /// <summary>Awarded marks. Null until graded; bounded by the assignment's MaxMarks.</summary>
    public decimal? Marks { get; set; }

    public Guid? GradedByTeacherId { get; set; }
    public User? GradedByTeacher { get; set; }

    public DateTimeOffset? GradedAt { get; set; }

    // Navigation
    public ICollection<SubmissionFeedback> Feedbacks { get; set; } = [];

    /// <summary>The operation log this submission's replay is rebuilt from.</summary>
    public ICollection<SubmissionEvent> Events { get; set; } = [];

    /// <summary>Per-criterion scores, when the assignment is marked by rubric.</summary>
    public ICollection<SubmissionCriterionScore> CriterionScores { get; set; } = [];

    public ICollection<SubmissionVersion> Versions { get; set; } = [];

    // --- Domain queries ---

    public bool IsGraded => Status == SubmissionStatus.Graded;

    /// <summary>
    /// Whether the student may still edit this submission.
    ///
    /// Graded work is locked. Otherwise the deadline always applies, and editing
    /// additionally requires either the assignment to permit resubmission or the
    /// teacher to have explicitly sent the work back for revision.
    /// </summary>
    public bool CanBeEditedAt(Assignment assignment, DateTimeOffset now) =>
        !IsGraded
        && !assignment.IsPastDeadline(now)
        && (assignment.AllowResubmission || Status == SubmissionStatus.ReturnedForRevision);
}
