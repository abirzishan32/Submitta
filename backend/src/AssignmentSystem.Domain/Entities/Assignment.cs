using AssignmentSystem.Domain.Common;
using AssignmentSystem.Domain.Enums;

namespace AssignmentSystem.Domain.Entities;

/// <summary>
/// A piece of work set by a teacher for one class-subject offering.
/// </summary>
public class Assignment : BaseEntity
{
    public required string Title { get; set; }

    public required string Description { get; set; }

    /// <summary>The class/course + subject this was set for.</summary>
    public Guid ClassSubjectId { get; set; }
    public ClassSubject ClassSubject { get; set; } = null!;

    public Guid CreatedByTeacherId { get; set; }
    public User CreatedByTeacher { get; set; } = null!;

    /// <summary>Stored as UTC. Every deadline comparison is done in UTC.</summary>
    public DateTimeOffset Deadline { get; set; }

    /// <summary>Upper bound for grading. Must be greater than zero.</summary>
    public decimal MaxMarks { get; set; }

    public AssignmentStatus Status { get; set; } = AssignmentStatus.Draft;

    /// <summary>When the teacher published it. Null while still a draft.</summary>
    public DateTimeOffset? PublishedAt { get; set; }

    /// <summary>
    /// Whether a student may edit an already-submitted answer before the
    /// deadline. This is the brief's "update a submission before the deadline,
    /// <em>if allowed</em>" made explicit rather than left implicit.
    /// </summary>
    public bool AllowResubmission { get; set; } = true;

    /// <summary>Whether a first submission is accepted after the deadline, flagged late.</summary>
    public bool AllowLateSubmission { get; set; }

    // Navigation
    public ICollection<Submission> Submissions { get; set; } = [];

    // --- Domain queries. Kept on the entity so the rules have one definition
    //     that services and tests both use. ---

    public bool IsPublished => Status == AssignmentStatus.Published;

    public bool IsPastDeadline(DateTimeOffset now) => now > Deadline;

    /// <summary>Whether a student may create a first submission right now.</summary>
    public bool AcceptsNewSubmissionAt(DateTimeOffset now) =>
        IsPublished && (!IsPastDeadline(now) || AllowLateSubmission);
}
