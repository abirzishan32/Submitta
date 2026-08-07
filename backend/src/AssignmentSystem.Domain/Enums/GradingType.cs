namespace AssignmentSystem.Domain.Enums;

/// <summary>
/// How an assignment is marked.
///
/// Every type still resolves to a number in <c>Submission.Marks</c>, scored out
/// of the assignment's <c>MaxMarks</c>. That is deliberate: averages, dashboards
/// and the student's own record all read one field, so a new marking scheme
/// cannot break them. What the type changes is the range that number may take,
/// how the teacher arrives at it, and how it is worded.
/// </summary>
public enum GradingType
{
    /// <summary>A mark out of whatever total the teacher set. The default.</summary>
    Points = 1,

    /// <summary>A mark out of 100, read as a percentage.</summary>
    Percentage = 2,

    /// <summary>
    /// A decision rather than a score. Stored as 1 out of 1 for a pass and 0 for
    /// a fail, so it still averages sensibly alongside other work.
    /// </summary>
    PassFail = 3,

    /// <summary>
    /// Scored against criteria the teacher writes for this assignment. The mark
    /// is the sum of the per-criterion scores, and the total available is the
    /// sum of the criteria.
    /// </summary>
    Rubric = 4
}
