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
    bool HasAttachments,
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
    IReadOnlyList<AttachmentDto> Attachments,
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
    /// <summary>The brief as written in the editor. Optional.</summary>
    string? DescriptionJson = null,
    GradingType GradingType = GradingType.Points,
    /// <summary>Required when <c>GradingType</c> is Rubric, ignored otherwise.</summary>
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

/// <summary>An attached file, without its bytes.</summary>
public sealed record AttachmentDto(
    Guid Id,
    string FileName,
    string ContentType,
    long SizeBytes,
    DateTimeOffset UploadedAt);

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
