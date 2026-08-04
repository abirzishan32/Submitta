using AssignmentSystem.Application.Common.Interfaces;
using AssignmentSystem.Domain.Enums;
using AssignmentSystem.Domain.Exceptions;
using Microsoft.EntityFrameworkCore;

namespace AssignmentSystem.Application.Common.Security;

/// <inheritdoc cref="IAccessControl"/>
public sealed class AccessControl(
    IAppDbContext context,
    ICurrentUser currentUser) : IAccessControl
{
    public bool IsAdmin => currentUser.IsInRole(UserRole.Admin);

    public async Task<bool> IsTeacherOfAsync(Guid classSubjectId, CancellationToken ct = default)
    {
        var userId = currentUser.UserId;

        if (userId is null || !currentUser.IsInRole(UserRole.Teacher))
        {
            return false;
        }

        return await context.TeacherAssignments
            .AnyAsync(ta => ta.TeacherId == userId && ta.ClassSubjectId == classSubjectId, ct);
    }

    public async Task<bool> IsEnrolledInOfferingAsync(Guid classSubjectId, CancellationToken ct = default)
    {
        var userId = currentUser.UserId;

        if (userId is null || !currentUser.IsInRole(UserRole.Student))
        {
            return false;
        }

        // Enrolment is on the class, while assignments hang off the offering —
        // so join through the offering to reach the class.
        return await context.ClassSubjects
            .Where(cs => cs.Id == classSubjectId)
            .AnyAsync(cs => context.Enrollments
                .Any(e => e.ClassId == cs.ClassId && e.StudentId == userId), ct);
    }

    public async Task EnsureCanManageOfferingAsync(Guid classSubjectId, CancellationToken ct = default)
    {
        if (IsAdmin)
        {
            return;
        }

        if (await IsTeacherOfAsync(classSubjectId, ct))
        {
            return;
        }

        // Deliberately vague: naming the offering would confirm it exists to
        // someone with no right to know that.
        throw new ForbiddenException("You are not assigned to this class and subject.");
    }

    public async Task EnsureCanViewAssignmentAsync(Guid assignmentId, CancellationToken ct = default)
    {
        if (IsAdmin)
        {
            return;
        }

        var classSubjectId = await context.Assignments
            .Where(a => a.Id == assignmentId)
            .Select(a => (Guid?)a.ClassSubjectId)
            .FirstOrDefaultAsync(ct)
            ?? throw new NotFoundException("Assignment", assignmentId);

        if (await IsTeacherOfAsync(classSubjectId, ct) ||
            await IsEnrolledInOfferingAsync(classSubjectId, ct))
        {
            return;
        }

        throw new ForbiddenException("You do not have access to this assignment.");
    }

    public async Task EnsureCanViewSubmissionAsync(Guid submissionId, CancellationToken ct = default)
    {
        if (IsAdmin)
        {
            return;
        }

        var target = await context.Submissions
            .Where(s => s.Id == submissionId)
            .Select(s => new { s.StudentId, s.Assignment.ClassSubjectId })
            .FirstOrDefaultAsync(ct)
            ?? throw new NotFoundException("Submission", submissionId);

        // The student who wrote it.
        if (target.StudentId == currentUser.UserId)
        {
            return;
        }

        // Or the teacher responsible for the offering it belongs to.
        if (await IsTeacherOfAsync(target.ClassSubjectId, ct))
        {
            return;
        }

        throw new ForbiddenException("You do not have access to this submission.");
    }
}
