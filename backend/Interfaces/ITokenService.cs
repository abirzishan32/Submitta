using AssignmentSystem.Domain.Entities;

namespace AssignmentSystem.Application.Common.Interfaces;

/// <summary>
/// Issues access and refresh tokens. Abstracted so authentication logic can be
/// tested without a real signing key or clock.
/// </summary>
public interface ITokenService
{
    /// <summary>
    /// Creates a signed JWT carrying the user's id, email and role.
    ///
    /// The role travels in the token precisely so the API never has to take a
    /// client's word for it — the signature makes the claim unforgeable.
    /// </summary>
    AccessToken CreateAccessToken(User user);

    /// <summary>
    /// Generates a cryptographically random refresh token, returning the raw
    /// value for the client and its hash for storage.
    /// </summary>
    RefreshTokenPair CreateRefreshToken();

    /// <summary>Hashes a raw refresh token so it can be matched against stored rows.</summary>
    string HashRefreshToken(string rawToken);
}

/// <summary>A signed access token and the moment it stops being valid.</summary>
public sealed record AccessToken(string Value, DateTimeOffset ExpiresAt);

/// <summary>
/// A refresh token in both forms: the raw value handed to the client, and the
/// hash persisted server-side. The raw value is never stored, so a leaked
/// database yields no usable sessions.
/// </summary>
public sealed record RefreshTokenPair(string RawValue, string Hash, DateTimeOffset ExpiresAt);
