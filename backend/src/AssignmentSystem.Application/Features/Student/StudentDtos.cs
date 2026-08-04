using AssignmentSystem.Application.Common.Models;
using AssignmentSystem.Domain.Enums;

namespace AssignmentSystem.Application.Features.Student;

/// <summary>
/// An assignment as a student sees it, with their own submission folded in.
///
/// The two are combined because a student never wants the assignment alone —
/// "what is due, and where do I stand on it?" is one question.
/// </summary>
public sealed record StudentAssignmentDto(
    Guid Id,
    string Title,
    string ClassName,
    string ClassCode,
    string SubjectName,
    string SubjectCode,
    DateTimeOffset Deadline,
    decimal MaxMarks,
    string TeacherName,
    bool IsPastDeadline,
    bool AllowLateSubmission,
    bool AllowResubmission,
    bool HasSubmitted,
    SubmissionStatus? SubmissionStatus,
    decimal? Marks,
    bool IsLate,
    DateTimeOffset? SubmittedAt);

/// <summary>
/// Full assignment detail plus the student's own submission and feedback.
///
/// <c>CanSubmit</c> and <c>CanEdit</c> are computed server-side so the UI never
/// has to re-derive the deadline and resubmission rules — and cannot get them
/// wrong. <c>BlockedReason</c> explains a false, and is null when the action is
/// available.
/// </summary>
public sealed record StudentAssignmentDetailDto(
    Guid Id,
    string Title,
    string Description,
    string ClassName,
    string ClassCode,
    string SubjectName,
    string SubjectCode,
    DateTimeOffset Deadline,
    decimal MaxMarks,
    string TeacherName,
    bool IsPastDeadline,
    bool AllowLateSubmission,
    bool AllowResubmission,
    DateTimeOffset? PublishedAt,
    StudentSubmissionDto? MySubmission,
    bool CanSubmit,
    bool CanEdit,
    string? BlockedReason);

/// <summary>A student's own submission, including marks and teacher feedback.</summary>
public sealed record StudentSubmissionDto(
    Guid Id,
    Guid AssignmentId,
    string AssignmentTitle,
    string Content,
    string? AttachmentUrl,
    DateTimeOffset SubmittedAt,
    DateTimeOffset? LastUpdatedAt,
    bool IsLate,
    SubmissionStatus Status,
    decimal? Marks,
    decimal MaxMarks,
    string? GradedByTeacherName,
    DateTimeOffset? GradedAt,
    IReadOnlyList<StudentFeedbackDto> Feedback);

public sealed record StudentFeedbackDto(
    string TeacherName,
    string Comment,
    decimal? MarksAtTime,
    DateTimeOffset CreatedAt);

/// <summary>
/// An answer being submitted.
///
/// <paramref name="ContentJson"/> carries the rich document from the editor;
/// <paramref name="Content"/> is the same text flattened. Both are stored: the
/// plain text is what grading, search and older clients read, so the submission
/// stays usable even if the document format changes.
/// </summary>
public sealed record SubmitAssignmentRequest(
    string Content, string? AttachmentUrl, string? ContentJson = null);

public sealed record UpdateSubmissionRequest(
    string Content, string? AttachmentUrl, string? ContentJson = null);

/// <summary>Filters for a student's assignment list.</summary>
public sealed class StudentAssignmentListQuery : PaginationQuery
{
    public Guid? ClassId { get; set; }
    public Guid? SubjectId { get; set; }

    /// <summary>true = only assignments already submitted; false = only outstanding ones.</summary>
    public bool? Submitted { get; set; }

    public bool? PastDeadline { get; set; }
}

/// <summary>Headline figures for the student dashboard.</summary>
public sealed record StudentDashboardDto(
    int TotalAssignments,
    int SubmittedCount,
    int PendingCount,
    int GradedCount,
    int OverdueCount,
    decimal? AverageMarkPercentage,
    IReadOnlyList<StudentAssignmentDto> DueSoon);
