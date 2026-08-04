using AssignmentSystem.Application.Common.Models;
using AssignmentSystem.Domain.Enums;

namespace AssignmentSystem.Application.Features.Admin.Users;

/// <summary>A user as returned by admin endpoints. Never carries the password hash.</summary>
public sealed record UserDto(
    Guid Id,
    string FullName,
    string Email,
    UserRole Role,
    bool IsActive,
    DateTimeOffset? LastLoginAt,
    DateTimeOffset CreatedAt);

/// <summary>A user plus the classes they touch, for the detail view.</summary>
public sealed record UserDetailDto(
    Guid Id,
    string FullName,
    string Email,
    UserRole Role,
    bool IsActive,
    DateTimeOffset? LastLoginAt,
    DateTimeOffset CreatedAt,
    IReadOnlyList<UserClassLinkDto> Classes);

/// <summary>
/// A class the user is connected to — enrolled in, if a student; teaching, if a
/// teacher. <paramref name="SubjectName"/> is null for a student, whose link is
/// to the class as a whole rather than to one subject within it.
/// </summary>
public sealed record UserClassLinkDto(
    Guid ClassId,
    string ClassName,
    string ClassCode,
    Guid? ClassSubjectId,
    string? SubjectName);

public sealed record CreateUserRequest(
    string FullName,
    string Email,
    string Password,
    UserRole Role);

public sealed record UpdateUserRequest(
    string FullName,
    string Email,
    UserRole Role);

public sealed record SetUserStatusRequest(bool IsActive);

public sealed record ResetPasswordRequest(string NewPassword);

/// <summary>Filters for the user list.</summary>
public sealed class UserListQuery : PaginationQuery
{
    public UserRole? Role { get; set; }
    public bool? IsActive { get; set; }
}
