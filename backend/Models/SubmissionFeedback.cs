using AssignmentSystem.Domain.Common;

namespace AssignmentSystem.Domain.Entities;

/// <summary>
/// A teacher's comment on a submission.
///
/// A separate table rather than a column on Submission, so that a work →
/// returned-for-revision → resubmitted → graded cycle keeps every round of
/// comments instead of overwriting the previous one.
/// </summary>
public class SubmissionFeedback : BaseEntity
{
    public Guid SubmissionId { get; set; }
    public Submission Submission { get; set; } = null!;

    public Guid TeacherId { get; set; }
    public User Teacher { get; set; } = null!;

    public required string Comment { get; set; }

    /// <summary>
    /// Marks standing when this comment was written. Snapshotting keeps the
    /// feedback history readable after a later regrade.
    /// </summary>
    public decimal? MarksAtTime { get; set; }
}
