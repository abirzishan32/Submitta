using System.Linq.Expressions;
using AssignmentSystem.Application.Common.Extensions;
using AssignmentSystem.Application.Common.Interfaces;
using AssignmentSystem.Application.Features.Notifications;
using AssignmentSystem.Application.Common.Models;
using AssignmentSystem.Domain.Entities;
using AssignmentSystem.Domain.Enums;
using AssignmentSystem.Domain.Exceptions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using DomainAssignment = AssignmentSystem.Domain.Entities.Assignment;

namespace AssignmentSystem.Application.Features.Student;

public interface IStudentService
{
    /// <summary>Classes the student is enrolled in, for filter dropdowns.</summary>
    Task<IReadOnlyList<ClassOptionDto>> ListMyClassesAsync(CancellationToken ct = default);

    /// <summary>Subjects taught in the student's classes, for filter dropdowns.</summary>
    Task<IReadOnlyList<SubjectOptionDto>> ListMySubjectsAsync(CancellationToken ct = default);

    Task<PagedResult<StudentAssignmentDto>> ListAssignmentsAsync(
        StudentAssignmentListQuery query, CancellationToken ct = default);

    Task<StudentAssignmentDetailDto> GetAssignmentAsync(Guid assignmentId, CancellationToken ct = default);

    Task<PagedResult<StudentSubmissionDto>> ListSubmissionsAsync(
        PaginationQuery query, CancellationToken ct = default);

    Task<StudentSubmissionDto> GetSubmissionAsync(Guid submissionId, CancellationToken ct = default);

    Task<StudentSubmissionDto> SubmitAsync(
        Guid assignmentId, SubmitAssignmentRequest request, CancellationToken ct = default);

    Task<StudentSubmissionDto> UpdateSubmissionAsync(
        Guid submissionId, UpdateSubmissionRequest request, CancellationToken ct = default);

    Task<StudentDashboardDto> GetDashboardAsync(CancellationToken ct = default);
}

/// <summary>
/// The student's view: assignments for classes they are enrolled in, their own
/// submissions, and the marks and feedback on them.
///
/// Visibility is enforced by construction — every query starts from the caller's
/// enrolments and only ever includes published assignments, so a draft or another
/// class's work is never selected rather than merely filtered out. Likewise a
/// student can only ever reach their own submissions.
/// </summary>
public sealed class StudentService(
    IAppDbContext context,
    ICurrentUser currentUser,
    IDateTimeProvider dateTime,
    INotificationDispatcher notifications,
    ILogger<StudentService> logger) : IStudentService
{
    private static readonly Dictionary<string, Expression<Func<DomainAssignment, object>>> Sortable = new()
    {
        ["title"] = a => a.Title,
        ["deadline"] = a => a.Deadline,
        ["maxMarks"] = a => a.MaxMarks,
        ["publishedAt"] = a => a.PublishedAt!
    };

    public async Task<IReadOnlyList<ClassOptionDto>> ListMyClassesAsync(
        CancellationToken ct = default)
    {
        var studentId = currentUser.RequireUserId();

        return await context.Enrollments
            .AsNoTracking()
            .Where(e => e.StudentId == studentId)
            .OrderBy(e => e.Class.Code)
            .Select(e => new ClassOptionDto(
                e.ClassId, e.Class.Name, e.Class.Code, e.Class.AcademicYear))
            .ToListAsync(ct);
    }

    public async Task<IReadOnlyList<SubjectOptionDto>> ListMySubjectsAsync(
        CancellationToken ct = default)
    {
        var studentId = currentUser.RequireUserId();

        // Selected from Subjects rather than from offerings, so a subject taught
        // to two of the student's classes appears once without a Distinct() —
        // which EF cannot order by after projecting to a record.
        return await context.Subjects
            .AsNoTracking()
            .Where(s => context.ClassSubjects.Any(cs =>
                cs.SubjectId == s.Id
                && context.Enrollments.Any(e =>
                    e.StudentId == studentId && e.ClassId == cs.ClassId)))
            .OrderBy(s => s.Name)
            .Select(s => new SubjectOptionDto(s.Id, s.Name, s.Code))
            .ToListAsync(ct);
    }

    public async Task<PagedResult<StudentAssignmentDto>> ListAssignmentsAsync(
        StudentAssignmentListQuery query, CancellationToken ct = default)
    {
        var studentId = currentUser.RequireUserId();
        var now = dateTime.UtcNow;

        var assignments = VisibleTo(studentId);

        if (query.ClassId is { } classId)
        {
            assignments = assignments.Where(a => a.ClassSubject.ClassId == classId);
        }

        if (query.SubjectId is { } subjectId)
        {
            assignments = assignments.Where(a => a.ClassSubject.SubjectId == subjectId);
        }

        if (query.Submitted is { } submitted)
        {
            assignments = submitted
                ? assignments.Where(a => a.Submissions.Any(s => s.StudentId == studentId))
                : assignments.Where(a => !a.Submissions.Any(s => s.StudentId == studentId));
        }

        if (query.PastDeadline is { } pastDeadline)
        {
            assignments = pastDeadline
                ? assignments.Where(a => a.Deadline < now)
                : assignments.Where(a => a.Deadline >= now);
        }

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var term = query.Search.Trim().ToLowerInvariant();
            assignments = assignments.Where(a =>
                a.Title.ToLower().Contains(term) ||
                a.ClassSubject.Subject.Name.ToLower().Contains(term));
        }

        return await assignments
            .ApplySort(query.SortBy, query.SortDescending, Sortable, a => a.Deadline)
            .ToPagedResultAsync(query, ListProjection(studentId, now), ct);
    }

    public async Task<StudentAssignmentDetailDto> GetAssignmentAsync(
        Guid assignmentId, CancellationToken ct = default)
    {
        var studentId = currentUser.RequireUserId();
        var now = dateTime.UtcNow;

        var assignment = await VisibleTo(studentId)
            .Where(a => a.Id == assignmentId)
            .Select(a => new
            {
                a.Id, a.Title, a.Description, a.DescriptionJson, a.Deadline, a.MaxMarks,
                a.PublishedAt, a.GradingType,
                a.AllowLateSubmission, a.AllowResubmission,
                Rubric = a.RubricCriteria
                    .OrderBy(c => c.Order)
                    .Select(c => new { c.Id, c.Order, c.Title, c.Description, c.MaxPoints })
                    .ToList(),
                Attachments = a.Attachments
                    .OrderBy(f => f.CreatedAt)
                    .Select(f => new StudentAttachmentDto(f.Id, f.FileName, f.SizeBytes))
                    .ToList(),
                ClassName = a.ClassSubject.Class.Name,
                ClassCode = a.ClassSubject.Class.Code,
                SubjectName = a.ClassSubject.Subject.Name,
                SubjectCode = a.ClassSubject.Subject.Code,
                TeacherName = a.CreatedByTeacher.FullName
            })
            .FirstOrDefaultAsync(ct)
            // Not published, or not a class this student is enrolled in. Reported
            // as "not found" so the response does not confirm that it exists.
            ?? throw new NotFoundException("Assignment", assignmentId);

        var submission = await context.Submissions
            .AsNoTracking()
            .Where(s => s.AssignmentId == assignmentId && s.StudentId == studentId)
            .Select(SubmissionProjection)
            .FirstOrDefaultAsync(ct);

        var isPastDeadline = assignment.Deadline < now;

        var (canSubmit, canEdit, blockedReason) = EvaluateAvailability(
            hasSubmission: submission is not null,
            submissionStatus: submission?.Status,
            isPastDeadline: isPastDeadline,
            allowLate: assignment.AllowLateSubmission,
            allowResubmission: assignment.AllowResubmission);

        // Scores are only attached once the work has been marked — before that
        // an empty rubric still tells the student what they are judged on.
        var scores = submission is null
            ? []
            : await context.SubmissionCriterionScores
                .AsNoTracking()
                .Where(x => x.SubmissionId == submission.Id)
                .ToDictionaryAsync(x => x.RubricCriterionId, x => new { x.Points, x.Comment }, ct);

        return new StudentAssignmentDetailDto(
            assignment.Id,
            assignment.Title,
            assignment.Description,
            assignment.DescriptionJson,
            assignment.GradingType,
            [.. assignment.Rubric.Select(c => new StudentRubricCriterionDto(
                c.Id, c.Order, c.Title, c.Description, c.MaxPoints,
                scores.TryGetValue(c.Id, out var score) ? score.Points : null,
                scores.TryGetValue(c.Id, out var withComment) ? withComment.Comment : null))],
            assignment.Attachments,
            assignment.ClassName,
            assignment.ClassCode,
            assignment.SubjectName,
            assignment.SubjectCode,
            assignment.Deadline,
            assignment.MaxMarks,
            assignment.TeacherName,
            isPastDeadline,
            assignment.AllowLateSubmission,
            assignment.AllowResubmission,
            assignment.PublishedAt,
            submission,
            canSubmit,
            canEdit,
            blockedReason);
    }

    public async Task<PagedResult<StudentSubmissionDto>> ListSubmissionsAsync(
        PaginationQuery query, CancellationToken ct = default)
    {
        var studentId = currentUser.RequireUserId();

        return await context.Submissions
            .AsNoTracking()
            .Where(s => s.StudentId == studentId)
            .OrderByDescending(s => s.SubmittedAt)
            .ToPagedResultAsync(query, SubmissionProjection, ct);
    }

    public async Task<StudentSubmissionDto> GetSubmissionAsync(
        Guid submissionId, CancellationToken ct = default)
    {
        var studentId = currentUser.RequireUserId();

        return await context.Submissions
            .AsNoTracking()
            // Scoped to the caller, so another student's submission is never
            // selected — this is what makes "students cannot see each other's
            // work" structural rather than a check that could be forgotten.
            .Where(s => s.Id == submissionId && s.StudentId == studentId)
            .Select(SubmissionProjection)
            .FirstOrDefaultAsync(ct)
            ?? throw new NotFoundException("Submission", submissionId);
    }

    public async Task<StudentSubmissionDto> SubmitAsync(
        Guid assignmentId, SubmitAssignmentRequest request, CancellationToken ct = default)
    {
        var studentId = currentUser.RequireUserId();
        var now = dateTime.UtcNow;

        var assignment = await VisibleTo(studentId)
            .FirstOrDefaultAsync(a => a.Id == assignmentId, ct)
            ?? throw new NotFoundException("Assignment", assignmentId);

        // Checked here for a clear message; the unique index on
        // (assignment_id, student_id) is what actually holds under concurrency.
        if (await context.Submissions.AnyAsync(
                s => s.AssignmentId == assignmentId && s.StudentId == studentId, ct))
        {
            throw new ConflictException(
                "You have already submitted this assignment. Update your existing submission instead.");
        }

        var isPastDeadline = assignment.Deadline < now;

        if (isPastDeadline && !assignment.AllowLateSubmission)
        {
            throw new BusinessRuleException(
                "The deadline for this assignment has passed and late submissions are not accepted.");
        }

        var submission = new Submission
        {
            AssignmentId = assignmentId,
            StudentId = studentId,
            Content = request.Content.Trim(),
            ContentJson = request.ContentJson,
            AttachmentUrl = string.IsNullOrWhiteSpace(request.AttachmentUrl)
                ? null
                : request.AttachmentUrl.Trim(),
            SubmittedAt = now,
            // Recorded now rather than derived on read, so a later change to the
            // assignment's deadline cannot retroactively make this late.
            IsLate = isPastDeadline,
            Status = SubmissionStatus.Submitted
        };

        context.Submissions.Add(submission);
        await context.SaveChangesAsync(ct);

        logger.LogInformation(
            "Student {StudentId} submitted assignment {AssignmentId} (late: {IsLate}).",
            studentId, assignmentId, isPastDeadline);

        await notifications.SubmissionReceivedAsync(submission.Id, ct);

        return await GetSubmissionAsync(submission.Id, ct);
    }

    public async Task<StudentSubmissionDto> UpdateSubmissionAsync(
        Guid submissionId, UpdateSubmissionRequest request, CancellationToken ct = default)
    {
        var studentId = currentUser.RequireUserId();
        var now = dateTime.UtcNow;

        var submission = await context.Submissions
            .Include(s => s.Assignment)
            .FirstOrDefaultAsync(s => s.Id == submissionId && s.StudentId == studentId, ct)
            ?? throw new NotFoundException("Submission", submissionId);

        // Graded work is settled; editing it would invalidate the mark.
        if (submission.Status == SubmissionStatus.Graded)
        {
            throw new BusinessRuleException(
                "This submission has been graded and can no longer be edited.");
        }

        // "Update a submission before the deadline, if allowed" — the deadline
        // always applies, whatever the resubmission setting.
        if (submission.Assignment.Deadline < now)
        {
            throw new BusinessRuleException(
                "The deadline has passed, so this submission can no longer be edited.");
        }

        // Otherwise editing needs either the assignment's permission, or a
        // teacher having explicitly sent the work back.
        if (!submission.Assignment.AllowResubmission
            && submission.Status != SubmissionStatus.ReturnedForRevision)
        {
            throw new BusinessRuleException(
                "This assignment does not allow submissions to be changed once made.");
        }

        submission.Content = request.Content.Trim();
        // Left alone when absent, so a plain-text client cannot silently discard
        // the rich document a student wrote in the editor.
        submission.ContentJson = request.ContentJson ?? submission.ContentJson;
        submission.AttachmentUrl = string.IsNullOrWhiteSpace(request.AttachmentUrl)
            ? null
            : request.AttachmentUrl.Trim();
        submission.LastUpdatedAt = now;

        // Re-editing after a teacher returned it puts the work back in the queue.
        if (submission.Status == SubmissionStatus.ReturnedForRevision)
        {
            submission.Status = SubmissionStatus.Submitted;
        }

        await context.SaveChangesAsync(ct);

        logger.LogInformation("Student {StudentId} updated submission {SubmissionId}.",
            studentId, submissionId);

        return await GetSubmissionAsync(submissionId, ct);
    }

    public async Task<StudentDashboardDto> GetDashboardAsync(CancellationToken ct = default)
    {
        var studentId = currentUser.RequireUserId();
        var now = dateTime.UtcNow;

        var visible = VisibleTo(studentId);

        var stats = await visible
            .Select(a => new
            {
                a.Deadline,
                Submission = a.Submissions
                    .Where(s => s.StudentId == studentId)
                    .Select(s => new { s.Status, s.Marks })
                    .FirstOrDefault(),
                a.MaxMarks
            })
            .ToListAsync(ct);

        var graded = stats
            .Where(s => s.Submission != null && s.Submission.Marks != null && s.MaxMarks > 0)
            .ToList();

        // Averaged as a percentage rather than raw marks, since assignments are
        // out of different totals and a raw mean would be meaningless.
        decimal? averagePercentage = graded.Count > 0
            ? Math.Round(graded.Average(s => s.Submission!.Marks!.Value / s.MaxMarks * 100), 1)
            : null;

        var dueSoon = await visible
            .Where(a => a.Deadline >= now && !a.Submissions.Any(s => s.StudentId == studentId))
            .OrderBy(a => a.Deadline)
            .Take(5)
            .Select(ListProjection(studentId, now))
            .ToListAsync(ct);

        return new StudentDashboardDto(
            TotalAssignments: stats.Count,
            SubmittedCount: stats.Count(s => s.Submission != null),
            PendingCount: stats.Count(s => s.Submission == null && s.Deadline >= now),
            GradedCount: stats.Count(s => s.Submission?.Status == SubmissionStatus.Graded),
            OverdueCount: stats.Count(s => s.Submission == null && s.Deadline < now),
            AverageMarkPercentage: averagePercentage,
            DueSoon: dueSoon);
    }

    // -----------------------------------------------------------------------

    /// <summary>
    /// Assignments this student may see: published only, and only for classes
    /// they are enrolled in. Drafts and archived work never appear.
    /// </summary>
    private IQueryable<DomainAssignment> VisibleTo(Guid studentId) =>
        context.Assignments
            .AsNoTracking()
            .Where(a => a.Status == AssignmentStatus.Published)
            .Where(a => context.Enrollments.Any(e =>
                e.StudentId == studentId && e.ClassId == a.ClassSubject.ClassId));

    /// <summary>
    /// Works out whether the student can act, and why not if they cannot.
    ///
    /// Mirrors the rules enforced in <see cref="SubmitAsync"/> and
    /// <see cref="UpdateSubmissionAsync"/>. The server decides, so the UI can
    /// disable a button with an accurate explanation instead of guessing — and
    /// a client that ignores the flags is still refused by the write path.
    /// </summary>
    private static (bool CanSubmit, bool CanEdit, string? BlockedReason) EvaluateAvailability(
        bool hasSubmission,
        SubmissionStatus? submissionStatus,
        bool isPastDeadline,
        bool allowLate,
        bool allowResubmission)
    {
        if (!hasSubmission)
        {
            if (!isPastDeadline)
            {
                return (true, false, null);
            }

            return allowLate
                ? (true, false, "The deadline has passed — this will be marked as a late submission.")
                : (false, false, "The deadline has passed and late submissions are not accepted.");
        }

        if (submissionStatus == SubmissionStatus.Graded)
        {
            return (false, false, "This submission has been graded and can no longer be edited.");
        }

        if (isPastDeadline)
        {
            return (false, false, "The deadline has passed, so this submission can no longer be edited.");
        }

        if (allowResubmission || submissionStatus == SubmissionStatus.ReturnedForRevision)
        {
            return (false, true, null);
        }

        return (false, false, "This assignment does not allow submissions to be changed once made.");
    }

    private static Expression<Func<DomainAssignment, StudentAssignmentDto>> ListProjection(
        Guid studentId, DateTimeOffset now) =>
        a => new StudentAssignmentDto(
            a.Id,
            a.Title,
            a.ClassSubject.Class.Name,
            a.ClassSubject.Class.Code,
            a.ClassSubject.Subject.Name,
            a.ClassSubject.Subject.Code,
            a.Deadline,
            a.MaxMarks,
            a.CreatedByTeacher.FullName,
            a.Deadline < now,
            a.AllowLateSubmission,
            a.AllowResubmission,
            a.Submissions.Any(s => s.StudentId == studentId),
            a.Submissions.Where(s => s.StudentId == studentId)
                .Select(s => (SubmissionStatus?)s.Status).FirstOrDefault(),
            a.Submissions.Where(s => s.StudentId == studentId)
                .Select(s => s.Marks).FirstOrDefault(),
            a.Submissions.Where(s => s.StudentId == studentId)
                .Select(s => s.IsLate).FirstOrDefault(),
            a.Submissions.Where(s => s.StudentId == studentId)
                .Select(s => (DateTimeOffset?)s.SubmittedAt).FirstOrDefault());

    private static readonly Expression<Func<Submission, StudentSubmissionDto>> SubmissionProjection =
        s => new StudentSubmissionDto(
            s.Id,
            s.AssignmentId,
            s.Assignment.Title,
            s.Content,
            s.AttachmentUrl,
            s.SubmittedAt,
            s.LastUpdatedAt,
            s.IsLate,
            s.Status,
            s.Marks,
            s.Assignment.MaxMarks,
            s.GradedByTeacher != null ? s.GradedByTeacher.FullName : null,
            s.GradedAt,
            s.Feedbacks
                .OrderBy(f => f.CreatedAt)
                .Select(f => new StudentFeedbackDto(
                    f.Teacher.FullName, f.Comment, f.MarksAtTime, f.CreatedAt))
                .ToList());
}
