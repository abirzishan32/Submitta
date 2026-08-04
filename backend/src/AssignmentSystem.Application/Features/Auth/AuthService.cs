using AssignmentSystem.Application.Common.Interfaces;
using AssignmentSystem.Domain.Entities;
using AssignmentSystem.Domain.Enums;
using AssignmentSystem.Domain.Exceptions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace AssignmentSystem.Application.Features.Auth;

/// <summary>
/// Login, token refresh, logout and password change.
/// </summary>
public sealed class AuthService(
    IAppDbContext context,
    IPasswordHasher passwordHasher,
    ITokenService tokenService,
    ICurrentUser currentUser,
    IDateTimeProvider dateTime,
    ILogger<AuthService> logger) : IAuthService
{
    /// <summary>
    /// Deliberately identical for "no such account", "wrong password" and
    /// "account disabled". Distinguishing them would turn the login form into an
    /// account-enumeration oracle.
    /// </summary>
    private const string InvalidCredentials = "Invalid email or password.";

    /// <summary>Settings that govern who may create their own account.</summary>
    private const string SelfRegistrationKey = "auth.allow_self_registration";
    private const string TeacherRegistrationKey = "auth.allow_teacher_registration";
    private const string TeacherApprovalKey = "auth.teacher_requires_approval";

    // -----------------------------------------------------------------------
    // Registration
    // -----------------------------------------------------------------------

    public async Task<RegistrationOptions> GetRegistrationOptionsAsync(CancellationToken ct = default)
    {
        var flags = await ReadFlagsAsync(ct);

        // Only offered when students may actually register, so the form does not
        // publish the school's class list to anyone who asks.
        var classes = flags.SelfRegistration
            ? await context.Classes
                .AsNoTracking()
                .OrderBy(c => c.Code)
                .Select(c => new PublicClassOption(c.Id, c.Name, c.Code, c.AcademicYear))
                .ToListAsync(ct)
            : [];

        return new RegistrationOptions(
            flags.SelfRegistration,
            flags.TeacherRegistration,
            flags.TeacherApproval,
            classes);
    }

    public async Task<RegisterResponse> RegisterAsync(
        RegisterRequest request, string? ipAddress, CancellationToken ct = default)
    {
        var flags = await ReadFlagsAsync(ct);

        if (!flags.SelfRegistration)
        {
            throw new BusinessRuleException(
                "Self-registration is currently closed. Ask an administrator for an account.");
        }

        // Belt and braces with the validator: an administrator account must never
        // be obtainable by asking for one.
        if (request.Role == UserRole.Admin)
        {
            throw new BusinessRuleException("Administrator accounts cannot be self-registered.");
        }

        if (request.Role == UserRole.Teacher && !flags.TeacherRegistration)
        {
            throw new BusinessRuleException(
                "Teacher accounts are created by an administrator. Please contact your school office.");
        }

        var email = request.Email.Trim().ToLowerInvariant();

        // Registration inherently tells the caller whether an address is taken —
        // there is no way to create an account without saying so. A clear message
        // is worth more here than the enumeration resistance the login path keeps.
        if (await context.Users.AnyAsync(u => u.Email == email, ct))
        {
            throw new ConflictException(
                $"An account already exists for {email}. Try signing in instead.");
        }

        // A teacher can mark work and see every submission in their classes, so
        // the claim to be one is verified by a person before it grants anything.
        var requiresApproval = request.Role == UserRole.Teacher && flags.TeacherApproval;

        var user = new User
        {
            FullName = request.FullName.Trim(),
            Email = email,
            PasswordHash = passwordHasher.Hash(request.Password),
            Role = request.Role,
            IsActive = !requiresApproval
        };

        context.Users.Add(user);

        if (request.Role == UserRole.Student && request.ClassId is { } classId)
        {
            var exists = await context.Classes.AnyAsync(c => c.Id == classId, ct);

            if (!exists)
            {
                throw new NotFoundException("Class", classId);
            }

            context.Enrollments.Add(new Enrollment
            {
                StudentId = user.Id,
                ClassId = classId,
                EnrolledAt = dateTime.UtcNow
            });
        }

        await context.SaveChangesAsync(ct);

        logger.LogInformation(
            "Registered {Role} account {UserId} (approval required: {RequiresApproval}).",
            user.Role, user.Id, requiresApproval);

        if (requiresApproval)
        {
            return new RegisterResponse(ToProfile(user), true, null);
        }

        // Signed in immediately: sending someone to a login form to retype the
        // password they just chose is friction with nothing behind it.
        user.LastLoginAt = dateTime.UtcNow;
        var session = await IssueTokensAsync(user, ipAddress, ct);

        return new RegisterResponse(ToProfile(user), false, session);
    }

    private async Task<(bool SelfRegistration, bool TeacherRegistration, bool TeacherApproval)>
        ReadFlagsAsync(CancellationToken ct)
    {
        var keys = new[] { SelfRegistrationKey, TeacherRegistrationKey, TeacherApprovalKey };

        var values = await context.ApplicationSettings
            .AsNoTracking()
            .Where(s => keys.Contains(s.Key))
            .ToDictionaryAsync(s => s.Key, s => s.Value, ct);

        // Defaults chosen so a database without these rows is closed rather than
        // open: a missing setting must never be the reason anyone gets an
        // account they should not have.
        return (
            Flag(SelfRegistrationKey, false),
            Flag(TeacherRegistrationKey, false),
            Flag(TeacherApprovalKey, true));

        bool Flag(string key, bool fallback) =>
            values.TryGetValue(key, out var raw) && bool.TryParse(raw, out var parsed)
                ? parsed
                : fallback;
    }

    public async Task<AuthResponse> LoginAsync(
        LoginRequest request, string? ipAddress, CancellationToken ct = default)
    {
        var email = request.Email.Trim().ToLowerInvariant();

        var user = await context.Users
            .FirstOrDefaultAsync(u => u.Email == email, ct);

        if (user is null)
        {
            // Verify against a dummy hash anyway. Returning early here would make
            // "unknown email" measurably faster than "wrong password", which
            // leaks which addresses are registered.
            passwordHasher.Verify(request.Password, DummyHash);
            logger.LogInformation("Login failed: no account for {Email}.", email);
            throw new UnauthorizedException(InvalidCredentials);
        }

        if (!passwordHasher.Verify(request.Password, user.PasswordHash))
        {
            logger.LogInformation("Login failed: wrong password for {UserId}.", user.Id);
            throw new UnauthorizedException(InvalidCredentials);
        }

        if (!user.IsActive)
        {
            logger.LogInformation("Login failed: account {UserId} is deactivated.", user.Id);

            // Said plainly, because the password has already been proved: only
            // the account's owner can reach this line, so there is nothing left
            // to disclose — and "invalid email or password" would send someone
            // hunting for a typo that is not there.
            throw new UnauthorizedException(
                user.Role == UserRole.Teacher
                    ? "Your teacher account is waiting for an administrator to approve it."
                    : "This account has been deactivated. Please contact an administrator.");
        }

        user.LastLoginAt = dateTime.UtcNow;

        var response = await IssueTokensAsync(user, ipAddress, ct);

        logger.LogInformation("User {UserId} ({Role}) logged in.", user.Id, user.Role);
        return response;
    }

    public async Task<AuthResponse> RefreshAsync(
        RefreshRequest request, string? ipAddress, CancellationToken ct = default)
    {
        var hash = tokenService.HashRefreshToken(request.RefreshToken);
        var now = dateTime.UtcNow;

        var stored = await context.RefreshTokens
            .Include(t => t.User)
            .FirstOrDefaultAsync(t => t.TokenHash == hash, ct);

        if (stored is null)
        {
            throw new UnauthorizedException("Invalid refresh token.");
        }

        // A token that was already rotated is being presented again. Either it
        // leaked, or a client is replaying — in both cases the safe response is
        // to end every session for this user rather than issue more tokens.
        if (stored.IsRevoked)
        {
            logger.LogWarning(
                "Refresh token reuse detected for user {UserId}; revoking all sessions.",
                stored.UserId);

            await RevokeAllForUserAsync(stored.UserId, now, ct);
            throw new UnauthorizedException("Refresh token has been revoked. Please sign in again.");
        }

        if (stored.ExpiresAt <= now)
        {
            throw new UnauthorizedException("Refresh token has expired. Please sign in again.");
        }

        if (!stored.User.IsActive)
        {
            throw new UnauthorizedException("This account is no longer active.");
        }

        // Rotate: the presented token dies with this request.
        var response = await IssueTokensAsync(stored.User, ipAddress, ct, rotating: stored);

        logger.LogInformation("Refreshed tokens for user {UserId}.", stored.UserId);
        return response;
    }

    public async Task LogoutAsync(LogoutRequest request, CancellationToken ct = default)
    {
        var hash = tokenService.HashRefreshToken(request.RefreshToken);

        var stored = await context.RefreshTokens
            .FirstOrDefaultAsync(t => t.TokenHash == hash, ct);

        // Logging out an unknown or already-revoked token is not an error — the
        // caller's intent (end the session) is satisfied either way.
        if (stored is null || stored.IsRevoked)
        {
            return;
        }

        stored.RevokedAt = dateTime.UtcNow;
        await context.SaveChangesAsync(ct);

        logger.LogInformation("User {UserId} logged out.", stored.UserId);
    }

    public async Task LogoutAllAsync(CancellationToken ct = default)
    {
        var userId = currentUser.RequireUserId();
        await RevokeAllForUserAsync(userId, dateTime.UtcNow, ct);

        logger.LogInformation("All sessions revoked for user {UserId}.", userId);
    }

    public async Task<UserProfile> GetCurrentUserAsync(CancellationToken ct = default)
    {
        var userId = currentUser.RequireUserId();

        var user = await context.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == userId, ct)
            ?? throw new NotFoundException("User", userId);

        return ToProfile(user);
    }

    public async Task ChangePasswordAsync(ChangePasswordRequest request, CancellationToken ct = default)
    {
        var userId = currentUser.RequireUserId();

        var user = await context.Users
            .FirstOrDefaultAsync(u => u.Id == userId, ct)
            ?? throw new NotFoundException("User", userId);

        if (!passwordHasher.Verify(request.CurrentPassword, user.PasswordHash))
        {
            throw new UnauthorizedException("Current password is incorrect.");
        }

        user.PasswordHash = passwordHasher.Hash(request.NewPassword);

        // Existing sessions were established under the old password; a password
        // change is usually a response to compromise, so end them all.
        await RevokeAllForUserAsync(userId, dateTime.UtcNow, ct);

        logger.LogInformation("Password changed for user {UserId}; sessions revoked.", userId);
    }

    // -----------------------------------------------------------------------

    private async Task<AuthResponse> IssueTokensAsync(
        User user,
        string? ipAddress,
        CancellationToken ct,
        RefreshToken? rotating = null)
    {
        var accessToken = tokenService.CreateAccessToken(user);
        var refresh = tokenService.CreateRefreshToken();

        if (rotating is not null)
        {
            rotating.RevokedAt = dateTime.UtcNow;
            rotating.ReplacedByTokenHash = refresh.Hash;
        }

        context.RefreshTokens.Add(new RefreshToken
        {
            UserId = user.Id,
            TokenHash = refresh.Hash,
            ExpiresAt = refresh.ExpiresAt,
            CreatedByIp = ipAddress
        });

        await context.SaveChangesAsync(ct);

        return new AuthResponse(
            accessToken.Value,
            accessToken.ExpiresAt,
            refresh.RawValue,
            refresh.ExpiresAt,
            ToProfile(user));
    }

    private async Task RevokeAllForUserAsync(Guid userId, DateTimeOffset now, CancellationToken ct)
    {
        var active = await context.RefreshTokens
            .Where(t => t.UserId == userId && t.RevokedAt == null)
            .ToListAsync(ct);

        foreach (var token in active)
        {
            token.RevokedAt = now;
        }

        await context.SaveChangesAsync(ct);
    }

    private static UserProfile ToProfile(User user) =>
        new(user.Id, user.FullName, user.Email, user.Role, user.IsActive, user.LastLoginAt);

    /// <summary>
    /// A real BCrypt hash of a throwaway value, used to keep the "unknown email"
    /// path as slow as the "wrong password" path.
    /// </summary>
    private const string DummyHash =
        "$2a$12$C6UzMDM.H6dfI/f/IKcEe.3Xr5oOsnP9nX0Q3vNvJ8Zc1Zr5qUvGy";
}
