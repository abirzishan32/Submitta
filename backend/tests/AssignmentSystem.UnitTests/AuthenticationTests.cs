using AssignmentSystem.Application.Features.Auth;
using AssignmentSystem.Domain.Entities;
using AssignmentSystem.Domain.Enums;
using AssignmentSystem.Domain.Exceptions;
using AssignmentSystem.Infrastructure.Security;
using AssignmentSystem.UnitTests.Infrastructure;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace AssignmentSystem.UnitTests;

/// <summary>
/// Sign-in, token rotation and password handling.
/// </summary>
public class AuthenticationTests
{
    private const string Password = "Demo@1234";

    private static JwtOptions Options => new()
    {
        Key = "test-signing-key-at-least-32-characters-long-for-hmac",
        Issuer = "AssignmentSystem.Api",
        Audience = "AssignmentSystem.Client",
        AccessTokenMinutes = 15,
        RefreshTokenDays = 7,
    };

    private static (AuthService Service, BCryptPasswordHasher Hasher, JwtTokenService Tokens)
        Build(TestContext ctx)
    {
        var hasher = new BCryptPasswordHasher();
        var tokens = new JwtTokenService(Microsoft.Extensions.Options.Options.Create(Options), ctx.Clock);

        var service = new AuthService(
            ctx.Db, hasher, tokens, ctx.CurrentUser, ctx.Clock,
            TestContext.Logger<AuthService>());

        return (service, hasher, tokens);
    }

    private static User AddAccount(
        TestContext ctx, BCryptPasswordHasher hasher, bool isActive = true)
    {
        var user = new User
        {
            FullName = "Nadia Islam",
            Email = "nadia.islam@school.edu",
            PasswordHash = hasher.Hash(Password),
            Role = UserRole.Student,
            IsActive = isActive,
        };

        ctx.Db.Users.Add(user);
        ctx.Db.SaveChanges();
        return user;
    }

    // --- Sign-in -----------------------------------------------------------

    [Fact]
    public async Task Correct_credentials_return_tokens_and_the_profile()
    {
        using var ctx = new TestContext();
        var (service, hasher, _) = Build(ctx);
        var user = AddAccount(ctx, hasher);

        var result = await service.LoginAsync(
            new LoginRequest(user.Email, Password), "127.0.0.1");

        result.AccessToken.Should().NotBeNullOrWhiteSpace();
        result.RefreshToken.Should().NotBeNullOrWhiteSpace();
        result.User.Email.Should().Be(user.Email);
        result.User.Role.Should().Be(UserRole.Student);
    }

    [Fact]
    public async Task Email_is_matched_case_insensitively()
    {
        using var ctx = new TestContext();
        var (service, hasher, _) = Build(ctx);
        AddAccount(ctx, hasher);

        var act = () => service.LoginAsync(
            new LoginRequest("  NADIA.ISLAM@School.edu ", Password), null);

        await act.Should().NotThrowAsync();
    }

    [Fact]
    public async Task A_wrong_password_and_an_unknown_email_fail_identically()
    {
        using var ctx = new TestContext();
        var (service, hasher, _) = Build(ctx);
        var user = AddAccount(ctx, hasher);

        var wrongPassword = await Capture(() =>
            service.LoginAsync(new LoginRequest(user.Email, "not-the-password"), null));

        var unknownEmail = await Capture(() =>
            service.LoginAsync(new LoginRequest("nobody@nowhere.com", Password), null));

        // Distinguishing the two would turn the login form into an
        // account-enumeration oracle.
        wrongPassword.Should().Be(unknownEmail);
    }

    [Fact]
    public async Task A_deactivated_account_is_told_why_once_the_password_is_proved()
    {
        // The generic message guards the enumeration boundary, and that boundary
        // is the password. Someone who supplies the right password has already
        // proved the account is theirs, so withholding the reason only sends
        // them hunting for a typo that is not there.
        using var ctx = new TestContext();
        var (service, hasher, _) = Build(ctx);
        var user = AddAccount(ctx, hasher, isActive: false);

        var deactivated = await Capture(() =>
            service.LoginAsync(new LoginRequest(user.Email, Password), null));

        deactivated.Should().Contain("deactivated");
    }

    [Fact]
    public async Task A_deactivated_account_still_hides_behind_the_generic_message_on_a_wrong_password()
    {
        using var ctx = new TestContext();
        var (service, hasher, _) = Build(ctx);
        var user = AddAccount(ctx, hasher, isActive: false);

        var wrongPassword = await Capture(() =>
            service.LoginAsync(new LoginRequest(user.Email, "not-the-password"), null));

        var unknownEmail = await Capture(() =>
            service.LoginAsync(new LoginRequest("nobody@nowhere.com", Password), null));

        // Without the password, a deactivated account is indistinguishable from
        // one that never existed.
        wrongPassword.Should().Be(unknownEmail);
    }

    [Fact]
    public async Task Signing_in_records_the_time()
    {
        using var ctx = new TestContext();
        var (service, hasher, _) = Build(ctx);
        var user = AddAccount(ctx, hasher);

        await service.LoginAsync(new LoginRequest(user.Email, Password), null);

        ctx.Db.Users.Single().LastLoginAt.Should().Be(ctx.Clock.UtcNow);
    }

    [Fact]
    public async Task The_raw_refresh_token_is_never_stored()
    {
        using var ctx = new TestContext();
        var (service, hasher, _) = Build(ctx);
        var user = AddAccount(ctx, hasher);

        var result = await service.LoginAsync(new LoginRequest(user.Email, Password), null);

        var stored = ctx.Db.RefreshTokens.Single();

        // A leaked database must not yield a usable session.
        stored.TokenHash.Should().NotBe(result.RefreshToken);
        stored.TokenHash.Should().HaveLength(64); // SHA-256, hex
    }

    // --- Refresh -----------------------------------------------------------

    [Fact]
    public async Task Refreshing_rotates_the_token()
    {
        using var ctx = new TestContext();
        var (service, hasher, _) = Build(ctx);
        var user = AddAccount(ctx, hasher);

        var first = await service.LoginAsync(new LoginRequest(user.Email, Password), null);
        ctx.Clock.Advance(TimeSpan.FromMinutes(1));

        var second = await service.RefreshAsync(new RefreshRequest(first.RefreshToken), null);

        second.RefreshToken.Should().NotBe(first.RefreshToken);
    }

    [Fact]
    public async Task Replaying_a_rotated_token_revokes_every_session()
    {
        using var ctx = new TestContext();
        var (service, hasher, _) = Build(ctx);
        var user = AddAccount(ctx, hasher);

        var first = await service.LoginAsync(new LoginRequest(user.Email, Password), null);
        var second = await service.RefreshAsync(new RefreshRequest(first.RefreshToken), null);

        // Presenting the spent token means it either leaked or is being
        // replayed — either way the safe answer is to end the whole chain.
        var replay = () => service.RefreshAsync(new RefreshRequest(first.RefreshToken), null);
        await replay.Should().ThrowAsync<UnauthorizedException>();

        var afterReplay = () => service.RefreshAsync(new RefreshRequest(second.RefreshToken), null);
        await afterReplay.Should().ThrowAsync<UnauthorizedException>();

        ctx.Db.RefreshTokens.Should().OnlyContain(t => t.RevokedAt != null);
    }

    [Fact]
    public async Task An_expired_refresh_token_is_rejected()
    {
        using var ctx = new TestContext();
        var (service, hasher, _) = Build(ctx);
        var user = AddAccount(ctx, hasher);

        var session = await service.LoginAsync(new LoginRequest(user.Email, Password), null);

        ctx.Clock.Advance(TimeSpan.FromDays(8)); // lifetime is 7 days

        var act = () => service.RefreshAsync(new RefreshRequest(session.RefreshToken), null);

        await act.Should().ThrowAsync<UnauthorizedException>();
    }

    [Fact]
    public async Task Signing_out_revokes_the_token()
    {
        using var ctx = new TestContext();
        var (service, hasher, _) = Build(ctx);
        var user = AddAccount(ctx, hasher);

        var session = await service.LoginAsync(new LoginRequest(user.Email, Password), null);
        await service.LogoutAsync(new LogoutRequest(session.RefreshToken));

        var act = () => service.RefreshAsync(new RefreshRequest(session.RefreshToken), null);

        await act.Should().ThrowAsync<UnauthorizedException>();
    }

    [Fact]
    public async Task Signing_out_an_unknown_token_is_not_an_error()
    {
        using var ctx = new TestContext();
        var (service, _, _) = Build(ctx);

        // The caller's intent — end the session — is satisfied either way.
        var act = () => service.LogoutAsync(new LogoutRequest("never-issued"));

        await act.Should().NotThrowAsync();
    }

    // --- Password change ---------------------------------------------------

    [Fact]
    public async Task Changing_a_password_revokes_existing_sessions()
    {
        using var ctx = new TestContext();
        var (service, hasher, _) = Build(ctx);
        var user = AddAccount(ctx, hasher);

        var session = await service.LoginAsync(new LoginRequest(user.Email, Password), null);
        ctx.SignIn(user);

        await service.ChangePasswordAsync(new ChangePasswordRequest(Password, "NewPass@567"));

        // The old password established those sessions.
        var act = () => service.RefreshAsync(new RefreshRequest(session.RefreshToken), null);
        await act.Should().ThrowAsync<UnauthorizedException>();
    }

    [Fact]
    public async Task Changing_a_password_requires_the_current_one()
    {
        using var ctx = new TestContext();
        var (service, hasher, _) = Build(ctx);
        var user = AddAccount(ctx, hasher);
        ctx.SignIn(user);

        var act = () => service.ChangePasswordAsync(
            new ChangePasswordRequest("wrong-current", "NewPass@567"));

        await act.Should().ThrowAsync<UnauthorizedException>();
    }

    // --- Hashing -----------------------------------------------------------

    [Fact]
    public void Hashing_the_same_password_twice_gives_different_hashes()
    {
        var hasher = new BCryptPasswordHasher();

        var first = hasher.Hash(Password);
        var second = hasher.Hash(Password);

        // Each hash carries its own salt.
        first.Should().NotBe(second);
        hasher.Verify(Password, first).Should().BeTrue();
        hasher.Verify(Password, second).Should().BeTrue();
    }

    [Fact]
    public void A_malformed_hash_fails_verification_rather_than_throwing()
    {
        var hasher = new BCryptPasswordHasher();

        // A corrupted row must not take the login endpoint down with it.
        hasher.Verify(Password, "not-a-bcrypt-hash").Should().BeFalse();
        hasher.Verify(Password, "").Should().BeFalse();
    }

    [Fact]
    public void An_access_token_carries_the_role_and_expires_as_configured()
    {
        using var ctx = new TestContext();
        var (_, hasher, tokens) = Build(ctx);
        var user = AddAccount(ctx, hasher);

        var token = tokens.CreateAccessToken(user);

        token.ExpiresAt.Should().Be(ctx.Clock.UtcNow.AddMinutes(15));

        var payload = new System.IdentityModel.Tokens.Jwt.JwtSecurityTokenHandler()
            .ReadJwtToken(token.Value);

        payload.Claims.Should().Contain(c =>
            c.Type == System.Security.Claims.ClaimTypes.Role && c.Value == "Student");
        payload.Issuer.Should().Be("AssignmentSystem.Api");
    }

    // -----------------------------------------------------------------------

    /// <summary>Returns the failure message, so two paths can be compared.</summary>
    private static async Task<string> Capture(Func<Task> action)
    {
        try
        {
            await action();
            return "<no exception>";
        }
        catch (Exception ex)
        {
            return ex.Message;
        }
    }
}
