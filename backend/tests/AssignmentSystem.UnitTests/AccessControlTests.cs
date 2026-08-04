using AssignmentSystem.Application.Common.Security;
using AssignmentSystem.Domain.Enums;
using AssignmentSystem.Domain.Exceptions;
using AssignmentSystem.UnitTests.Infrastructure;
using FluentAssertions;

namespace AssignmentSystem.UnitTests;

/// <summary>
/// Resource-level authorization: not "is this caller a Teacher?" but "is this
/// caller the teacher of <em>this</em> offering?".
///
/// These are the checks a role attribute cannot make, and the ones that decide
/// whether one teacher can reach another's class or one student another's work.
/// </summary>
public class AccessControlTests
{
    private static AccessControl Subject(TestContext ctx) => new(ctx.Db, ctx.CurrentUser);

    [Fact]
    public async Task Teacher_may_manage_an_offering_they_are_assigned_to()
    {
        using var ctx = new TestContext();
        var teacher = ctx.AddUser(UserRole.Teacher);
        var offering = ctx.AddOffering();
        ctx.AssignTeacher(teacher, offering);
        ctx.SignIn(teacher);

        var act = () => Subject(ctx).EnsureCanManageOfferingAsync(offering.Id);

        await act.Should().NotThrowAsync();
    }

    [Fact]
    public async Task Teacher_may_not_manage_another_teachers_offering()
    {
        using var ctx = new TestContext();
        var sarah = ctx.AddUser(UserRole.Teacher, "Sarah");
        var rafiq = ctx.AddUser(UserRole.Teacher, "Rafiq");

        var sarahsOffering = ctx.AddOffering("G10-A", "MATH");
        var rafiqsOffering = ctx.AddOffering("CSE-3101", "DBMS");

        ctx.AssignTeacher(sarah, sarahsOffering);
        ctx.AssignTeacher(rafiq, rafiqsOffering);

        ctx.SignIn(sarah);

        var act = () => Subject(ctx).EnsureCanManageOfferingAsync(rafiqsOffering.Id);

        await act.Should().ThrowAsync<ForbiddenException>();
    }

    [Fact]
    public async Task Admin_may_manage_any_offering()
    {
        using var ctx = new TestContext();
        var admin = ctx.AddUser(UserRole.Admin);
        var offering = ctx.AddOffering();
        ctx.SignIn(admin);

        var act = () => Subject(ctx).EnsureCanManageOfferingAsync(offering.Id);

        await act.Should().NotThrowAsync();
    }

    [Fact]
    public async Task Student_may_not_manage_an_offering_even_when_enrolled()
    {
        using var ctx = new TestContext();
        var student = ctx.AddUser(UserRole.Student);
        var offering = ctx.AddOffering();
        ctx.Enroll(student, offering);
        ctx.SignIn(student);

        var act = () => Subject(ctx).EnsureCanManageOfferingAsync(offering.Id);

        await act.Should().ThrowAsync<ForbiddenException>();
    }

    [Fact]
    public async Task Enrolled_student_is_recognised_for_their_offering()
    {
        using var ctx = new TestContext();
        var student = ctx.AddUser(UserRole.Student);
        var offering = ctx.AddOffering();
        ctx.Enroll(student, offering);
        ctx.SignIn(student);

        var enrolled = await Subject(ctx).IsEnrolledInOfferingAsync(offering.Id);

        enrolled.Should().BeTrue();
    }

    [Fact]
    public async Task Student_enrolled_elsewhere_is_not_recognised()
    {
        using var ctx = new TestContext();
        var student = ctx.AddUser(UserRole.Student);
        var theirs = ctx.AddOffering("G10-A", "MATH");
        var other = ctx.AddOffering("CSE-3101", "DBMS");

        ctx.Enroll(student, theirs);
        ctx.SignIn(student);

        var enrolled = await Subject(ctx).IsEnrolledInOfferingAsync(other.Id);

        enrolled.Should().BeFalse();
    }

    [Fact]
    public async Task Student_may_view_their_own_submission()
    {
        using var ctx = new TestContext();
        var teacher = ctx.AddUser(UserRole.Teacher);
        var student = ctx.AddUser(UserRole.Student);
        var offering = ctx.AddOffering();
        ctx.Enroll(student, offering);

        var assignment = ctx.AddAssignment(offering, teacher);
        var submission = ctx.AddSubmission(assignment, student);

        ctx.SignIn(student);

        var act = () => Subject(ctx).EnsureCanViewSubmissionAsync(submission.Id);

        await act.Should().NotThrowAsync();
    }

    [Fact]
    public async Task Student_may_not_view_another_students_submission()
    {
        using var ctx = new TestContext();
        var teacher = ctx.AddUser(UserRole.Teacher);
        var nadia = ctx.AddUser(UserRole.Student, "Nadia");
        var tanvir = ctx.AddUser(UserRole.Student, "Tanvir");

        var offering = ctx.AddOffering();
        ctx.Enroll(nadia, offering);
        ctx.Enroll(tanvir, offering);

        var assignment = ctx.AddAssignment(offering, teacher);
        var tanvirsWork = ctx.AddSubmission(assignment, tanvir);

        // Same class, same assignment — only the author may read it.
        ctx.SignIn(nadia);

        var act = () => Subject(ctx).EnsureCanViewSubmissionAsync(tanvirsWork.Id);

        await act.Should().ThrowAsync<ForbiddenException>();
    }

    [Fact]
    public async Task Teacher_of_the_offering_may_view_a_submission()
    {
        using var ctx = new TestContext();
        var teacher = ctx.AddUser(UserRole.Teacher);
        var student = ctx.AddUser(UserRole.Student);
        var offering = ctx.AddOffering();

        ctx.AssignTeacher(teacher, offering);
        ctx.Enroll(student, offering);

        var assignment = ctx.AddAssignment(offering, teacher);
        var submission = ctx.AddSubmission(assignment, student);

        ctx.SignIn(teacher);

        var act = () => Subject(ctx).EnsureCanViewSubmissionAsync(submission.Id);

        await act.Should().NotThrowAsync();
    }

    [Fact]
    public async Task Teacher_of_another_offering_may_not_view_a_submission()
    {
        using var ctx = new TestContext();
        var sarah = ctx.AddUser(UserRole.Teacher, "Sarah");
        var rafiq = ctx.AddUser(UserRole.Teacher, "Rafiq");
        var student = ctx.AddUser(UserRole.Student);

        var rafiqsOffering = ctx.AddOffering("CSE-3101", "DBMS");
        ctx.AssignTeacher(rafiq, rafiqsOffering);
        ctx.Enroll(student, rafiqsOffering);

        var assignment = ctx.AddAssignment(rafiqsOffering, rafiq);
        var submission = ctx.AddSubmission(assignment, student);

        ctx.SignIn(sarah);

        var act = () => Subject(ctx).EnsureCanViewSubmissionAsync(submission.Id);

        await act.Should().ThrowAsync<ForbiddenException>();
    }

    [Fact]
    public async Task Viewing_an_assignment_requires_teaching_it_or_being_enrolled()
    {
        using var ctx = new TestContext();
        var teacher = ctx.AddUser(UserRole.Teacher);
        var outsider = ctx.AddUser(UserRole.Student, "Outsider");

        var offering = ctx.AddOffering();
        ctx.AssignTeacher(teacher, offering);

        var assignment = ctx.AddAssignment(offering, teacher);

        // Enrolled in nothing at all.
        ctx.SignIn(outsider);

        var act = () => Subject(ctx).EnsureCanViewAssignmentAsync(assignment.Id);

        await act.Should().ThrowAsync<ForbiddenException>();
    }

    [Fact]
    public async Task Unknown_submission_reports_not_found_rather_than_forbidden()
    {
        using var ctx = new TestContext();
        var teacher = ctx.AddUser(UserRole.Teacher);
        ctx.SignIn(teacher);

        var act = () => Subject(ctx).EnsureCanViewSubmissionAsync(Guid.NewGuid());

        await act.Should().ThrowAsync<NotFoundException>();
    }
}
