using AssignmentSystem.Application.Common.Models;
using AssignmentSystem.Domain.Enums;

namespace AssignmentSystem.Application.Features.Teacher.Grading;

/// <summary>A submission as a teacher sees it in a list.</summary>
public sealed record SubmissionSummaryDto(
    Guid Id,
    Guid AssignmentId,
    string AssignmentTitle,
    Guid StudentId,
    string StudentName,
    string StudentEmail,
    DateTimeOffset SubmittedAt,
    DateTimeOffset? LastUpdatedAt,
    bool IsLate,
    SubmissionStatus Status,
    decimal? Marks,
    decimal MaxMarks,
    string? GradedByTeacherName,
    DateTimeOffset? GradedAt,
    int FeedbackCount);

/// <summary>A submission with its answer and full feedback history.</summary>
public sealed record SubmissionDetailDto(
    Guid Id,
    Guid AssignmentId,
    string AssignmentTitle,
    decimal MaxMarks,
    DateTimeOffset Deadline,
    Guid StudentId,
    string StudentName,
    string StudentEmail,
    string Content,
    string? AttachmentUrl,
    DateTimeOffset SubmittedAt,
    DateTimeOffset? LastUpdatedAt,
    bool IsLate,
    SubmissionStatus Status,
    decimal? Marks,
    Guid? GradedByTeacherId,
    string? GradedByTeacherName,
    DateTimeOffset? GradedAt,
    IReadOnlyList<FeedbackDto> Feedback);

public sealed record FeedbackDto(
    Guid Id,
    Guid TeacherId,
    string TeacherName,
    string Comment,
    decimal? MarksAtTime,
    DateTimeOffset CreatedAt);

/// <summary>Awards marks, optionally with a comment.</summary>
public sealed record GradeSubmissionRequest(decimal Marks, string? Feedback);

/// <summary>Adds a comment without changing marks or status.</summary>
public sealed record AddFeedbackRequest(string Comment);

/// <summary>Moves a submission between workflow states.</summary>
public sealed record ChangeSubmissionStatusRequest(SubmissionStatus Status, string? Comment);

/// <summary>
/// A student who has not submitted. The teacher view needs these to show who is
/// outstanding, which a list of submissions alone cannot express.
/// </summary>
public sealed record MissingSubmissionDto(
    Guid StudentId,
    string StudentName,
    string StudentEmail);

/// <summary>Everything needed to render an assignment's grading page.</summary>
public sealed record AssignmentSubmissionsDto(
    Guid AssignmentId,
    string AssignmentTitle,
    decimal MaxMarks,
    DateTimeOffset Deadline,
    int EnrolledStudentCount,
    int SubmittedCount,
    int GradedCount,
    IReadOnlyList<SubmissionSummaryDto> Submissions,
    IReadOnlyList<MissingSubmissionDto> NotSubmitted);

public sealed class SubmissionListQuery : PaginationQuery
{
    public Guid? AssignmentId { get; set; }
    public Guid? ClassSubjectId { get; set; }
    public Guid? StudentId { get; set; }
    public SubmissionStatus? Status { get; set; }
    public bool? IsLate { get; set; }
}
