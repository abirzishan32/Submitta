using AssignmentSystem.Application.Common.Models;
using AssignmentSystem.Domain.Enums;

namespace AssignmentSystem.Application.Features.Teacher.Assignments;

/// <summary>An assignment in list form, with the counts a teacher dashboard needs.</summary>
public sealed record AssignmentDto(
    Guid Id,
    string Title,
    Guid ClassSubjectId,
    string ClassName,
    string ClassCode,
    string SubjectName,
    string SubjectCode,
    DateTimeOffset Deadline,
    decimal MaxMarks,
    GradingType GradingType,
    AssignmentStatus Status,
    DateTimeOffset? PublishedAt,
    bool AllowResubmission,
    bool AllowLateSubmission,
    string CreatedByTeacherName,
    int SubmissionCount,
    int GradedCount,
    int EnrolledStudentCount,
    DateTimeOffset CreatedAt);

/// <summary>An assignment with its full description, for the detail view.</summary>
public sealed record AssignmentDetailDto(
    Guid Id,
    string Title,
    string Description,
    string? DescriptionJson,
    Guid ClassSubjectId,
    string ClassName,
    string ClassCode,
    string SubjectName,
    string SubjectCode,
    DateTimeOffset Deadline,
    decimal MaxMarks,
    GradingType GradingType,
    IReadOnlyList<RubricCriterionDto> Rubric,
    AssignmentStatus Status,
    DateTimeOffset? PublishedAt,
    bool AllowResubmission,
    bool AllowLateSubmission,
    Guid CreatedByTeacherId,
    string CreatedByTeacherName,
    int SubmissionCount,
    int GradedCount,
    int EnrolledStudentCount,
    bool IsPastDeadline,
    DateTimeOffset CreatedAt,
    DateTimeOffset? UpdatedAt);

/// <summary>
/// Creates an assignment. Set <c>PublishImmediately</c> to publish on creation
/// rather than saving a draft — publishing additionally requires the deadline to
/// be in the future.
///
/// <c>DescriptionJson</c> carries the brief as written in the editor and is
/// optional; <c>Description</c> is the same text flattened. <c>Rubric</c> is
/// required when <c>GradingType</c> is Rubric and ignored otherwise.
/// </summary>
public sealed record CreateAssignmentRequest(
    string Title,
    string Description,
    Guid ClassSubjectId,
    DateTimeOffset Deadline,
    decimal MaxMarks,
    bool AllowResubmission,
    bool AllowLateSubmission,
    bool PublishImmediately,
    string? DescriptionJson = null,
    GradingType GradingType = GradingType.Points,
    IReadOnlyList<RubricCriterionInput>? Rubric = null);

public sealed record UpdateAssignmentRequest(
    string Title,
    string Description,
    DateTimeOffset Deadline,
    decimal MaxMarks,
    bool AllowResubmission,
    bool AllowLateSubmission,
    string? DescriptionJson = null,
    GradingType GradingType = GradingType.Points,
    IReadOnlyList<RubricCriterionInput>? Rubric = null);

/// <summary>One line of a rubric, as the teacher writes it.</summary>
public sealed record RubricCriterionInput(
    Guid? Id,
    string Title,
    string? Description,
    decimal MaxPoints);

public sealed record RubricCriterionDto(
    Guid Id,
    int Order,
    string Title,
    string? Description,
    decimal MaxPoints);


/// <summary>Filters for a teacher's assignment list.</summary>
public sealed class AssignmentListQuery : PaginationQuery
{
    public Guid? ClassSubjectId { get; set; }
    public Guid? ClassId { get; set; }
    public Guid? SubjectId { get; set; }
    public AssignmentStatus? Status { get; set; }

    /// <summary>Only assignments whose deadline has passed (true) or not (false).</summary>
    public bool? PastDeadline { get; set; }
}
