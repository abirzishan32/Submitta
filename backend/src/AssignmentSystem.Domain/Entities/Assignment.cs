using AssignmentSystem.Domain.Common;
using AssignmentSystem.Domain.Enums;

namespace AssignmentSystem.Domain.Entities;

/// <summary>
/// A piece of work set by a teacher for one class-subject offering.
/// </summary>
public class Assignment : BaseEntity
{
    public required string Title { get; set; }

    /// <summary>
    /// The brief as plain text. Always populated, even when the teacher wrote
    /// it in the editor — lists, search and any client that predates the rich
    /// format read this, so it must never be the thing that is missing.
    /// </summary>
    public required string Description { get; set; }

    /// <summary>
    /// The brief as a rich document, when the teacher wrote one. Null for an
    /// assignment typed as plain text or set entirely by an attached PDF.
    /// </summary>
    public string? DescriptionJson { get; set; }

    /// <summary>How this work is marked. See <see cref="GradingType"/>.</summary>
    public GradingType GradingType { get; set; } = GradingType.Points;

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

    /// <summary>Files the teacher attached — usually the question paper.</summary>
    public ICollection<AssignmentAttachment> Attachments { get; set; } = [];

    /// <summary>The rubric, when <see cref="GradingType"/> is Rubric. Empty otherwise.</summary>
    public ICollection<RubricCriterion> RubricCriteria { get; set; } = [];

    // --- Domain queries. Kept on the entity so the rules have one definition
    //     that services and tests both use. ---

    public bool IsPublished => Status == AssignmentStatus.Published;

    public bool IsPastDeadline(DateTimeOffset now) => now > Deadline;

    /// <summary>Whether a student may create a first submission right now.</summary>
    public bool AcceptsNewSubmissionAt(DateTimeOffset now) =>
        IsPublished && (!IsPastDeadline(now) || AllowLateSubmission);

    /// <summary>
    /// The total a grading type fixes, or null when the teacher chooses it.
    ///
    /// Kept here rather than in the service so the create path, the update path
    /// and the tests all agree on what "out of" means for a given type —
    /// three copies of this rule is how a percentage ends up scored out of 50.
    /// </summary>
    public static decimal? FixedMaxMarksFor(GradingType type) => type switch
    {
        // A percentage that is not out of 100 is not a percentage.
        GradingType.Percentage => 100m,
        // Pass is one mark out of one, so it averages with everything else.
        GradingType.PassFail => 1m,
        // Points is the teacher's call; Rubric is the sum of its criteria.
        _ => null,
    };

    /// <summary>Whether a mark is a legitimate result for this assignment.</summary>
    public bool IsValidMark(decimal marks) => GradingType switch
    {
        GradingType.PassFail => marks is 0m or 1m,
        _ => marks >= 0m && marks <= MaxMarks,
    };
}
