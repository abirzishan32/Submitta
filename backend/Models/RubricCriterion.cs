using AssignmentSystem.Domain.Common;

namespace AssignmentSystem.Domain.Entities;

/// <summary>
/// One line of a rubric: something the work is judged on, and what it is worth.
///
/// Written per assignment rather than drawn from a shared library. A rubric is
/// an argument about what *this* task is testing, and a reusable one tends to
/// drift into generic headings that tell a student nothing.
/// </summary>
public class RubricCriterion : BaseEntity
{
    public Guid AssignmentId { get; set; }
    public Assignment Assignment { get; set; } = null!;

    /// <summary>Position in the rubric. The teacher's order is the marking order.</summary>
    public int Order { get; set; }

    public required string Title { get; set; }

    /// <summary>
    /// What earns the marks. Optional, but this is where a rubric stops being a
    /// list of nouns and starts being useful to the student.
    /// </summary>
    public string? Description { get; set; }

    /// <summary>Marks available for this criterion. The rubric's total is the sum.</summary>
    public decimal MaxPoints { get; set; }

    public ICollection<SubmissionCriterionScore> Scores { get; set; } = [];
}

/// <summary>
/// What one submission scored on one criterion.
///
/// Stored per criterion rather than only as a total, so a student can see where
/// the marks went — which is the entire reason to mark against a rubric.
/// </summary>
public class SubmissionCriterionScore : BaseEntity
{
    public Guid SubmissionId { get; set; }
    public Submission Submission { get; set; } = null!;

    public Guid RubricCriterionId { get; set; }
    public RubricCriterion RubricCriterion { get; set; } = null!;

    public decimal Points { get; set; }

    /// <summary>A remark on this criterion alone.</summary>
    public string? Comment { get; set; }
}
