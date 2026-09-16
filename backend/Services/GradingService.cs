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
                a.Id, a.Title, a.MaxMarks, a.GradingType, a.Deadline, a.ClassSubjectId,
                ClassId = a.ClassSubject.ClassId,
                Rubric = a.RubricCriteria
                    .OrderBy(c => c.Order)
                    .Select(c => new GradedCriterionDto(
                        c.Id, c.Order, c.Title, c.Description, c.MaxPoints, null, null))
                    .ToList()
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
            assignment.GradingType,
            assignment.Rubric,
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
        var assignment = submission.Assignment;

        // For a rubric the total is derived from the criteria rather than typed,
        // so the mark is computed here and the request's own figure ignored.
        var marks = assignment.GradingType == GradingType.Rubric
            ? await ApplyRubricAsync(submission, request.CriterionScores, ct)
            : request.Marks;

        // The rules belong to the assignment, so they cannot live in a validator
        // that only ever sees the request.
        if (!assignment.IsValidMark(marks))
        {
            throw new BusinessRuleException(assignment.GradingType == GradingType.PassFail
                ? "This assignment is marked pass or fail, so the result must be one or the other."
                : $"Marks must be between 0 and {assignment.MaxMarks} for this assignment.");
        }

        var now = dateTime.UtcNow;
        var teacherId = currentUser.RequireUserId();

        submission.Marks = marks;
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
                MarksAtTime = marks
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

    /// <summary>
    /// Records the per-criterion scores and returns their total.
    /// </summary>
    /// <remarks>
    /// Every criterion must be scored. A partial rubric would produce a total
    /// that looks like a mark but silently omits whatever was skipped, and the
    /// student would have no way to tell the difference between "scored zero"
    /// and "not looked at".
    ///
    /// Existing scores are updated rather than added to, so re-marking replaces
    /// the result instead of doubling it.
    /// </remarks>
    private async Task<decimal> ApplyRubricAsync(
        Submission submission,
        IReadOnlyList<CriterionScoreInput>? scores,
        CancellationToken ct)
    {
        var criteria = await context.RubricCriteria
            .AsNoTracking()
            .Where(c => c.AssignmentId == submission.AssignmentId)
            .OrderBy(c => c.Order)
            .ToListAsync(ct);

        if (criteria.Count == 0)
        {
            throw new BusinessRuleException(
                "This assignment is marked by rubric but has no criteria. Edit the assignment "
                + "and add them before marking.");
        }

        var supplied = (scores ?? [])
            .GroupBy(s => s.CriterionId)
            .ToDictionary(g => g.Key, g => g.Last());

        var missing = criteria.Where(c => !supplied.ContainsKey(c.Id)).ToList();

        if (missing.Count > 0)
        {
            throw new BusinessRuleException(
                $"Score every criterion before saving. Still to do: "
                + string.Join(", ", missing.Select(c => $"'{c.Title}'")) + ".");
        }

        var existing = await context.SubmissionCriterionScores
            .Where(s => s.SubmissionId == submission.Id)
            .ToListAsync(ct);

        decimal total = 0;

        foreach (var criterion in criteria)
        {
            var input = supplied[criterion.Id];

            if (input.Points < 0 || input.Points > criterion.MaxPoints)
            {
                throw new BusinessRuleException(
                    $"'{criterion.Title}' is out of {criterion.MaxPoints}, so {input.Points} "
                    + "is not a possible score.");
            }

            total += input.Points;

            var comment = string.IsNullOrWhiteSpace(input.Comment) ? null : input.Comment.Trim();
            var row = existing.FirstOrDefault(s => s.RubricCriterionId == criterion.Id);

            if (row is null)
            {
                context.SubmissionCriterionScores.Add(new SubmissionCriterionScore
                {
                    SubmissionId = submission.Id,
                    RubricCriterionId = criterion.Id,
                    Points = input.Points,
                    Comment = comment,
                });
            }
            else
            {
                row.Points = input.Points;
                row.Comment = comment;
            }
        }

        return total;
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
            s.Assignment.GradingType,
            // The rubric with this submission's scores folded in, so the
            // grading screen renders from one shape rather than joining two.
            s.Assignment.RubricCriteria
                .OrderBy(c => c.Order)
                .Select(c => new GradedCriterionDto(
                    c.Id,
                    c.Order,
                    c.Title,
                    c.Description,
                    c.MaxPoints,
                    s.CriterionScores
                        .Where(x => x.RubricCriterionId == c.Id)
                        .Select(x => (decimal?)x.Points)
                        .FirstOrDefault(),
                    s.CriterionScores
                        .Where(x => x.RubricCriterionId == c.Id)
                        .Select(x => x.Comment)
                        .FirstOrDefault()))
                .ToList(),
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
