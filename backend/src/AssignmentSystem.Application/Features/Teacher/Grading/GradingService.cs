using System.Linq.Expressions;
using AssignmentSystem.Application.Common.Extensions;
using AssignmentSystem.Application.Common.Interfaces;
using AssignmentSystem.Application.Features.Notifications;
using AssignmentSystem.Application.Common.Models;
using AssignmentSystem.Application.Common.Security;
using AssignmentSystem.Domain.Entities;
using AssignmentSystem.Domain.Enums;
using AssignmentSystem.Domain.Exceptions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace AssignmentSystem.Application.Features.Teacher.Grading;

public interface IGradingService
{
    Task<PagedResult<SubmissionSummaryDto>> ListAsync(SubmissionListQuery query, CancellationToken ct = default);
    Task<AssignmentSubmissionsDto> ListForAssignmentAsync(Guid assignmentId, CancellationToken ct = default);
    Task<SubmissionDetailDto> GetAsync(Guid submissionId, CancellationToken ct = default);
    Task<SubmissionDetailDto> GradeAsync(Guid submissionId, GradeSubmissionRequest request, CancellationToken ct = default);
    Task<SubmissionDetailDto> AddFeedbackAsync(Guid submissionId, AddFeedbackRequest request, CancellationToken ct = default);
    Task<SubmissionDetailDto> ChangeStatusAsync(Guid submissionId, ChangeSubmissionStatusRequest request, CancellationToken ct = default);
}

/// <summary>
/// Teacher review of submissions: marks, feedback and workflow status.
/// </summary>
public sealed class GradingService(
    IAppDbContext context,
    IAccessControl access,
    ICurrentUser currentUser,
    IDateTimeProvider dateTime,
    INotificationDispatcher notifications,
    ILogger<GradingService> logger) : IGradingService
{
    private static readonly Dictionary<string, Expression<Func<Submission, object>>> Sortable = new()
    {
        ["studentName"] = s => s.Student.FullName,
        ["submittedAt"] = s => s.SubmittedAt,
        ["status"] = s => s.Status,
        ["marks"] = s => s.Marks!
    };

    public async Task<PagedResult<SubmissionSummaryDto>> ListAsync(
        SubmissionListQuery query, CancellationToken ct = default)
    {
        var submissions = Scoped();

        if (query.AssignmentId is { } assignmentId)
        {
            submissions = submissions.Where(s => s.AssignmentId == assignmentId);
        }

        if (query.ClassSubjectId is { } offeringId)
        {
            submissions = submissions.Where(s => s.Assignment.ClassSubjectId == offeringId);
        }

        if (query.StudentId is { } studentId)
        {
            submissions = submissions.Where(s => s.StudentId == studentId);
        }

        if (query.Status is { } status)
        {
            submissions = submissions.Where(s => s.Status == status);
        }

        if (query.IsLate is { } isLate)
        {
            submissions = submissions.Where(s => s.IsLate == isLate);
        }

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var term = query.Search.Trim().ToLowerInvariant();
            submissions = submissions.Where(s =>
                s.Student.FullName.ToLower().Contains(term) ||
                s.Student.Email.ToLower().Contains(term) ||
                s.Assignment.Title.ToLower().Contains(term));
        }

        return await submissions
            .ApplySort(query.SortBy, query.SortDescending, Sortable, s => s.SubmittedAt)
            .ToPagedResultAsync(query, SummaryProjection, ct);
    }

    public async Task<AssignmentSubmissionsDto> ListForAssignmentAsync(
        Guid assignmentId, CancellationToken ct = default)
    {
        var assignment = await context.Assignments
            .AsNoTracking()
            .Where(a => a.Id == assignmentId)
            .Select(a => new
            {
                a.Id, a.Title, a.MaxMarks, a.Deadline, a.ClassSubjectId,
                ClassId = a.ClassSubject.ClassId
            })
            .FirstOrDefaultAsync(ct)
            ?? throw new NotFoundException("Assignment", assignmentId);

        await access.EnsureCanManageOfferingAsync(assignment.ClassSubjectId, ct);

        var submissions = await context.Submissions
            .AsNoTracking()
            .Where(s => s.AssignmentId == assignmentId)
            .OrderBy(s => s.Student.FullName)
            .Select(SummaryProjection)
            .ToListAsync(ct);

        // Who was expected but has not submitted. Without this the teacher can
        // only see who did submit, which is the less useful half of the picture.
        var submittedStudentIds = submissions.Select(s => s.StudentId).ToList();

        var notSubmitted = await context.Enrollments
            .AsNoTracking()
            .Where(e => e.ClassId == assignment.ClassId && !submittedStudentIds.Contains(e.StudentId))
            .OrderBy(e => e.Student.FullName)
            .Select(e => new MissingSubmissionDto(
                e.StudentId, e.Student.FullName, e.Student.Email))
            .ToListAsync(ct);

        var enrolledCount = await context.Enrollments
            .CountAsync(e => e.ClassId == assignment.ClassId, ct);

        return new AssignmentSubmissionsDto(
            assignment.Id,
            assignment.Title,
            assignment.MaxMarks,
            assignment.Deadline,
            enrolledCount,
            submissions.Count,
            submissions.Count(s => s.Status == SubmissionStatus.Graded),
            submissions,
            notSubmitted);
    }

    public async Task<SubmissionDetailDto> GetAsync(
        Guid submissionId, CancellationToken ct = default)
    {
        await access.EnsureCanViewSubmissionAsync(submissionId, ct);

        return await context.Submissions
            .AsNoTracking()
            .Where(s => s.Id == submissionId)
            .Select(DetailProjection)
            .FirstOrDefaultAsync(ct)
            ?? throw new NotFoundException("Submission", submissionId);
    }

    public async Task<SubmissionDetailDto> GradeAsync(
        Guid submissionId, GradeSubmissionRequest request, CancellationToken ct = default)
    {
        var submission = await LoadForGradingAsync(submissionId, ct);

        // The ceiling belongs to the assignment, so it cannot live in a
        // validator that only sees the request.
        if (request.Marks > submission.Assignment.MaxMarks)
        {
            throw new BusinessRuleException(
                $"Marks cannot exceed the maximum of {submission.Assignment.MaxMarks} for this assignment.");
        }

        var now = dateTime.UtcNow;
        var teacherId = currentUser.RequireUserId();

        submission.Marks = request.Marks;
        submission.Status = SubmissionStatus.Graded;
        submission.GradedByTeacherId = teacherId;
        submission.GradedAt = now;

        if (!string.IsNullOrWhiteSpace(request.Feedback))
        {
            context.SubmissionFeedbacks.Add(new SubmissionFeedback
            {
                SubmissionId = submissionId,
                TeacherId = teacherId,
                Comment = request.Feedback.Trim(),
                MarksAtTime = request.Marks
            });
        }

        await context.SaveChangesAsync(ct);

        logger.LogInformation(
            "Teacher {TeacherId} graded submission {SubmissionId}: {Marks}/{MaxMarks}.",
            teacherId, submissionId, request.Marks, submission.Assignment.MaxMarks);

        await notifications.SubmissionGradedAsync(submissionId, ct);

        return await GetAsync(submissionId, ct);
    }

    public async Task<SubmissionDetailDto> AddFeedbackAsync(
        Guid submissionId, AddFeedbackRequest request, CancellationToken ct = default)
    {
        var submission = await LoadForGradingAsync(submissionId, ct);
        var teacherId = currentUser.RequireUserId();

        context.SubmissionFeedbacks.Add(new SubmissionFeedback
        {
            SubmissionId = submissionId,
            TeacherId = teacherId,
            Comment = request.Comment.Trim(),
            MarksAtTime = submission.Marks
        });

        await context.SaveChangesAsync(ct);

        logger.LogInformation("Teacher {TeacherId} commented on submission {SubmissionId}.",
            teacherId, submissionId);

        return await GetAsync(submissionId, ct);
    }

    public async Task<SubmissionDetailDto> ChangeStatusAsync(
        Guid submissionId, ChangeSubmissionStatusRequest request, CancellationToken ct = default)
    {
        var submission = await LoadForGradingAsync(submissionId, ct);
        var teacherId = currentUser.RequireUserId();

        // Graded means marks exist; moving into it without them would violate
        // the database's own check constraint.
        if (request.Status == SubmissionStatus.Graded && submission.Marks is null)
        {
            throw new BusinessRuleException(
                "Award marks before setting this submission to Graded.");
        }

        // Moving out of Graded withdraws the award, so clear the grading record
        // rather than leaving marks attached to an ungraded submission.
        if (submission.Status == SubmissionStatus.Graded && request.Status != SubmissionStatus.Graded)
        {
            submission.Marks = null;
            submission.GradedByTeacherId = null;
            submission.GradedAt = null;
        }

        submission.Status = request.Status;

        if (!string.IsNullOrWhiteSpace(request.Comment))
        {
            context.SubmissionFeedbacks.Add(new SubmissionFeedback
            {
                SubmissionId = submissionId,
                TeacherId = teacherId,
                Comment = request.Comment.Trim(),
                MarksAtTime = submission.Marks
            });
        }

        await context.SaveChangesAsync(ct);

        logger.LogInformation("Teacher {TeacherId} set submission {SubmissionId} to {Status}.",
            teacherId, submissionId, request.Status);

        // Only the states a student needs to act on. Moving work to
        // "under review" is bookkeeping, and telling them about it would bury
        // the notifications that matter.
        if (request.Status == SubmissionStatus.ReturnedForRevision)
        {
            await notifications.SubmissionReturnedAsync(submissionId, ct);
        }
        else if (request.Status == SubmissionStatus.Graded)
        {
            await notifications.SubmissionGradedAsync(submissionId, ct);
        }

        return await GetAsync(submissionId, ct);
    }

    // -----------------------------------------------------------------------

    /// <summary>
    /// Submissions the caller may see: all of them for an Admin, otherwise only
    /// those belonging to offerings the caller teaches.
    /// </summary>
    private IQueryable<Submission> Scoped()
    {
        var submissions = context.Submissions.AsNoTracking();

        if (access.IsAdmin)
        {
            return submissions;
        }

        var teacherId = currentUser.RequireUserId();

        return submissions.Where(s => s.Assignment.ClassSubject.TeacherAssignments
            .Any(ta => ta.TeacherId == teacherId));
    }

    /// <summary>
    /// Loads a tracked submission with its assignment, after confirming the
    /// caller teaches the offering it belongs to.
    /// </summary>
    private async Task<Submission> LoadForGradingAsync(Guid submissionId, CancellationToken ct)
    {
        var submission = await context.Submissions
            .Include(s => s.Assignment)
            .FirstOrDefaultAsync(s => s.Id == submissionId, ct)
            ?? throw new NotFoundException("Submission", submissionId);

        await access.EnsureCanManageOfferingAsync(submission.Assignment.ClassSubjectId, ct);
        return submission;
    }

    private static readonly Expression<Func<Submission, SubmissionSummaryDto>> SummaryProjection =
        s => new SubmissionSummaryDto(
            s.Id,
            s.AssignmentId,
            s.Assignment.Title,
            s.StudentId,
            s.Student.FullName,
            s.Student.Email,
            s.SubmittedAt,
            s.LastUpdatedAt,
            s.IsLate,
            s.Status,
            s.Marks,
            s.Assignment.MaxMarks,
            s.GradedByTeacher != null ? s.GradedByTeacher.FullName : null,
            s.GradedAt,
            s.Feedbacks.Count);

    private static readonly Expression<Func<Submission, SubmissionDetailDto>> DetailProjection =
        s => new SubmissionDetailDto(
            s.Id,
            s.AssignmentId,
            s.Assignment.Title,
            s.Assignment.MaxMarks,
            s.Assignment.Deadline,
            s.StudentId,
            s.Student.FullName,
            s.Student.Email,
            s.Content,
            s.AttachmentUrl,
            s.SubmittedAt,
            s.LastUpdatedAt,
            s.IsLate,
            s.Status,
            s.Marks,
            s.GradedByTeacherId,
            s.GradedByTeacher != null ? s.GradedByTeacher.FullName : null,
            s.GradedAt,
            s.Feedbacks
                .OrderBy(f => f.CreatedAt)
                .Select(f => new FeedbackDto(
                    f.Id, f.TeacherId, f.Teacher.FullName, f.Comment, f.MarksAtTime, f.CreatedAt))
                .ToList());
}
