using AssignmentSystem.Application.Features.Admin.Academics;
using AssignmentSystem.Application.Features.Admin.Users;
using AssignmentSystem.Domain.Enums;
using AssignmentSystem.Domain.Exceptions;
using AssignmentSystem.Infrastructure.Security;
using AssignmentSystem.UnitTests.Infrastructure;
using FluentAssertions;

namespace AssignmentSystem.UnitTests;

/// <summary>
/// Administrative guards — the rules that stop an admin from locking everyone
/// out, or from severing records that later work depends on.
/// </summary>
public class AdminGuardTests
{
    private static UserService Users(TestContext ctx) =>
        new(ctx.Db, new BCryptPasswordHasher(), ctx.CurrentUser, TestContext.Logger<UserService>());

    private static OfferingService Offerings(TestContext ctx) =>
        new(ctx.Db, ctx.CurrentUser, ctx.Clock, TestContext.Logger<OfferingService>());

    private static EnrollmentService Enrolments(TestContext ctx) =>
        new(ctx.Db, ctx.CurrentUser, ctx.Clock, TestContext.Logger<EnrollmentService>());

    // --- Self-protection ---------------------------------------------------

    [Fact]
    public async Task An_admin_cannot_deactivate_themselves()
    {
        using var ctx = new TestContext();
        var admin = ctx.AddUser(UserRole.Admin);
        ctx.AddUser(UserRole.Admin, "Second Admin");
        ctx.SignIn(admin);

        var act = () => Users(ctx).SetStatusAsync(admin.Id, new SetUserStatusRequest(false));

        await act.Should().ThrowAsync<BusinessRuleException>();
    }

    [Fact]
    public async Task An_admin_cannot_delete_themselves()
    {
        using var ctx = new TestContext();
        var admin = ctx.AddUser(UserRole.Admin);
        ctx.AddUser(UserRole.Admin, "Second Admin");
        ctx.SignIn(admin);

        var act = () => Users(ctx).DeleteAsync(admin.Id);

        await act.Should().ThrowAsync<BusinessRuleException>();
    }

    [Fact]
    public async Task The_last_active_admin_cannot_be_deactivated()
    {
        using var ctx = new TestContext();
        var acting = ctx.AddUser(UserRole.Admin, "Acting Admin");
        var lastOther = ctx.AddUser(UserRole.Admin, "Only Other Admin");
        ctx.SignIn(acting);

        // Deactivate the other admin, leaving only the acting one…
        await Users(ctx).SetStatusAsync(lastOther.Id, new SetUserStatusRequest(false));

        // …at which point nobody is left who could undo it.
        var act = () => Users(ctx).SetStatusAsync(acting.Id, new SetUserStatusRequest(false));

        await act.Should().ThrowAsync<BusinessRuleException>();
    }

    // --- Referential guards ------------------------------------------------

    [Fact]
    public async Task A_teacher_still_assigned_to_a_class_cannot_be_deleted()
    {
        using var ctx = new TestContext();
        var admin = ctx.AddUser(UserRole.Admin);
        var teacher = ctx.AddUser(UserRole.Teacher);
        var offering = ctx.AddOffering();
        ctx.AssignTeacher(teacher, offering);
        ctx.SignIn(admin);

        var act = () => Users(ctx).DeleteAsync(teacher.Id);

        await act.Should().ThrowAsync<ConflictException>();
    }

    [Fact]
    public async Task A_student_still_enrolled_cannot_be_deleted()
    {
        using var ctx = new TestContext();
        var admin = ctx.AddUser(UserRole.Admin);
        var student = ctx.AddUser(UserRole.Student);
        var offering = ctx.AddOffering();
        ctx.Enroll(student, offering);
        ctx.SignIn(admin);

        var act = () => Users(ctx).DeleteAsync(student.Id);

        await act.Should().ThrowAsync<ConflictException>();
    }

    [Fact]
    public async Task A_role_cannot_change_while_role_specific_links_exist()
    {
        using var ctx = new TestContext();
        var admin = ctx.AddUser(UserRole.Admin);
        var teacher = ctx.AddUser(UserRole.Teacher);
        var offering = ctx.AddOffering();
        ctx.AssignTeacher(teacher, offering);
        ctx.SignIn(admin);

        // Their teaching assignments belong to the role being left behind.
        var act = () => Users(ctx).UpdateAsync(teacher.Id, new UpdateUserRequest(
            teacher.FullName, teacher.Email, UserRole.Student));

        await act.Should().ThrowAsync<ConflictException>();
    }

    [Fact]
    public async Task A_duplicate_email_is_refused()
    {
        using var ctx = new TestContext();
        var admin = ctx.AddUser(UserRole.Admin);
        var existing = ctx.AddUser(UserRole.Student);
        ctx.SignIn(admin);

        var act = () => Users(ctx).CreateAsync(new CreateUserRequest(
            "Someone Else", existing.Email.ToUpperInvariant(), "Passw0rd!", UserRole.Student));

        await act.Should().ThrowAsync<ConflictException>();
    }

    // --- Teaching and enrolment --------------------------------------------

    [Fact]
    public async Task Only_a_teacher_can_be_assigned_to_an_offering()
    {
        using var ctx = new TestContext();
        var admin = ctx.AddUser(UserRole.Admin);
        var student = ctx.AddUser(UserRole.Student);
        var offering = ctx.AddOffering();
        ctx.SignIn(admin);

        // Otherwise teaching permissions could be granted through the back door.
        var act = () => Offerings(ctx).AssignTeacherAsync(
            new AssignTeacherRequest(student.Id, offering.Id));

        await act.Should().ThrowAsync<BusinessRuleException>();
    }

    [Fact]
    public async Task A_deactivated_teacher_cannot_be_assigned()
    {
        using var ctx = new TestContext();
        var admin = ctx.AddUser(UserRole.Admin);
        var teacher = ctx.AddUser(UserRole.Teacher, "Inactive", isActive: false);
        var offering = ctx.AddOffering();
        ctx.SignIn(admin);

        var act = () => Offerings(ctx).AssignTeacherAsync(
            new AssignTeacherRequest(teacher.Id, offering.Id));

        await act.Should().ThrowAsync<BusinessRuleException>();
    }

    [Fact]
    public async Task Only_a_student_can_be_enrolled()
    {
        using var ctx = new TestContext();
        var admin = ctx.AddUser(UserRole.Admin);
        var teacher = ctx.AddUser(UserRole.Teacher);
        var offering = ctx.AddOffering();
        ctx.SignIn(admin);

        var act = () => Enrolments(ctx).CreateAsync(
            new CreateEnrollmentRequest(teacher.Id, offering.ClassId));

        await act.Should().ThrowAsync<BusinessRuleException>();
    }

    [Fact]
    public async Task Enrolling_the_same_student_twice_is_refused()
    {
        using var ctx = new TestContext();
        var admin = ctx.AddUser(UserRole.Admin);
        var student = ctx.AddUser(UserRole.Student);
        var offering = ctx.AddOffering();
        ctx.Enroll(student, offering);
        ctx.SignIn(admin);

        var act = () => Enrolments(ctx).CreateAsync(
            new CreateEnrollmentRequest(student.Id, offering.ClassId));

        await act.Should().ThrowAsync<ConflictException>();
    }

    [Fact]
    public async Task An_enrolment_cannot_be_removed_once_work_has_been_submitted()
    {
        using var ctx = new TestContext();
        var admin = ctx.AddUser(UserRole.Admin);
        var teacher = ctx.AddUser(UserRole.Teacher);
        var student = ctx.AddUser(UserRole.Student);
        var offering = ctx.AddOffering();

        var enrolment = ctx.Enroll(student, offering);
        var assignment = ctx.AddAssignment(offering, teacher);
        ctx.AddSubmission(assignment, student);

        ctx.SignIn(admin);

        // Removing it would hide the student's own marks from them.
        var act = () => Enrolments(ctx).DeleteAsync(enrolment.Id);

        await act.Should().ThrowAsync<ConflictException>();
    }

    [Fact]
    public async Task Bulk_enrolment_skips_students_already_enrolled()
    {
        using var ctx = new TestContext();
        var admin = ctx.AddUser(UserRole.Admin);
        var already = ctx.AddUser(UserRole.Student, "Already Enrolled");
        var fresh = ctx.AddUser(UserRole.Student, "New Student");
        var offering = ctx.AddOffering();

        ctx.Enroll(already, offering);
        ctx.SignIn(admin);

        // Re-running after adding one name must not fail on the rest.
        var created = await Enrolments(ctx).BulkEnrollAsync(
            new BulkEnrollRequest(offering.ClassId, [already.Id, fresh.Id]));

        created.Should().ContainSingle()
            .Which.StudentName.Should().Be("New Student");
    }
}
