using AssignmentSystem.Domain.Enums;

namespace AssignmentSystem.Application.Common.Interfaces;

/// <summary>
/// The authenticated caller, resolved from validated JWT claims.
///
/// Every authorization decision reads identity from here, never from a request
/// body or header — a client can claim any role it likes, so the role is only
/// ever taken from the signed token.
/// </summary>
public interface ICurrentUser
{
    /// <summary>User id from the token, or null when the request is anonymous.</summary>
    Guid? UserId { get; }

    string? Email { get; }

    UserRole? Role { get; }

    bool IsAuthenticated { get; }

    bool IsInRole(UserRole role);

    /// <summary>
    /// User id, or <see cref="Domain.Exceptions.UnauthorizedException"/> if anonymous.
    /// For use inside endpoints that are already <c>[Authorize]</c>d, where an
    /// absent id means something is wrong rather than merely unauthenticated.
    /// </summary>
    Guid RequireUserId();
}
