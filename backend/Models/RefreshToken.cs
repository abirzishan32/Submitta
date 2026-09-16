using AssignmentSystem.Domain.Common;

namespace AssignmentSystem.Domain.Entities;

/// <summary>
/// A refresh token issued to one user.
///
/// Access tokens are short-lived and cannot be revoked once signed, so the
/// refresh token is the revocation point: logging out marks the row revoked and
/// the session ends at the next refresh.
/// </summary>
public class RefreshToken : BaseEntity
{
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;

    /// <summary>
    /// SHA-256 of the token, never the token itself. A leaked database dump
    /// then yields no usable sessions.
    /// </summary>
    public required string TokenHash { get; set; }

    public DateTimeOffset ExpiresAt { get; set; }
    public DateTimeOffset? RevokedAt { get; set; }

    /// <summary>
    /// Set when this token is rotated. Reuse of an already-rotated token is a
    /// replay signal, so the chain is worth keeping.
    /// </summary>
    public string? ReplacedByTokenHash { get; set; }

    public string? CreatedByIp { get; set; }

    public bool IsRevoked => RevokedAt is not null;

    public bool IsActiveAt(DateTimeOffset now) => !IsRevoked && ExpiresAt > now;
}
