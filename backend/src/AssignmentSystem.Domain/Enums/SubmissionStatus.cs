namespace AssignmentSystem.Domain.Enums;

/// <summary>
/// Workflow state of a student submission. The teacher may move a submission
/// between these states ("change the submission status when necessary").
/// </summary>
public enum SubmissionStatus
{
    /// <summary>Student has submitted; awaiting teacher attention.</summary>
    Submitted = 1,

    /// <summary>Teacher has picked it up but not yet awarded marks.</summary>
    UnderReview = 2,

    /// <summary>Marks awarded. The submission is locked against further student edits.</summary>
    Graded = 3,

    /// <summary>
    /// Teacher sent it back for another attempt. This re-opens editing even
    /// when <c>AllowResubmission</c> is false, but the deadline still applies.
    /// </summary>
    ReturnedForRevision = 4
}
