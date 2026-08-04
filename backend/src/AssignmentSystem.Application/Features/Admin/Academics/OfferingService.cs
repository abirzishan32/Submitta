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

public interface IOfferingService
{
    Task<PagedResult<OfferingDto>> ListAsync(OfferingListQuery query, CancellationToken ct = default);
    Task<OfferingDto> GetAsync(Guid id, CancellationToken ct = default);
    Task<OfferingDto> CreateAsync(CreateOfferingRequest request, CancellationToken ct = default);
    Task DeleteAsync(Guid id, CancellationToken ct = default);

    Task<OfferingDto> AssignTeacherAsync(AssignTeacherRequest request, CancellationToken ct = default);
    Task RemoveTeacherAsync(Guid teacherAssignmentId, CancellationToken ct = default);
}

/// <summary>
/// Manages class-subject offerings and the teachers attached to them — the admin
/// duties "manage classes/courses and subjects" and "assign teachers to
/// subjects/classes".
/// </summary>
public sealed class OfferingService(
    IAppDbContext context,
    ICurrentUser currentUser,
    IDateTimeProvider dateTime,
    ILogger<OfferingService> logger) : IOfferingService
{
    private static readonly Dictionary<string, Expression<Func<ClassSubject, object>>> Sortable = new()
    {
        ["className"] = cs => cs.Class.Name,
        ["subjectName"] = cs => cs.Subject.Name,
        ["createdAt"] = cs => cs.CreatedAt
    };

    public async Task<PagedResult<OfferingDto>> ListAsync(
        OfferingListQuery query, CancellationToken ct = default)
    {
        var offerings = context.ClassSubjects.AsNoTracking();

        if (query.ClassId is { } classId)
        {
            offerings = offerings.Where(cs => cs.ClassId == classId);
        }

        if (query.SubjectId is { } subjectId)
        {
            offerings = offerings.Where(cs => cs.SubjectId == subjectId);
        }

        if (query.TeacherId is { } teacherId)
        {
            offerings = offerings.Where(cs =>
                cs.TeacherAssignments.Any(ta => ta.TeacherId == teacherId));
        }

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var term = query.Search.Trim().ToLowerInvariant();
            offerings = offerings.Where(cs =>
                cs.Class.Name.ToLower().Contains(term) ||
                cs.Class.Code.ToLower().Contains(term) ||
                cs.Subject.Name.ToLower().Contains(term) ||
                cs.Subject.Code.ToLower().Contains(term));
        }

        return await offerings
            .ApplySort(query.SortBy, query.SortDescending, Sortable, cs => cs.Class.Name)
            .ToPagedResultAsync(query, Projection, ct);
    }

    public async Task<OfferingDto> GetAsync(Guid id, CancellationToken ct = default) =>
        await context.ClassSubjects
            .AsNoTracking()
            .Where(cs => cs.Id == id)
            .Select(Projection)
            .FirstOrDefaultAsync(ct)
        ?? throw new NotFoundException("Offering", id);

    public async Task<OfferingDto> CreateAsync(
        CreateOfferingRequest request, CancellationToken ct = default)
    {
        if (!await context.Classes.AnyAsync(c => c.Id == request.ClassId, ct))
        {
            throw new NotFoundException("Class", request.ClassId);
        }

        if (!await context.Subjects.AnyAsync(s => s.Id == request.SubjectId, ct))
        {
            throw new NotFoundException("Subject", request.SubjectId);
        }

        if (await context.ClassSubjects.AnyAsync(
                cs => cs.ClassId == request.ClassId && cs.SubjectId == request.SubjectId, ct))
        {
            throw new ConflictException("This subject is already offered to this class.");
        }

        var entity = new ClassSubject
        {
            ClassId = request.ClassId,
            SubjectId = request.SubjectId
        };

        context.ClassSubjects.Add(entity);
        await context.SaveChangesAsync(ct);

        logger.LogInformation("Admin {AdminId} created offering {OfferingId}.",
            currentUser.UserId, entity.Id);

        return await GetAsync(entity.Id, ct);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var entity = await context.ClassSubjects.FirstOrDefaultAsync(cs => cs.Id == id, ct)
            ?? throw new NotFoundException("Offering", id);

        // Assignments hang off the offering, and their submissions off those.
        // Removing it would strand real student work.
        if (await context.Assignments.AnyAsync(a => a.ClassSubjectId == id, ct))
        {
            throw new ConflictException(
                "This class and subject already has assignments. Delete or archive them first.");
        }

        // Teacher links are pure permissions, so they can go with the offering.
        var teacherLinks = await context.TeacherAssignments
            .Where(ta => ta.ClassSubjectId == id)
            .ToListAsync(ct);

        context.TeacherAssignments.RemoveRange(teacherLinks);
        context.ClassSubjects.Remove(entity);
        await context.SaveChangesAsync(ct);

        logger.LogInformation("Admin {AdminId} removed offering {OfferingId}.",
            currentUser.UserId, id);
    }

    public async Task<OfferingDto> AssignTeacherAsync(
        AssignTeacherRequest request, CancellationToken ct = default)
    {
        var teacher = await context.Users
            .FirstOrDefaultAsync(u => u.Id == request.TeacherId, ct)
            ?? throw new NotFoundException("Teacher", request.TeacherId);

        // Assigning a student or admin to teach would grant them teacher
        // permissions over the offering through the back door.
        if (teacher.Role != UserRole.Teacher)
        {
            throw new BusinessRuleException(
                $"{teacher.FullName} is not a teacher and cannot be assigned to a class.");
        }

        if (!teacher.IsActive)
        {
            throw new BusinessRuleException(
                $"{teacher.FullName}'s account is deactivated and cannot be assigned to a class.");
        }

        if (!await context.ClassSubjects.AnyAsync(cs => cs.Id == request.ClassSubjectId, ct))
        {
            throw new NotFoundException("Offering", request.ClassSubjectId);
        }

        if (await context.TeacherAssignments.AnyAsync(
                ta => ta.TeacherId == request.TeacherId
                   && ta.ClassSubjectId == request.ClassSubjectId, ct))
        {
            throw new ConflictException(
                $"{teacher.FullName} is already assigned to this class and subject.");
        }

        context.TeacherAssignments.Add(new TeacherAssignment
        {
            TeacherId = request.TeacherId,
            ClassSubjectId = request.ClassSubjectId,
            AssignedAt = dateTime.UtcNow,
            AssignedByUserId = currentUser.UserId
        });

        await context.SaveChangesAsync(ct);

        logger.LogInformation("Admin {AdminId} assigned teacher {TeacherId} to offering {OfferingId}.",
            currentUser.UserId, request.TeacherId, request.ClassSubjectId);

        return await GetAsync(request.ClassSubjectId, ct);
    }

    public async Task RemoveTeacherAsync(Guid teacherAssignmentId, CancellationToken ct = default)
    {
        var link = await context.TeacherAssignments
            .FirstOrDefaultAsync(ta => ta.Id == teacherAssignmentId, ct)
            ?? throw new NotFoundException("Teacher assignment", teacherAssignmentId);

        // Their authored assignments stay; they simply lose access to the
        // offering. Grading history remains attributable either way.
        context.TeacherAssignments.Remove(link);
        await context.SaveChangesAsync(ct);

        logger.LogInformation("Admin {AdminId} unassigned teacher {TeacherId} from offering {OfferingId}.",
            currentUser.UserId, link.TeacherId, link.ClassSubjectId);
    }

    private static readonly Expression<Func<ClassSubject, OfferingDto>> Projection =
        cs => new OfferingDto(
            cs.Id,
            cs.ClassId,
            cs.Class.Name,
            cs.Class.Code,
            cs.SubjectId,
            cs.Subject.Name,
            cs.Subject.Code,
            cs.TeacherAssignments
                .Select(ta => new AssignedTeacherDto(
                    ta.Id, ta.TeacherId, ta.Teacher.FullName, ta.Teacher.Email, ta.AssignedAt))
                .ToList(),
            cs.Assignments.Count);
}
