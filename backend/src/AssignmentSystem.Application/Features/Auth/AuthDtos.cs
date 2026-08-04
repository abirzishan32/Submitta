using AssignmentSystem.Domain.Enums;

namespace AssignmentSystem.Application.Features.Auth;

/// <summary>Credentials supplied at login.</summary>
public sealed record LoginRequest(string Email, string Password);

/// <summary>
/// A new account, created by the person who will use it.
///
/// <paramref name="ClassId"/> is the class a student is joining. Optional: a
/// student can register first and be enrolled by an administrator later, but
/// choosing here means they see their coursework immediately instead of an
/// empty dashboard. Ignored for teachers, who are assigned to offerings by an
/// administrator rather than choosing their own.
/// </summary>
public sealed record RegisterRequest(
    string FullName,
    string Email,
    string Password,
    string ConfirmPassword,
    UserRole Role,
    Guid? ClassId);

/// <summary>
/// The outcome of registering.
///
/// A student is signed in straight away, so <see cref="Session"/> carries their
/// tokens. A teacher is not: the account is created deactivated and an
/// administrator has to approve it, so there is nothing to sign in to yet and
/// <see cref="Session"/> is null.
/// </summary>
public sealed record RegisterResponse(
    UserProfile User,
    bool RequiresApproval,
    AuthResponse? Session);

/// <summary>A class a student can pick when registering.</summary>
public sealed record PublicClassOption(Guid Id, string Name, string Code, string? AcademicYear);

/// <summary>What the sign-up form needs before it can be shown.</summary>
public sealed record RegistrationOptions(
    bool SelfRegistrationEnabled,
    bool TeacherRegistrationEnabled,
    bool TeacherRequiresApproval,
    IReadOnlyList<PublicClassOption> Classes);

/// <summary>Exchanges a refresh token for a new token pair.</summary>
public sealed record RefreshRequest(string RefreshToken);

/// <summary>Revokes a refresh token, ending the session.</summary>
public sealed record LogoutRequest(string RefreshToken);

/// <summary>Changes the caller's own password.</summary>
public sealed record ChangePasswordRequest(string CurrentPassword, string NewPassword);

/// <summary>
/// Result of a successful login or refresh.
///
/// The refresh token is returned to the client but never persisted in raw form
/// server-side — only its hash is stored.
/// </summary>
public sealed record AuthResponse(
    string AccessToken,
    DateTimeOffset AccessTokenExpiresAt,
    string RefreshToken,
    DateTimeOffset RefreshTokenExpiresAt,
    UserProfile User);

/// <summary>
/// The authenticated user as the client sees them. Deliberately excludes the
/// password hash and every audit column.
/// </summary>
public sealed record UserProfile(
    Guid Id,
    string FullName,
    string Email,
    UserRole Role,
    bool IsActive,
    DateTimeOffset? LastLoginAt);
