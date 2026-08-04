using AssignmentSystem.Application.Common.Interfaces;
using AssignmentSystem.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace AssignmentSystem.Application.Features.Notifications;

/// <summary>
/// Turns something that happened into the people who should hear about it.
/// </summary>
public interface INotificationDispatcher
{
    Task AssignmentPublishedAsync(Guid assignmentId, CancellationToken ct = default);

    Task SubmissionReceivedAsync(Guid submissionId, CancellationToken ct = default);

    Task SubmissionGradedAsync(Guid submissionId, CancellationToken ct = default);

    Task SubmissionReturnedAsync(Guid submissionId, CancellationToken ct = default);
}

/// <summary>
/// The wording and the audience for each event, in one place.
///
/// The services that trigger these care that something happened, not who needs
/// telling — publishing an assignment should not require the assignment service
/// to know about enrolments. Keeping it here also means the phrasing a student
/// reads is written once.
///
/// Every method swallows its own failures. A notification is a courtesy; it must
/// never be the reason a teacher's publish or a student's submission fails.
/// </summary>
public sealed class NotificationDispatcher(
    IAppDbContext context,
    INotificationService notifications,
    INotificationAudience audience,
    ILogger<NotificationDispatcher> logger) : INotificationDispatcher
{
    public async Task AssignmentPublishedAsync(Guid assignmentId, CancellationToken ct = default)
    {
        try
        {
            var assignment = await context.Assignments
                .AsNoTracking()
                .Where(a => a.Id == assignmentId)
                .Select(a => new
                {
                    a.Title,
                    a.Deadline,
                    ClassName = a.ClassSubject.Class.Name,
                    SubjectName = a.ClassSubject.Subject.Name,
                    TeacherName = a.CreatedByTeacher.FullName,
                })
                .FirstOrDefaultAsync(ct);

            if (assignment is null) return;

            var students = await audience.StudentsForAssignmentAsync(assignmentId, ct);

            await notifications.NotifyAsync(students, new NotificationRequest(
                NotificationType.AssignmentPublished,
                $"New assignment: {assignment.Title}",
                $"{assignment.SubjectName} · due {Due(assignment.Deadline)}",
                $"/student/assignments/{assignmentId}",
                assignmentId,
                // Publishing, unpublishing and publishing again should not tell
                // the same student twice.
                $"assignment-published:{assignmentId}"), ct);

            await notifications.NotifyAsync(await audience.AdminsAsync(ct), new NotificationRequest(
                NotificationType.AssignmentPublished,
                $"{assignment.TeacherName} published an assignment",
                $"{assignment.Title} — {assignment.ClassName} · {assignment.SubjectName}",
                $"/admin/assignments/{assignmentId}",
                assignmentId,
                $"assignment-published-admin:{assignmentId}"), ct);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Could not notify about published assignment {Id}.", assignmentId);
        }
    }

    public async Task SubmissionReceivedAsync(Guid submissionId, CancellationToken ct = default)
    {
        try
        {
            var submission = await context.Submissions
                .AsNoTracking()
                .Where(s => s.Id == submissionId)
                .Select(s => new
                {
                    s.AssignmentId,
                    s.IsLate,
                    StudentName = s.Student.FullName,
                    AssignmentTitle = s.Assignment.Title,
                    ClassName = s.Assignment.ClassSubject.Class.Name,
                })
                .FirstOrDefaultAsync(ct);

            if (submission is null) return;

            var teachers = await audience.TeachersForAssignmentAsync(submission.AssignmentId, ct);

            await notifications.NotifyAsync(teachers, new NotificationRequest(
                NotificationType.SubmissionReceived,
                $"{submission.StudentName} submitted {submission.AssignmentTitle}",
                submission.IsLate ? "Submitted late · ready to mark" : "Ready to mark",
                $"/teacher/grading/{submissionId}",
                submissionId,
                // One per submission, so a student revising their answer before
                // the deadline does not ping the teacher on every save.
                $"submission-received:{submissionId}"), ct);

            await notifications.NotifyAsync(await audience.AdminsAsync(ct), new NotificationRequest(
                NotificationType.SubmissionReceived,
                $"New submission in {submission.ClassName}",
                $"{submission.StudentName} — {submission.AssignmentTitle}",
                $"/admin/submissions/{submissionId}",
                submissionId,
                $"submission-received-admin:{submissionId}"), ct);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Could not notify about submission {Id}.", submissionId);
        }
    }

    public async Task SubmissionGradedAsync(Guid submissionId, CancellationToken ct = default)
    {
        try
        {
            var submission = await context.Submissions
                .AsNoTracking()
                .Where(s => s.Id == submissionId)
                .Select(s => new
                {
                    s.StudentId,
                    s.Marks,
                    s.AssignmentId,
                    AssignmentTitle = s.Assignment.Title,
                    s.Assignment.MaxMarks,
                })
                .FirstOrDefaultAsync(ct);

            if (submission is null) return;

            await notifications.NotifyAsync([submission.StudentId], new NotificationRequest(
                NotificationType.SubmissionGraded,
                $"{submission.AssignmentTitle} has been marked",
                submission.Marks is { } marks
                    ? $"You scored {marks:0.##} out of {submission.MaxMarks:0.##}"
                    : "Your teacher has left feedback",
                $"/student/assignments/{submission.AssignmentId}",
                submissionId,
                // No dedupe key: a re-mark is news, and the student should be
                // told again if the figure changes.
                null), ct);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Could not notify about graded submission {Id}.", submissionId);
        }
    }

    public async Task SubmissionReturnedAsync(Guid submissionId, CancellationToken ct = default)
    {
        try
        {
            var submission = await context.Submissions
                .AsNoTracking()
                .Where(s => s.Id == submissionId)
                .Select(s => new { s.StudentId, s.AssignmentId, Title = s.Assignment.Title })
                .FirstOrDefaultAsync(ct);

            if (submission is null) return;

            await notifications.NotifyAsync([submission.StudentId], new NotificationRequest(
                NotificationType.SubmissionReturned,
                $"{submission.Title} was returned for revision",
                "Your teacher would like another attempt. Read their feedback, then resubmit.",
                $"/student/assignments/{submission.AssignmentId}",
                submissionId), ct);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Could not notify about returned submission {Id}.", submissionId);
        }
    }

    /// <summary>
    /// A deadline as a student would say it.
    ///
    /// Absolute rather than relative ("in 3 days"), because a notification is
    /// read at an unknown time — possibly days after it was written — and a
    /// relative phrase frozen at write time would be wrong by then.
    /// </summary>
    private static string Due(DateTimeOffset deadline) =>
        deadline.ToString("d MMM, HH:mm");
}
