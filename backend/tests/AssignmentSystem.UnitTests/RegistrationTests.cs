using AssignmentSystem.Application.Features.Auth;
using AssignmentSystem.Domain.Entities;
using AssignmentSystem.Domain.Enums;
using AssignmentSystem.Domain.Exceptions;
using AssignmentSystem.Infrastructure.Security;
using AssignmentSystem.UnitTests.Infrastructure;
using FluentAssertions;
using Microsoft.Extensions.Options;

namespace AssignmentSystem.UnitTests;

/// <summary>
/// Self-registration.
///
/// The rules here decide who can obtain which powers by filling in a form, so
/// they are the ones worth pinning down: an administrator account must be
/// unobtainable, a teacher account must not grant anything until a person has
/// approved it, and a closed instance must stay closed.
/// </summary>
public class RegistrationTests
{
    private const string GoodPassword = "Str0ngPass";

    private static AuthService Build(TestContext ctx)
    {
        var options = new JwtOptions
        {
            Key = "test-signing-key-at-least-32-characters-long-for-hmac",
            Issuer = "AssignmentSystem.Api",
            Audience = "AssignmentSystem.Client",
            AccessTokenMinutes = 15,
            RefreshTokenDays = 7,
        };

        return new AuthService(
            ctx.Db,
            new BCryptPasswordHasher(),
            new JwtTokenService(Options.Create(options), ctx.Clock),
            ctx.CurrentUser,
            ctx.Clock,
            TestContext.Logger<AuthService>());
    }

    /// <summary>Writes the settings that govern who may register.</summary>
    private static void Configure(
        TestContext ctx,
        bool selfRegistration = true,
        bool teacherRegistration = true,
        bool teacherApproval = true)
    {
        ctx.Db.ApplicationSettings.AddRange(
            Setting("auth.allow_self_registration", selfRegistration),
            Setting("auth.allow_teacher_registration", teacherRegistration),
            Setting("auth.teacher_requires_approval", teacherApproval));

        ctx.Db.SaveChanges();

        static ApplicationSetting Setting(string key, bool value) => new()
        {
            Key = key,
            Value = value ? "true" : "false",
            DataType = "boolean",
            IsPublic = true,
        };
    }

    private static RegisterRequest Request(
        UserRole role = UserRole.Student,
        string email = "new.student@school.edu",
        Guid? classId = null) =>
        new("New Person", email, GoodPassword, GoodPassword, role, classId);

    // --- Students ----------------------------------------------------------

    [Fact]
    public async Task A_student_is_registered_and_signed_in_immediately()
    {
        using var ctx = new TestContext();
        Configure(ctx);

        var result = await Build(ctx).RegisterAsync(Request(), "127.0.0.1");

        result.RequiresApproval.Should().BeFalse();
        result.User.Role.Should().Be(UserRole.Student);
        result.User.IsActive.Should().BeTrue();

        // Signed in there and then, rather than sent to a form to retype the
        // password they just chose.
        result.Session.Should().NotBeNull();
        result.Session!.AccessToken.Should().NotBeNullOrWhiteSpace();
    }

    [Fact]
    public async Task A_student_who_picks_a_class_is_enrolled_in_it()
    {
        using var ctx = new TestContext();
        Configure(ctx);
        var offering = ctx.AddOffering();

        var result = await Build(ctx).RegisterAsync(
            Request(classId: offering.ClassId), null);

        ctx.Db.Enrollments
            .Should().ContainSingle(e =>
                e.StudentId == result.User.Id && e.ClassId == offering.ClassId);
    }

    [Fact]
    public async Task A_student_may_register_without_choosing_a_class()
    {
        using var ctx = new TestContext();
        Configure(ctx);

        var result = await Build(ctx).RegisterAsync(Request(classId: null), null);

        result.User.IsActive.Should().BeTrue();
        ctx.Db.Enrollments.Should().BeEmpty();
    }

    [Fact]
    public async Task Registering_into_a_class_that_does_not_exist_is_refused()
    {
        using var ctx = new TestContext();
        Configure(ctx);

        var act = () => Build(ctx).RegisterAsync(Request(classId: Guid.NewGuid()), null);

        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task The_email_is_stored_lowercased_so_case_cannot_duplicate_an_account()
    {
        using var ctx = new TestContext();
        Configure(ctx);
        var service = Build(ctx);

        await service.RegisterAsync(Request(email: "Mixed.Case@School.edu"), null);

        var act = () => service.RegisterAsync(Request(email: "mixed.case@school.edu"), null);

        await act.Should().ThrowAsync<ConflictException>();
    }

    // --- Teachers ----------------------------------------------------------

    [Fact]
    public async Task A_teacher_account_is_created_deactivated_and_awaits_approval()
    {
        // Being a teacher grants access to other people's work, so the claim is
        // checked by a person before it grants anything.
        using var ctx = new TestContext();
        Configure(ctx, teacherApproval: true);

        var result = await Build(ctx).RegisterAsync(
            Request(UserRole.Teacher, "new.teacher@school.edu"), null);

        result.RequiresApproval.Should().BeTrue();
        result.User.IsActive.Should().BeFalse();
        result.Session.Should().BeNull();
    }

    [Fact]
    public async Task A_pending_teacher_cannot_sign_in_until_approved()
    {
        using var ctx = new TestContext();
        Configure(ctx, teacherApproval: true);
        var service = Build(ctx);

        await service.RegisterAsync(Request(UserRole.Teacher, "new.teacher@school.edu"), null);

        var act = () => service.LoginAsync(
            new LoginRequest("new.teacher@school.edu", GoodPassword), null);

        var thrown = await act.Should().ThrowAsync<UnauthorizedException>();

        // Named plainly: the password has already been proved, so there is
        // nothing left to withhold from the account's owner.
        thrown.Which.Message.Should().Contain("approve");
    }

    [Fact]
    public async Task An_approved_teacher_can_sign_in()
    {
        using var ctx = new TestContext();
        Configure(ctx, teacherApproval: true);
        var service = Build(ctx);

        var registered = await service.RegisterAsync(
            Request(UserRole.Teacher, "new.teacher@school.edu"), null);

        // What an administrator does from the users screen.
        var account = ctx.Db.Users.Single(u => u.Id == registered.User.Id);
        account.IsActive = true;
        ctx.Db.SaveChanges();

        var session = await service.LoginAsync(
            new LoginRequest("new.teacher@school.edu", GoodPassword), null);

        session.User.Role.Should().Be(UserRole.Teacher);
    }

    [Fact]
    public async Task Teacher_registration_can_be_turned_off_entirely()
    {
        using var ctx = new TestContext();
        Configure(ctx, teacherRegistration: false);

        var act = () => Build(ctx).RegisterAsync(
            Request(UserRole.Teacher, "new.teacher@school.edu"), null);

        await act.Should().ThrowAsync<BusinessRuleException>();
    }

    // --- Administrators ----------------------------------------------------

    [Fact]
    public async Task An_administrator_account_can_never_be_self_registered()
    {
        using var ctx = new TestContext();
        Configure(ctx);

        var act = () => Build(ctx).RegisterAsync(
            Request(UserRole.Admin, "wannabe.admin@school.edu"), null);

        await act.Should().ThrowAsync<BusinessRuleException>();
        ctx.Db.Users.Should().BeEmpty();
    }

    // --- The switch --------------------------------------------------------

    [Fact]
    public async Task Registration_can_be_closed()
    {
        using var ctx = new TestContext();
        Configure(ctx, selfRegistration: false);

        var act = () => Build(ctx).RegisterAsync(Request(), null);

        await act.Should().ThrowAsync<BusinessRuleException>();
    }

    [Fact]
    public async Task Registration_is_closed_when_the_settings_are_missing()
    {
        // A database without these rows must fail shut. A missing setting can
        // never be the reason someone gets an account they should not have.
        using var ctx = new TestContext();

        var act = () => Build(ctx).RegisterAsync(Request(), null);

        await act.Should().ThrowAsync<BusinessRuleException>();
    }

    [Fact]
    public async Task The_class_list_is_withheld_while_registration_is_closed()
    {
        using var ctx = new TestContext();
        Configure(ctx, selfRegistration: false);
        ctx.AddOffering();

        var options = await Build(ctx).GetRegistrationOptionsAsync();

        options.SelfRegistrationEnabled.Should().BeFalse();
        options.Classes.Should().BeEmpty();
    }

    [Fact]
    public async Task The_class_list_is_offered_while_registration_is_open()
    {
        using var ctx = new TestContext();
        Configure(ctx);
        var offering = ctx.AddOffering();

        var options = await Build(ctx).GetRegistrationOptionsAsync();

        options.SelfRegistrationEnabled.Should().BeTrue();
        options.Classes.Should().ContainSingle(c => c.Id == offering.ClassId);
    }

    [Fact]
    public async Task An_existing_email_is_refused()
    {
        using var ctx = new TestContext();
        Configure(ctx);
        var service = Build(ctx);

        await service.RegisterAsync(Request(), null);

        var act = () => service.RegisterAsync(Request(), null);

        await act.Should().ThrowAsync<ConflictException>();
    }
}
