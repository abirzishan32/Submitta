using System.Security.Claims;
using AssignmentSystem.Application.Common.Interfaces;
using AssignmentSystem.Domain.Enums;
using AssignmentSystem.Domain.Exceptions;

namespace AssignmentSystem.Api.Services;

/// <summary>
/// Reads the caller's identity from the current request's <see cref="ClaimsPrincipal"/>.
///
/// The principal is only populated after the JWT bearer handler has verified the
/// token signature, issuer, audience and expiry — so every value here is
/// server-verified. Nothing is ever read from a request body or a custom header.
/// </summary>
public sealed class CurrentUser(IHttpContextAccessor httpContextAccessor) : ICurrentUser
{
    private ClaimsPrincipal? Principal => httpContextAccessor.HttpContext?.User;

    public Guid? UserId =>
        Guid.TryParse(Principal?.FindFirstValue(ClaimTypes.NameIdentifier), out var id)
            ? id
            : null;

    public string? Email => Principal?.FindFirstValue(ClaimTypes.Email);

    public UserRole? Role =>
        Enum.TryParse<UserRole>(Principal?.FindFirstValue(ClaimTypes.Role), out var role)
            ? role
            : null;

    public bool IsAuthenticated => Principal?.Identity?.IsAuthenticated ?? false;

    public bool IsInRole(UserRole role) => Role == role;

    public Guid RequireUserId() =>
        UserId ?? throw new UnauthorizedException("No authenticated user on this request.");
}
