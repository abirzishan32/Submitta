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
using DomainAssignment = AssignmentSystem.Domain.Entities.Assignment;

namespace AssignmentSystem.Application.Features.Teacher.Assignments;

public interface IAssignmentService
{
    /// <summary>
    /// Offerings the caller may create assignments for — their own if a Teacher,
    /// all of them if an Admin. Populates the class/subject picker.
    /// </summary>
    Task<IReadOnlyList<OfferingOptionDto>> ListMyOfferingsAsync(CancellationToken ct = default);

    Task<PagedResult<AssignmentDto>> ListAsync(AssignmentListQuery query, CancellationToken ct = default);
    Task<AssignmentDetailDto> GetAsync(Guid id, CancellationToken ct = default);
    Task<AssignmentDetailDto> CreateAsync(CreateAssignmentRequest request, CancellationToken ct = default);
    Task<AssignmentDetailDto> UpdateAsync(Guid id, UpdateAssignmentRequest request, CancellationToken ct = default);
    Task<AssignmentDetailDto> PublishAsync(Guid id, CancellationToken ct = default);
    Task<AssignmentDetailDto> UnpublishAsync(Guid id, CancellationToken ct = default);
    Task<AssignmentDetailDto> ArchiveAsync(Guid id, CancellationToken ct = default);
    Task DeleteAsync(Guid id, CancellationToken ct = default);
}

/// <summary>
/// Teacher-side assignment management.
///
/// Every method is scoped to offerings the caller actually teaches — an Admin
/// sees everything, a Teacher only their own. That scoping happens in the query
/// itself rather than as an after-the-fact check, so another teacher's work is
/// not merely hidden from the response but never selected.
/// </summary>
public sealed class AssignmentService(
    IAppDbContext context,
    IAccessControl access,
    ICurrentUser currentUser,
    IDateTimeProvider dateTime,
    INotificationDispatcher notifications,
    ILogger<AssignmentService> logger) : IAssignmentService
{
    private static readonly Dictionary<string, Expression<Func<DomainAssignment, object>>> Sortable = new()
    {
        ["title"] = a => a.Title,
        ["deadline"] = a => a.Deadline,
        ["maxMarks"] = a => a.MaxMarks,
        ["status"] = a => a.Status,
        ["createdAt"] = a => a.CreatedAt
    };

    public async Task<IReadOnlyList<OfferingOptionDto>> ListMyOfferingsAsync(
        CancellationToken ct = default)
    {
        var offerings = context.ClassSubjects.AsNoTracking();

        if (!access.IsAdmin)
        {
            var teacherId = currentUser.RequireUserId();
            offerings = offerings.Where(cs =>
                cs.TeacherAssignments.Any(ta => ta.TeacherId == teacherId));
        }

        return await offerings
            .OrderBy(cs => cs.Class.Code)
            .ThenBy(cs => cs.Subject.Name)
            .Select(cs => new OfferingOptionDto(
                cs.Id,
                cs.ClassId,
                cs.Class.Name,
                cs.Class.Code,
                cs.SubjectId,
                cs.Subject.Name,
                cs.Subject.Code,
                cs.Class.Enrollments.Count))
            .ToListAsync(ct);
    }

    public async Task<PagedResult<AssignmentDto>> ListAsync(
        AssignmentListQuery query, CancellationToken ct = default)
    {
        var assignments = Scoped();

        if (query.ClassSubjectId is { } offeringId)
        {
            assignments = assignments.Where(a => a.ClassSubjectId == offeringId);
        }

        if (query.ClassId is { } classId)
        {
            assignments = assignments.Where(a => a.ClassSubject.ClassId == classId);
        }

        if (query.SubjectId is { } subjectId)
        {
            assignments = assignments.Where(a => a.ClassSubject.SubjectId == subjectId);
        }

        if (query.Status is { } status)
        {
            assignments = assignments.Where(a => a.Status == status);
        }

        if (query.PastDeadline is { } pastDeadline)
        {
            var now = dateTime.UtcNow;
            assignments = pastDeadline
                ? assignments.Where(a => a.Deadline < now)
                : assignments.Where(a => a.Deadline >= now);
        }

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var term = query.Search.Trim().ToLowerInvariant();
            assignments = assignments.Where(a =>
                a.Title.ToLower().Contains(term) ||
                a.ClassSubject.Class.Name.ToLower().Contains(term) ||
                a.ClassSubject.Subject.Name.ToLower().Contains(term));
        }

        return await assignments
            .ApplySort(query.SortBy, query.SortDescending, Sortable, a => a.Deadline)
            .ToPagedResultAsync(query, ListProjection, ct);
    }

    public async Task<AssignmentDetailDto> GetAsync(Guid id, CancellationToken ct = default)
    {
        var now = dateTime.UtcNow;

        return await Scoped()
            .Where(a => a.Id == id)
            .Select(DetailProjection(now))
            .FirstOrDefaultAsync(ct)
            // Scoped() already excludes offerings the caller does not teach, so a
            // miss here is reported as "not found" rather than "forbidden" — a
            // teacher has no business learning that another class's work exists.
            ?? throw new NotFoundException("Assignment", id);
    }

    public async Task<AssignmentDetailDto> CreateAsync(
        CreateAssignmentRequest request, CancellationToken ct = default)
    {
        await access.EnsureCanManageOfferingAsync(request.ClassSubjectId, ct);

        var now = dateTime.UtcNow;

        if (request.PublishImmediately)
        {
            EnsureDeadlineIsInFuture(request.Deadline, now);
        }

        var rubric = NormaliseRubric(request.GradingType, request.Rubric);
        var maxMarks = ResolveMaxMarks(request.GradingType, request.MaxMarks, rubric);

        var entity = new DomainAssignment
        {
            Title = request.Title.Trim(),
            Description = request.Description.Trim(),
            DescriptionJson = request.DescriptionJson,
            ClassSubjectId = request.ClassSubjectId,
            CreatedByTeacherId = currentUser.RequireUserId(),
            Deadline = request.Deadline,
            MaxMarks = maxMarks,
            GradingType = request.GradingType,
            AllowResubmission = request.AllowResubmission,
            AllowLateSubmission = request.AllowLateSubmission,
            Status = request.PublishImmediately ? AssignmentStatus.Published : AssignmentStatus.Draft,
            PublishedAt = request.PublishImmediately ? now : null
        };

        context.Assignments.Add(entity);

        for (var i = 0; i < rubric.Count; i++)
        {
            context.RubricCriteria.Add(new RubricCriterion
            {
                AssignmentId = entity.Id,
                Order = i,
                Title = rubric[i].Title.Trim(),
                Description = string.IsNullOrWhiteSpace(rubric[i].Description)
                    ? null
                    : rubric[i].Description!.Trim(),
                MaxPoints = rubric[i].MaxPoints,
            });
        }

        await context.SaveChangesAsync(ct);

        logger.LogInformation("Teacher {TeacherId} created assignment {AssignmentId} ({Status}).",
            currentUser.UserId, entity.Id, entity.Status);

        // Only published work is announced. A draft is invisible to students,
        // so telling them about it would leak work not yet set.
        if (entity.Status == AssignmentStatus.Published)
        {
            await notifications.AssignmentPublishedAsync(entity.Id, ct);
        }

        return await GetAsync(entity.Id, ct);
    }

    public async Task<AssignmentDetailDto> UpdateAsync(
        Guid id, UpdateAssignmentRequest request, CancellationToken ct = default)
    {
        var entity = await LoadForWriteAsync(id, ct);
        var now = dateTime.UtcNow;

        var hasSubmissions = await context.Submissions.AnyAsync(s => s.AssignmentId == id, ct);

        var rubric = NormaliseRubric(request.GradingType, request.Rubric);
        var maxMarks = ResolveMaxMarks(request.GradingType, request.MaxMarks, rubric);

        // Changing how work is judged after some of it has been judged would
        // leave one cohort marked one way and the rest another, with no record
        // of which is which.
        if (request.GradingType != entity.GradingType && hasSubmissions)
        {
            throw new BusinessRuleException(
                "Work has already been submitted, so the grading method can no longer be "
                + "changed. Marks already awarded would no longer mean what they say.");
        }

        // Lowering the ceiling below marks already awarded would leave grades
        // above the maximum, which no later validation could repair.
        if (maxMarks != entity.MaxMarks && hasSubmissions)
        {
            var highestAwarded = await context.Submissions
                .Where(s => s.AssignmentId == id && s.Marks != null)
                .MaxAsync(s => (decimal?)s.Marks, ct);

            if (highestAwarded > maxMarks)
            {
                throw new BusinessRuleException(
                    $"Marks of {highestAwarded} have already been awarded, so the maximum "
                    + $"cannot be reduced to {maxMarks}.");
            }
        }

        // Bringing a live deadline forward into the past would retroactively make
        // students late for work they still had time for.
        if (entity.Status == AssignmentStatus.Published
            && request.Deadline != entity.Deadline
            && request.Deadline < now)
        {
            throw new BusinessRuleException(
                "The deadline of a published assignment cannot be moved into the past.");
        }

        entity.Title = request.Title.Trim();
        entity.Description = request.Description.Trim();
        entity.DescriptionJson = request.DescriptionJson;
        entity.Deadline = request.Deadline;
        entity.MaxMarks = maxMarks;
        entity.GradingType = request.GradingType;
        entity.AllowResubmission = request.AllowResubmission;
        entity.AllowLateSubmission = request.AllowLateSubmission;

        await ReplaceRubricAsync(id, rubric, ct);
        await context.SaveChangesAsync(ct);

        logger.LogInformation("Teacher {TeacherId} updated assignment {AssignmentId}.",
            currentUser.UserId, id);

        return await GetAsync(id, ct);
    }

    public async Task<AssignmentDetailDto> PublishAsync(Guid id, CancellationToken ct = default)
    {
        var entity = await LoadForWriteAsync(id, ct);
        var now = dateTime.UtcNow;

        if (entity.Status == AssignmentStatus.Published)
        {
            throw new BusinessRuleException("This assignment is already published.");
        }

        // Publishing work that is already overdue gives students no time at all.
        EnsureDeadlineIsInFuture(entity.Deadline, now);

        entity.Status = AssignmentStatus.Published;
        entity.PublishedAt = now;

        await context.SaveChangesAsync(ct);

        logger.LogInformation("Teacher {TeacherId} published assignment {AssignmentId}.",
            currentUser.UserId, id);

        await notifications.AssignmentPublishedAsync(id, ct);

        return await GetAsync(id, ct);
    }

    public async Task<AssignmentDetailDto> UnpublishAsync(Guid id, CancellationToken ct = default)
    {
        var entity = await LoadForWriteAsync(id, ct);

        if (entity.Status != AssignmentStatus.Published)
        {
            throw new BusinessRuleException("Only a published assignment can be returned to draft.");
        }

        // Withdrawing work students have already answered would hide their
        // submissions from them. Archiving is the correct move at that point.
        if (await context.Submissions.AnyAsync(s => s.AssignmentId == id, ct))
        {
            throw new ConflictException(
                "Students have already submitted work, so this assignment cannot be returned to draft. "
                + "Archive it instead.");
        }

        entity.Status = AssignmentStatus.Draft;
        entity.PublishedAt = null;

        await context.SaveChangesAsync(ct);

        logger.LogInformation("Teacher {TeacherId} unpublished assignment {AssignmentId}.",
            currentUser.UserId, id);

        return await GetAsync(id, ct);
    }

    public async Task<AssignmentDetailDto> ArchiveAsync(Guid id, CancellationToken ct = default)
    {
        var entity = await LoadForWriteAsync(id, ct);

        if (entity.Status == AssignmentStatus.Archived)
        {
            throw new BusinessRuleException("This assignment is already archived.");
        }

        entity.Status = AssignmentStatus.Archived;
        await context.SaveChangesAsync(ct);

        logger.LogInformation("Teacher {TeacherId} archived assignment {AssignmentId}.",
            currentUser.UserId, id);

        return await GetAsync(id, ct);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var entity = await LoadForWriteAsync(id, ct);

        // Deleting work students have answered would take their marks and
        // feedback with it. Archiving keeps the record and hides the assignment.
        if (await context.Submissions.AnyAsync(s => s.AssignmentId == id, ct))
        {
            throw new ConflictException(
                "Students have already submitted work for this assignment, so it cannot be deleted. "
                + "Archive it instead.");
        }

        context.Assignments.Remove(entity);
        await context.SaveChangesAsync(ct);

        logger.LogInformation("Teacher {TeacherId} deleted assignment {AssignmentId}.",
            currentUser.UserId, id);
    }

    // -----------------------------------------------------------------------

    /// <summary>
    /// Assignments the caller may see: everything for an Admin, only their own
    /// offerings for a Teacher.
    /// </summary>
    private IQueryable<DomainAssignment> Scoped()
    {
        var assignments = context.Assignments.AsNoTracking();

        if (access.IsAdmin)
        {
            return assignments;
        }

        var teacherId = currentUser.RequireUserId();

        return assignments.Where(a => a.ClassSubject.TeacherAssignments
            .Any(ta => ta.TeacherId == teacherId));
    }

    /// <summary>
    /// Loads a tracked assignment after confirming the caller may modify it.
    /// </summary>
    private async Task<DomainAssignment> LoadForWriteAsync(Guid id, CancellationToken ct)
    {
        var entity = await context.Assignments.FirstOrDefaultAsync(a => a.Id == id, ct)
            ?? throw new NotFoundException("Assignment", id);

        await access.EnsureCanManageOfferingAsync(entity.ClassSubjectId, ct);
        return entity;
    }

    /// <summary>
    /// Brings the stored rubric into line with what the teacher submitted.
    /// </summary>
    /// <remarks>
    /// Criteria carry an id so an edit updates the existing row rather than
    /// replacing it. That matters because scores point at criteria: swapping a
    /// row out would either orphan the marks already given against it or, worse,
    /// silently re-attach them to a criterion that now means something else.
    ///
    /// Removing a criterion that has already been marked against is refused
    /// outright, for the same reason.
    /// </remarks>
    private async Task ReplaceRubricAsync(
        Guid assignmentId, IReadOnlyList<RubricCriterionInput> rubric, CancellationToken ct)
    {
        var existing = await context.RubricCriteria
            .Where(c => c.AssignmentId == assignmentId)
            .ToListAsync(ct);

        var keptIds = rubric.Where(c => c.Id is not null).Select(c => c.Id!.Value).ToHashSet();
        var removed = existing.Where(c => !keptIds.Contains(c.Id)).ToList();

        if (removed.Count > 0)
        {
            var removedIds = removed.Select(c => c.Id).ToList();

            var alreadyMarked = await context.SubmissionCriterionScores
                .AnyAsync(s => removedIds.Contains(s.RubricCriterionId), ct);

            if (alreadyMarked)
            {
                throw new BusinessRuleException(
                    "A criterion you removed has already been marked against. Marks awarded "
                    + "for it would be lost, so the rubric cannot be changed that way.");
            }

            context.RubricCriteria.RemoveRange(removed);
        }

        for (var i = 0; i < rubric.Count; i++)
        {
            var input = rubric[i];

            var description = string.IsNullOrWhiteSpace(input.Description)
                ? null
                : input.Description!.Trim();

            var match = input.Id is { } id ? existing.FirstOrDefault(c => c.Id == id) : null;

            if (match is null)
            {
                context.RubricCriteria.Add(new RubricCriterion
                {
                    AssignmentId = assignmentId,
                    Order = i,
                    Title = input.Title.Trim(),
                    Description = description,
                    MaxPoints = input.MaxPoints,
                });

                continue;
            }

            match.Order = i;
            match.Title = input.Title.Trim();
            match.Description = description;
            match.MaxPoints = input.MaxPoints;
        }
    }

    /// <summary>
    /// The rubric a request is really asking for, checked.
    /// </summary>
    /// <remarks>
    /// A rubric is only meaningful for the Rubric type; sending one alongside
    /// Points would leave criteria in the database that nothing scores against,
    /// and which would silently start applying if the type were changed later.
    /// So a rubric on any other type is discarded rather than stored.
    /// </remarks>
    private static IReadOnlyList<RubricCriterionInput> NormaliseRubric(
        GradingType type, IReadOnlyList<RubricCriterionInput>? rubric)
    {
        if (type != GradingType.Rubric) return [];

        var criteria = (rubric ?? [])
            .Where(c => !string.IsNullOrWhiteSpace(c.Title))
            .ToList();

        if (criteria.Count == 0)
        {
            throw new BusinessRuleException(
                "A rubric-graded assignment needs at least one criterion. "
                + "Add what the work is judged on, and what each part is worth.");
        }

        if (criteria.Any(c => c.MaxPoints <= 0))
        {
            throw new BusinessRuleException("Every rubric criterion must be worth more than zero.");
        }

        // Duplicated headings make a mark sheet impossible to read, and make
        // "which one did I lose marks on?" unanswerable.
        var duplicate = criteria
            .GroupBy(c => c.Title.Trim(), StringComparer.OrdinalIgnoreCase)
            .FirstOrDefault(g => g.Count() > 1);

        if (duplicate is not null)
        {
            throw new BusinessRuleException(
                $"Two rubric criteria are both called '{duplicate.Key}'. Give each a distinct name.");
        }

        return criteria;
    }

    /// <summary>
    /// The total this assignment is out of.
    /// </summary>
    /// <remarks>
    /// Some grading types decide it rather than the teacher: a percentage is out
    /// of 100 or it is not a percentage, a pass is one mark out of one, and a
    /// rubric totals its own criteria. Resolving it here rather than trusting
    /// the request means the stored maximum can never contradict the type.
    /// </remarks>
    private static decimal ResolveMaxMarks(
        GradingType type, decimal requested, IReadOnlyList<RubricCriterionInput> rubric)
    {
        if (type == GradingType.Rubric) return rubric.Sum(c => c.MaxPoints);

        return DomainAssignment.FixedMaxMarksFor(type) ?? requested;
    }

    private static void EnsureDeadlineIsInFuture(DateTimeOffset deadline, DateTimeOffset now)
    {
        if (deadline <= now)
        {
            throw new BusinessRuleException(
                "The deadline must be in the future to publish this assignment.");
        }
    }

    private static readonly Expression<Func<DomainAssignment, AssignmentDto>> ListProjection =
        a => new AssignmentDto(
            a.Id,
            a.Title,
            a.ClassSubjectId,
            a.ClassSubject.Class.Name,
            a.ClassSubject.Class.Code,
            a.ClassSubject.Subject.Name,
            a.ClassSubject.Subject.Code,
            a.Deadline,
            a.MaxMarks,
            a.GradingType,
            a.Status,
            a.PublishedAt,
            a.AllowResubmission,
            a.AllowLateSubmission,
            a.CreatedByTeacher.FullName,
            a.Submissions.Count,
            a.Submissions.Count(s => s.Status == SubmissionStatus.Graded),
            a.ClassSubject.Class.Enrollments.Count,
            a.CreatedAt);

    /// <summary>
    /// Built per call because it closes over "now" to compute IsPastDeadline
    /// inside the SQL projection.
    /// </summary>
    private static Expression<Func<DomainAssignment, AssignmentDetailDto>> DetailProjection(
        DateTimeOffset now) =>
        a => new AssignmentDetailDto(
            a.Id,
            a.Title,
            a.Description,
            a.DescriptionJson,
            a.ClassSubjectId,
            a.ClassSubject.Class.Name,
            a.ClassSubject.Class.Code,
            a.ClassSubject.Subject.Name,
            a.ClassSubject.Subject.Code,
            a.Deadline,
            a.MaxMarks,
            a.GradingType,
            a.RubricCriteria
                .OrderBy(c => c.Order)
                .Select(c => new RubricCriterionDto(
                    c.Id, c.Order, c.Title, c.Description, c.MaxPoints))
                .ToList(),
            a.Status,
            a.PublishedAt,
            a.AllowResubmission,
            a.AllowLateSubmission,
            a.CreatedByTeacherId,
            a.CreatedByTeacher.FullName,
            a.Submissions.Count,
            a.Submissions.Count(s => s.Status == SubmissionStatus.Graded),
            a.ClassSubject.Class.Enrollments.Count,
            a.Deadline < now,
            a.CreatedAt,
            a.UpdatedAt);
}
