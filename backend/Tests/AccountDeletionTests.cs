using AssignmentSystem.Application.Features.Student;
using AssignmentSystem.Domain.Entities;
using AssignmentSystem.Domain.Enums;
using AssignmentSystem.Domain.Exceptions;
using AssignmentSystem.Infrastructure.Security;
using AssignmentSystem.UnitTests.Infrastructure;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;

namespace AssignmentSystem.UnitTests;

/// <summary>
/// Self-service account deletion — a student closing their own account.
///
/// Restricted to students by <c>[Authorize(Policy = StudentOnly)]</c> on the
/// controller, which is not exercised at this layer; these tests cover what the
/// policy attribute cannot express — the password check and the guards that
/// keep a soft delete from hiding a name still attached to real academic work.
/// </summary>
public class AccountDeletionTests
{
    private const string Password = "Demo@1234";
    private const string Confirmation = "I want to delete my account";

    private static (StudentService Service, BCryptPasswordHasher Hasher) Build(TestContext ctx)
    {
        var hasher = new BCryptPasswordHasher();

        var service = new StudentService(
            ctx.Db, hasher, ctx.CurrentUser, ctx.Clock, ctx.Notifications,
            TestContext.Logger<StudentService>());

        return (service, hasher);
    }

    /// <summary>
    /// Seeded directly with a real hash rather than through <c>ctx.AddUser</c>,
    /// whose placeholder hash cannot be verified against any password.
    /// </summary>
    private static User AddAccount(TestContext ctx, BCryptPasswordHasher hasher)
    {
        var user = new User
        {
            FullName = "Nadia Islam",
            Email = "nadia.islam@school.edu",
            PasswordHash = hasher.Hash(Password),
            Role = UserRole.Student,
            IsActive = true,
        };

        ctx.Db.Users.Add(user);
        ctx.Db.SaveChanges();
        return user;
    }

    [Fact]
    public async Task A_student_with_no_history_can_delete_their_own_account()
    {
        using var ctx = new TestContext();
        var (service, hasher) = Build(ctx);
        var student = AddAccount(ctx, hasher);
        ctx.SignIn(student);

        await service.DeleteMyAccountAsync(new DeleteAccountRequest(Password, Confirmation));

        // The global query filter hides a soft-deleted row from an ordinary
        // query, which is the observable effect of the delete having applied.
        var stillVisible = await ctx.Db.Users.AsNoTracking()
            .AnyAsync(u => u.Id == student.Id);

        stillVisible.Should().BeFalse();
    }

    [Fact]
    public async Task Deleting_your_account_requires_the_correct_password()
    {
        using var ctx = new TestContext();
        var (service, hasher) = Build(ctx);
        var student = AddAccount(ctx, hasher);
        ctx.SignIn(student);

        var act = () => service.DeleteMyAccountAsync(
            new DeleteAccountRequest("wrong-password", Confirmation));

        await act.Should().ThrowAsync<UnauthorizedException>();

        // Refused, so the account must still be there.
        (await ctx.Db.Users.AsNoTracking().AnyAsync(u => u.Id == student.Id))
            .Should().BeTrue();
    }

    [Fact]
    public async Task A_student_still_enrolled_cannot_delete_their_own_account()
    {
        using var ctx = new TestContext();
        var (service, hasher) = Build(ctx);
        var student = AddAccount(ctx, hasher);
        var offering = ctx.AddOffering();
        ctx.Enroll(student, offering);
        ctx.SignIn(student);

        var act = () => service.DeleteMyAccountAsync(new DeleteAccountRequest(Password, Confirmation));

        await act.Should().ThrowAsync<ConflictException>();
    }

    [Fact]
    public async Task A_student_with_submitted_work_cannot_delete_their_own_account()
    {
        using var ctx = new TestContext();
        var (service, hasher) = Build(ctx);
        var student = AddAccount(ctx, hasher);
        var teacher = ctx.AddUser(UserRole.Teacher);
        var offering = ctx.AddOffering();
        var assignment = ctx.AddAssignment(offering, teacher);
        ctx.AddSubmission(assignment, student);
        ctx.SignIn(student);

        var act = () => service.DeleteMyAccountAsync(new DeleteAccountRequest(Password, Confirmation));

        await act.Should().ThrowAsync<ConflictException>();
    }

    [Fact]
    public async Task Deleting_your_account_revokes_existing_sessions()
    {
        using var ctx = new TestContext();
        var (service, hasher) = Build(ctx);
        var student = AddAccount(ctx, hasher);

        var token = new RefreshToken
        {
            UserId = student.Id,
            TokenHash = "some-hash",
            ExpiresAt = ctx.Clock.UtcNow.AddDays(7),
        };
        ctx.Db.RefreshTokens.Add(token);
        ctx.Db.SaveChanges();

        ctx.SignIn(student);
        await service.DeleteMyAccountAsync(new DeleteAccountRequest(Password, Confirmation));

        // The token is revoked explicitly, and then soft-deleted a second time
        // over as EF cascades the deletion from its now-removed user — so it no
        // longer surfaces through an ordinary, filtered query at all. Bypassing
        // the filter is the only way to see that the revoke actually happened
        // rather than merely being made moot by the cascade.
        var stored = await ctx.Db.RefreshTokens.IgnoreQueryFilters().AsNoTracking()
            .FirstAsync(t => t.Id == token.Id);

        stored.RevokedAt.Should().NotBeNull();
        stored.IsDeleted.Should().BeTrue();
    }
}
