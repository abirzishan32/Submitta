using System.Linq.Expressions;
using AssignmentSystem.Application.Common.Extensions;
using AssignmentSystem.Application.Common.Interfaces;
using AssignmentSystem.Application.Common.Models;
using AssignmentSystem.Domain.Entities;
using AssignmentSystem.Domain.Enums;
using AssignmentSystem.Domain.Exceptions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace AssignmentSystem.Application.Features.Admin.Academics;

public interface IEnrollmentService
{
    Task<PagedResult<EnrollmentDto>> ListAsync(EnrollmentListQuery query, CancellationToken ct = default);
    Task<EnrollmentDto> CreateAsync(CreateEnrollmentRequest request, CancellationToken ct = default);
    Task<IReadOnlyList<EnrollmentDto>> BulkEnrollAsync(BulkEnrollRequest request, CancellationToken ct = default);
    Task DeleteAsync(Guid id, CancellationToken ct = default);
}

/// <summary>
/// Places students in classes. Enrolment is what makes an assignment visible to
/// a student, so these rules decide who can see what.
/// </summary>
public sealed class EnrollmentService(
    IAppDbContext context,
    ICurrentUser currentUser,
    IDateTimeProvider dateTime,
    ILogger<EnrollmentService> logger) : IEnrollmentService
{
    private static readonly Dictionary<string, Expression<Func<Enrollment, object>>> Sortable = new()
    {
        ["studentName"] = e => e.Student.FullName,
        ["className"] = e => e.Class.Name,
        ["enrolledAt"] = e => e.EnrolledAt
    };

    public async Task<PagedResult<EnrollmentDto>> ListAsync(
        EnrollmentListQuery query, CancellationToken ct = default)
    {
        var enrolments = context.Enrollments.AsNoTracking();

        if (query.ClassId is { } classId)
        {
            enrolments = enrolments.Where(e => e.ClassId == classId);
        }

        if (query.StudentId is { } studentId)
        {
            enrolments = enrolments.Where(e => e.StudentId == studentId);
        }

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var term = query.Search.Trim().ToLowerInvariant();
            enrolments = enrolments.Where(e =>
                e.Student.FullName.ToLower().Contains(term) ||
                e.Student.Email.ToLower().Contains(term) ||
                e.Class.Name.ToLower().Contains(term) ||
                e.Class.Code.ToLower().Contains(term));
        }

        return await enrolments
            .ApplySort(query.SortBy, query.SortDescending, Sortable, e => e.Student.FullName)
            .ToPagedResultAsync(query, Projection, ct);
    }

    public async Task<EnrollmentDto> CreateAsync(
        CreateEnrollmentRequest request, CancellationToken ct = default)
    {
        await EnsureEnrollableAsync(request.StudentId, request.ClassId, ct);

        if (await context.Enrollments.AnyAsync(
                e => e.StudentId == request.StudentId && e.ClassId == request.ClassId, ct))
        {
            throw new ConflictException("This student is already enrolled in this class.");
        }

        var entity = new Enrollment
        {
            StudentId = request.StudentId,
            ClassId = request.ClassId,
            EnrolledAt = dateTime.UtcNow
        };

        context.Enrollments.Add(entity);
        await context.SaveChangesAsync(ct);

        logger.LogInformation("Admin {AdminId} enrolled student {StudentId} in class {ClassId}.",
            currentUser.UserId, request.StudentId, request.ClassId);

        return await ProjectOneAsync(entity.Id, ct);
    }

    public async Task<IReadOnlyList<EnrollmentDto>> BulkEnrollAsync(
        BulkEnrollRequest request, CancellationToken ct = default)
    {
        if (!await context.Classes.AnyAsync(c => c.Id == request.ClassId, ct))
        {
            throw new NotFoundException("Class", request.ClassId);
        }

        var students = await context.Users
            .Where(u => request.StudentIds.Contains(u.Id))
            .Select(u => new { u.Id, u.Role, u.IsActive, u.FullName })
            .ToListAsync(ct);

        // Report every problem at once rather than failing on the first — a bulk
        // action is far more useful when it tells you all of what is wrong.
        var missing = request.StudentIds.Except(students.Select(s => s.Id)).ToList();
        if (missing.Count > 0)
        {
            throw new NotFoundException("Student", string.Join(", ", missing));
        }

        var notStudents = students.Where(s => s.Role != UserRole.Student).ToList();
        if (notStudents.Count > 0)
        {
            throw new BusinessRuleException(
                $"These accounts are not students: {string.Join(", ", notStudents.Select(s => s.FullName))}.");
        }

        var inactive = students.Where(s => !s.IsActive).ToList();
        if (inactive.Count > 0)
        {
            throw new BusinessRuleException(
                $"These accounts are deactivated: {string.Join(", ", inactive.Select(s => s.FullName))}.");
        }

        // Already-enrolled students are skipped rather than treated as an error,
        // so re-running a bulk enrolment after adding one name still works.
        var alreadyEnrolled = await context.Enrollments
            .Where(e => e.ClassId == request.ClassId && request.StudentIds.Contains(e.StudentId))
            .Select(e => e.StudentId)
            .ToListAsync(ct);

        var toAdd = request.StudentIds
            .Except(alreadyEnrolled)
            .Select(studentId => new Enrollment
            {
                StudentId = studentId,
                ClassId = request.ClassId,
                EnrolledAt = dateTime.UtcNow
            })
            .ToList();

        if (toAdd.Count == 0)
        {
            return [];
        }

        context.Enrollments.AddRange(toAdd);
        await context.SaveChangesAsync(ct);

        logger.LogInformation("Admin {AdminId} enrolled {Count} student(s) in class {ClassId}.",
            currentUser.UserId, toAdd.Count, request.ClassId);

        var ids = toAdd.Select(e => e.Id).ToList();

        return await context.Enrollments
            .AsNoTracking()
            .Where(e => ids.Contains(e.Id))
            .Select(Projection)
            .ToListAsync(ct);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var entity = await context.Enrollments.FirstOrDefaultAsync(e => e.Id == id, ct)
            ?? throw new NotFoundException("Enrolment", id);

        // Unenrolling would hide assignments the student has already answered,
        // and their marks along with them.
        var hasSubmitted = await context.Submissions.AnyAsync(
            s => s.StudentId == entity.StudentId
              && s.Assignment.ClassSubject.ClassId == entity.ClassId, ct);

        if (hasSubmitted)
        {
            throw new ConflictException(
                "This student has already submitted work for this class, so the enrolment cannot be removed.");
        }

        context.Enrollments.Remove(entity);
        await context.SaveChangesAsync(ct);

        logger.LogInformation("Admin {AdminId} removed enrolment {EnrolmentId}.",
            currentUser.UserId, id);
    }

    // -----------------------------------------------------------------------

    private async Task EnsureEnrollableAsync(Guid studentId, Guid classId, CancellationToken ct)
    {
        var student = await context.Users.FirstOrDefaultAsync(u => u.Id == studentId, ct)
            ?? throw new NotFoundException("Student", studentId);

        if (student.Role != UserRole.Student)
        {
            throw new BusinessRuleException($"{student.FullName} is not a student.");
        }

        if (!student.IsActive)
        {
            throw new BusinessRuleException($"{student.FullName}'s account is deactivated.");
        }

        if (!await context.Classes.AnyAsync(c => c.Id == classId, ct))
        {
            throw new NotFoundException("Class", classId);
        }
    }

    private async Task<EnrollmentDto> ProjectOneAsync(Guid id, CancellationToken ct) =>
        await context.Enrollments
            .AsNoTracking()
            .Where(e => e.Id == id)
            .Select(Projection)
            .FirstOrDefaultAsync(ct)
        ?? throw new NotFoundException("Enrolment", id);

    private static readonly Expression<Func<Enrollment, EnrollmentDto>> Projection =
        e => new EnrollmentDto(
            e.Id,
            e.StudentId,
            e.Student.FullName,
            e.Student.Email,
            e.ClassId,
            e.Class.Name,
            e.Class.Code,
            e.EnrolledAt);
}
