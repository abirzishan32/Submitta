using System.Linq.Expressions;
using AssignmentSystem.Application.Common.Extensions;
using AssignmentSystem.Application.Common.Interfaces;
using AssignmentSystem.Application.Common.Models;
using AssignmentSystem.Domain.Entities;
using AssignmentSystem.Domain.Enums;
using AssignmentSystem.Domain.Exceptions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace AssignmentSystem.Application.Features.Admin.Users;

public interface IUserService
{
    Task<PagedResult<UserDto>> ListAsync(UserListQuery query, CancellationToken ct = default);
    Task<UserDetailDto> GetAsync(Guid id, CancellationToken ct = default);
    Task<UserDto> CreateAsync(CreateUserRequest request, CancellationToken ct = default);
    Task<UserDto> UpdateAsync(Guid id, UpdateUserRequest request, CancellationToken ct = default);
    Task<UserDto> SetStatusAsync(Guid id, SetUserStatusRequest request, CancellationToken ct = default);
    Task ResetPasswordAsync(Guid id, ResetPasswordRequest request, CancellationToken ct = default);
    Task DeleteAsync(Guid id, CancellationToken ct = default);
}

/// <summary>
/// Admin user management. Every method here is reachable only through
/// <c>[Authorize(Policy = AdminOnly)]</c>; the guards below are the rules that
/// role membership alone cannot express.
/// </summary>
public sealed class UserService(
    IAppDbContext context,
    IPasswordHasher passwordHasher,
    ICurrentUser currentUser,
    ILogger<UserService> logger) : IUserService
{
    private static readonly Dictionary<string, Expression<Func<User, object>>> Sortable = new()
    {
        ["fullName"] = u => u.FullName,
        ["email"] = u => u.Email,
        ["role"] = u => u.Role,
        ["createdAt"] = u => u.CreatedAt,
        ["lastLoginAt"] = u => u.LastLoginAt!
    };

    public async Task<PagedResult<UserDto>> ListAsync(UserListQuery query, CancellationToken ct = default)
    {
        var users = context.Users.AsNoTracking();

        if (query.Role is { } role)
        {
            users = users.Where(u => u.Role == role);
        }

        if (query.IsActive is { } isActive)
        {
            users = users.Where(u => u.IsActive == isActive);
        }

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var term = query.Search.Trim().ToLowerInvariant();
            users = users.Where(u =>
                u.FullName.ToLower().Contains(term) ||
                u.Email.ToLower().Contains(term));
        }

        return await users
            .ApplySort(query.SortBy, query.SortDescending, Sortable, u => u.CreatedAt)
            .ToPagedResultAsync(query, u => new UserDto(
                u.Id, u.FullName, u.Email, u.Role, u.IsActive, u.LastLoginAt, u.CreatedAt), ct);
    }

    public async Task<UserDetailDto> GetAsync(Guid id, CancellationToken ct = default)
    {
        var user = await context.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == id, ct)
            ?? throw new NotFoundException("User", id);

        // A student's links come from enrolments, a teacher's from their
        // offerings. Admins have neither.
        var links = user.Role switch
        {
            UserRole.Student => await context.Enrollments
                .AsNoTracking()
                .Where(e => e.StudentId == id)
                .Select(e => new UserClassLinkDto(
                    e.ClassId, e.Class.Name, e.Class.Code, null, null))
                .ToListAsync(ct),

            UserRole.Teacher => await context.TeacherAssignments
                .AsNoTracking()
                .Where(ta => ta.TeacherId == id)
                .Select(ta => new UserClassLinkDto(
                    ta.ClassSubject.ClassId,
                    ta.ClassSubject.Class.Name,
                    ta.ClassSubject.Class.Code,
                    ta.ClassSubjectId,
                    ta.ClassSubject.Subject.Name))
                .ToListAsync(ct),

            _ => []
        };

        return new UserDetailDto(
            user.Id, user.FullName, user.Email, user.Role,
            user.IsActive, user.LastLoginAt, user.CreatedAt, links);
    }

    public async Task<UserDto> CreateAsync(CreateUserRequest request, CancellationToken ct = default)
    {
        var email = request.Email.Trim().ToLowerInvariant();

        // Checked here for a friendly message; the unique index is what actually
        // guarantees it under concurrency.
        if (await context.Users.AnyAsync(u => u.Email == email, ct))
        {
            throw new ConflictException($"An account already exists for {email}.");
        }

        var user = new User
        {
            FullName = request.FullName.Trim(),
            Email = email,
            PasswordHash = passwordHasher.Hash(request.Password),
            Role = request.Role,
            IsActive = true
        };

        context.Users.Add(user);
        await context.SaveChangesAsync(ct);

        logger.LogInformation("Admin {AdminId} created {Role} account {UserId}.",
            currentUser.UserId, user.Role, user.Id);

        return ToDto(user);
    }

    public async Task<UserDto> UpdateAsync(Guid id, UpdateUserRequest request, CancellationToken ct = default)
    {
        var user = await context.Users.FirstOrDefaultAsync(u => u.Id == id, ct)
            ?? throw new NotFoundException("User", id);

        var email = request.Email.Trim().ToLowerInvariant();

        if (email != user.Email && await context.Users.AnyAsync(u => u.Email == email, ct))
        {
            throw new ConflictException($"An account already exists for {email}.");
        }

        // Changing a role would strand the user's existing enrolments or teaching
        // assignments, which belong to the old role. Require those to be cleared
        // first rather than silently leaving orphaned links behind.
        if (request.Role != user.Role)
        {
            await EnsureNoRoleSpecificLinksAsync(user, ct);
        }

        user.FullName = request.FullName.Trim();
        user.Email = email;
        user.Role = request.Role;

        await context.SaveChangesAsync(ct);

        logger.LogInformation("Admin {AdminId} updated user {UserId}.", currentUser.UserId, id);
        return ToDto(user);
    }

    public async Task<UserDto> SetStatusAsync(
        Guid id, SetUserStatusRequest request, CancellationToken ct = default)
    {
        var user = await context.Users.FirstOrDefaultAsync(u => u.Id == id, ct)
            ?? throw new NotFoundException("User", id);

        // Locking yourself out is always a mistake, never an intention.
        if (id == currentUser.UserId && !request.IsActive)
        {
            throw new BusinessRuleException("You cannot deactivate your own account.");
        }

        if (!request.IsActive)
        {
            await EnsureNotLastActiveAdminAsync(user, ct);

            // The account can no longer authenticate, so its live sessions
            // should not outlive the decision.
            await RevokeSessionsAsync(id, ct);
        }

        user.IsActive = request.IsActive;
        await context.SaveChangesAsync(ct);

        logger.LogInformation("Admin {AdminId} set user {UserId} active={IsActive}.",
            currentUser.UserId, id, request.IsActive);

        return ToDto(user);
    }

    public async Task ResetPasswordAsync(
        Guid id, ResetPasswordRequest request, CancellationToken ct = default)
    {
        var user = await context.Users.FirstOrDefaultAsync(u => u.Id == id, ct)
            ?? throw new NotFoundException("User", id);

        user.PasswordHash = passwordHasher.Hash(request.NewPassword);

        // Whoever held the old password should not keep a live session.
        await RevokeSessionsAsync(id, ct);
        await context.SaveChangesAsync(ct);

        logger.LogInformation("Admin {AdminId} reset the password for user {UserId}.",
            currentUser.UserId, id);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var user = await context.Users.FirstOrDefaultAsync(u => u.Id == id, ct)
            ?? throw new NotFoundException("User", id);

        if (id == currentUser.UserId)
        {
            throw new BusinessRuleException("You cannot delete your own account.");
        }

        await EnsureNotLastActiveAdminAsync(user, ct);

        // Teachers and students accumulate work that must stay attributable, so
        // block deletion while links exist rather than cascading through grades.
        await EnsureNoRoleSpecificLinksAsync(user, ct);

        if (user.Role == UserRole.Teacher &&
            await context.Assignments.AnyAsync(a => a.CreatedByTeacherId == id, ct))
        {
            throw new ConflictException(
                "This teacher has authored assignments. Reassign or remove them first.");
        }

        if (user.Role == UserRole.Student &&
            await context.Submissions.AnyAsync(s => s.StudentId == id, ct))
        {
            throw new ConflictException(
                "This student has submitted work. Deactivate the account instead of deleting it.");
        }

        await RevokeSessionsAsync(id, ct);

        // Soft delete — the interceptor rewrites this as an update.
        context.Users.Remove(user);
        await context.SaveChangesAsync(ct);

        logger.LogInformation("Admin {AdminId} deleted user {UserId}.", currentUser.UserId, id);
    }

    // -----------------------------------------------------------------------

    /// <summary>
    /// Refuses to remove or disable the last account that can still administer
    /// the system — otherwise nobody can undo it.
    /// </summary>
    private async Task EnsureNotLastActiveAdminAsync(User user, CancellationToken ct)
    {
        if (user.Role != UserRole.Admin)
        {
            return;
        }

        var otherActiveAdmins = await context.Users
            .CountAsync(u => u.Role == UserRole.Admin && u.IsActive && u.Id != user.Id, ct);

        if (otherActiveAdmins == 0)
        {
            throw new BusinessRuleException(
                "This is the only active administrator. Promote another account first.");
        }
    }

    private async Task EnsureNoRoleSpecificLinksAsync(User user, CancellationToken ct)
    {
        if (user.Role == UserRole.Teacher &&
            await context.TeacherAssignments.AnyAsync(ta => ta.TeacherId == user.Id, ct))
        {
            throw new ConflictException(
                "This teacher is still assigned to classes. Remove those assignments first.");
        }

        if (user.Role == UserRole.Student &&
            await context.Enrollments.AnyAsync(e => e.StudentId == user.Id, ct))
        {
            throw new ConflictException(
                "This student is still enrolled in classes. Remove those enrolments first.");
        }
    }

    private async Task RevokeSessionsAsync(Guid userId, CancellationToken ct)
    {
        var tokens = await context.RefreshTokens
            .Where(t => t.UserId == userId && t.RevokedAt == null)
            .ToListAsync(ct);

        foreach (var token in tokens)
        {
            token.RevokedAt = DateTimeOffset.UtcNow;
        }
    }

    private static UserDto ToDto(User u) =>
        new(u.Id, u.FullName, u.Email, u.Role, u.IsActive, u.LastLoginAt, u.CreatedAt);
}
