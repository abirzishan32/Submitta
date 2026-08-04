using AssignmentSystem.Application.Common.Security;
using AssignmentSystem.Application.Features.Teacher.Assignments;
using AssignmentSystem.Domain.Enums;
using AssignmentSystem.Domain.Exceptions;
using AssignmentSystem.UnitTests.Infrastructure;
using FluentAssertions;

namespace AssignmentSystem.UnitTests;

/// <summary>
/// Draft/publish lifecycle, deadlines and maximum marks — the rules that decide
/// what students can see and what a mark can legitimately be.
/// </summary>
public class AssignmentLifecycleTests
{
    private static AssignmentService Subject(TestContext ctx) =>
        new(
            ctx.Db,
            new AccessControl(ctx.Db, ctx.CurrentUser),
            ctx.CurrentUser,
            ctx.Clock,
            ctx.Notifications,
            TestContext.Logger<AssignmentService>());

    // --- Creation ----------------------------------------------------------

    [Fact]
    public async Task New_assignment_defaults_to_draft()
    {
        using var ctx = new TestContext();
        var teacher = ctx.AddUser(UserRole.Teacher);
        var offering = ctx.AddOffering();
        ctx.AssignTeacher(teacher, offering);
        ctx.SignIn(teacher);

        var created = await Subject(ctx).CreateAsync(new CreateAssignmentRequest(
            "Quadratics", "Solve chapter 4.", offering.Id,
            ctx.Clock.UtcNow.AddDays(7), 100m, true, false, PublishImmediately: false));

        created.Status.Should().Be(AssignmentStatus.Draft);
        created.PublishedAt.Should().BeNull();
    }

    [Fact]
    public async Task A_draft_may_hold_a_deadline_in_the_past()
    {
        using var ctx = new TestContext();
        var teacher = ctx.AddUser(UserRole.Teacher);
        var offering = ctx.AddOffering();
        ctx.AssignTeacher(teacher, offering);
        ctx.SignIn(teacher);

        // Not yet visible to anyone, so the date is not yet a promise.
        var act = () => Subject(ctx).CreateAsync(new CreateAssignmentRequest(
            "Draft", "…", offering.Id,
            ctx.Clock.UtcNow.AddDays(-1), 50m, true, false, PublishImmediately: false));

        await act.Should().NotThrowAsync();
    }

    [Fact]
    public async Task Publishing_on_creation_requires_a_future_deadline()
    {
        using var ctx = new TestContext();
        var teacher = ctx.AddUser(UserRole.Teacher);
        var offering = ctx.AddOffering();
        ctx.AssignTeacher(teacher, offering);
        ctx.SignIn(teacher);

        var act = () => Subject(ctx).CreateAsync(new CreateAssignmentRequest(
            "Overdue on arrival", "…", offering.Id,
            ctx.Clock.UtcNow.AddDays(-1), 50m, true, false, PublishImmediately: true));

        await act.Should().ThrowAsync<BusinessRuleException>();
    }

    [Fact]
    public async Task A_teacher_cannot_create_work_for_an_offering_they_do_not_teach()
    {
        using var ctx = new TestContext();
        var sarah = ctx.AddUser(UserRole.Teacher, "Sarah");
        var rafiqsOffering = ctx.AddOffering("CSE-3101", "DBMS");
        ctx.SignIn(sarah);

        var act = () => Subject(ctx).CreateAsync(new CreateAssignmentRequest(
            "Not mine", "…", rafiqsOffering.Id,
            ctx.Clock.UtcNow.AddDays(7), 100m, true, false, false));

        await act.Should().ThrowAsync<ForbiddenException>();
    }

    // --- Publishing --------------------------------------------------------

    [Fact]
    public async Task Publishing_a_draft_stamps_the_publication_time()
    {
        using var ctx = new TestContext();
        var teacher = ctx.AddUser(UserRole.Teacher);
        var offering = ctx.AddOffering();
        ctx.AssignTeacher(teacher, offering);
        ctx.SignIn(teacher);

        var draft = ctx.AddAssignment(offering, teacher, AssignmentStatus.Draft);

        var published = await Subject(ctx).PublishAsync(draft.Id);

        published.Status.Should().Be(AssignmentStatus.Published);
        published.PublishedAt.Should().Be(ctx.Clock.UtcNow);
    }

    [Fact]
    public async Task Publishing_is_refused_once_the_deadline_has_passed()
    {
        using var ctx = new TestContext();
        var teacher = ctx.AddUser(UserRole.Teacher);
        var offering = ctx.AddOffering();
        ctx.AssignTeacher(teacher, offering);
        ctx.SignIn(teacher);

        var draft = ctx.AddAssignment(
            offering, teacher, AssignmentStatus.Draft,
            deadline: ctx.Clock.UtcNow.AddHours(1));

        // Time passes while the draft sits unpublished.
        ctx.Clock.Advance(TimeSpan.FromHours(2));

        var act = () => Subject(ctx).PublishAsync(draft.Id);

        await act.Should().ThrowAsync<BusinessRuleException>();
    }

    [Fact]
    public async Task Publishing_twice_is_refused()
    {
        using var ctx = new TestContext();
        var teacher = ctx.AddUser(UserRole.Teacher);
        var offering = ctx.AddOffering();
        ctx.AssignTeacher(teacher, offering);
        ctx.SignIn(teacher);

        var published = ctx.AddAssignment(offering, teacher, AssignmentStatus.Published);

        var act = () => Subject(ctx).PublishAsync(published.Id);

        await act.Should().ThrowAsync<BusinessRuleException>();
    }

    [Fact]
    public async Task Work_with_submissions_cannot_be_returned_to_draft()
    {
        using var ctx = new TestContext();
        var teacher = ctx.AddUser(UserRole.Teacher);
        var student = ctx.AddUser(UserRole.Student);
        var offering = ctx.AddOffering();
        ctx.AssignTeacher(teacher, offering);
        ctx.Enroll(student, offering);
        ctx.SignIn(teacher);

        var assignment = ctx.AddAssignment(offering, teacher);
        ctx.AddSubmission(assignment, student);

        // Unpublishing would hide work students have already handed in.
        var act = () => Subject(ctx).UnpublishAsync(assignment.Id);

        await act.Should().ThrowAsync<ConflictException>();
    }

    [Fact]
    public async Task Work_with_submissions_cannot_be_deleted()
    {
        using var ctx = new TestContext();
        var teacher = ctx.AddUser(UserRole.Teacher);
        var student = ctx.AddUser(UserRole.Student);
        var offering = ctx.AddOffering();
        ctx.AssignTeacher(teacher, offering);
        ctx.Enroll(student, offering);
        ctx.SignIn(teacher);

        var assignment = ctx.AddAssignment(offering, teacher);
        ctx.AddSubmission(assignment, student);

        var act = () => Subject(ctx).DeleteAsync(assignment.Id);

        await act.Should().ThrowAsync<ConflictException>();
    }

    // --- Editing -----------------------------------------------------------

    [Fact]
    public async Task A_published_deadline_cannot_be_moved_into_the_past()
    {
        using var ctx = new TestContext();
        var teacher = ctx.AddUser(UserRole.Teacher);
        var offering = ctx.AddOffering();
        ctx.AssignTeacher(teacher, offering);
        ctx.SignIn(teacher);

        var assignment = ctx.AddAssignment(offering, teacher);

        // Would retroactively make students late for work they still had time for.
        var act = () => Subject(ctx).UpdateAsync(assignment.Id, new UpdateAssignmentRequest(
            "Same", "Same", ctx.Clock.UtcNow.AddDays(-1), 100m, true, false));

        await act.Should().ThrowAsync<BusinessRuleException>();
    }

    [Fact]
    public async Task Maximum_marks_cannot_drop_below_marks_already_awarded()
    {
        using var ctx = new TestContext();
        var teacher = ctx.AddUser(UserRole.Teacher);
        var student = ctx.AddUser(UserRole.Student);
        var offering = ctx.AddOffering();
        ctx.AssignTeacher(teacher, offering);
        ctx.Enroll(student, offering);
        ctx.SignIn(teacher);

        var assignment = ctx.AddAssignment(offering, teacher, maxMarks: 100m);
        ctx.AddSubmission(assignment, student, SubmissionStatus.Graded, marks: 85m);

        // 85 out of 50 is not a mark anything could later repair.
        var act = () => Subject(ctx).UpdateAsync(assignment.Id, new UpdateAssignmentRequest(
            "Same", "Same", assignment.Deadline, 50m, true, false));

        await act.Should().ThrowAsync<BusinessRuleException>();
    }

    [Fact]
    public async Task Maximum_marks_may_be_raised_above_marks_already_awarded()
    {
        using var ctx = new TestContext();
        var teacher = ctx.AddUser(UserRole.Teacher);
        var student = ctx.AddUser(UserRole.Student);
        var offering = ctx.AddOffering();
        ctx.AssignTeacher(teacher, offering);
        ctx.Enroll(student, offering);
        ctx.SignIn(teacher);

        var assignment = ctx.AddAssignment(offering, teacher, maxMarks: 100m);
        ctx.AddSubmission(assignment, student, SubmissionStatus.Graded, marks: 85m);

        var updated = await Subject(ctx).UpdateAsync(assignment.Id, new UpdateAssignmentRequest(
            "Same", "Same", assignment.Deadline, 150m, true, false));

        updated.MaxMarks.Should().Be(150m);
    }

    // --- Scoping -----------------------------------------------------------

    [Fact]
    public async Task A_teacher_only_lists_their_own_offerings_work()
    {
        using var ctx = new TestContext();
        var sarah = ctx.AddUser(UserRole.Teacher, "Sarah");
        var rafiq = ctx.AddUser(UserRole.Teacher, "Rafiq");

        var sarahs = ctx.AddOffering("G10-A", "MATH");
        var rafiqs = ctx.AddOffering("CSE-3101", "DBMS");
        ctx.AssignTeacher(sarah, sarahs);
        ctx.AssignTeacher(rafiq, rafiqs);

        ctx.AddAssignment(sarahs, sarah);
        ctx.AddAssignment(rafiqs, rafiq);
        ctx.AddAssignment(rafiqs, rafiq);

        ctx.SignIn(sarah);

        var page = await Subject(ctx).ListAsync(new AssignmentListQuery());

        page.TotalCount.Should().Be(1);
    }

    [Fact]
    public async Task An_admin_lists_every_offerings_work()
    {
        using var ctx = new TestContext();
        var admin = ctx.AddUser(UserRole.Admin);
        var sarah = ctx.AddUser(UserRole.Teacher, "Sarah");
        var rafiq = ctx.AddUser(UserRole.Teacher, "Rafiq");

        var sarahs = ctx.AddOffering("G10-A", "MATH");
        var rafiqs = ctx.AddOffering("CSE-3101", "DBMS");

        ctx.AddAssignment(sarahs, sarah);
        ctx.AddAssignment(rafiqs, rafiq);

        ctx.SignIn(admin);

        var page = await Subject(ctx).ListAsync(new AssignmentListQuery());

        page.TotalCount.Should().Be(2);
    }

    [Fact]
    public async Task Reading_another_teachers_assignment_reports_not_found()
    {
        using var ctx = new TestContext();
        var sarah = ctx.AddUser(UserRole.Teacher, "Sarah");
        var rafiq = ctx.AddUser(UserRole.Teacher, "Rafiq");

        var rafiqs = ctx.AddOffering("CSE-3101", "DBMS");
        ctx.AssignTeacher(rafiq, rafiqs);
        var assignment = ctx.AddAssignment(rafiqs, rafiq);

        ctx.SignIn(sarah);

        // Not "forbidden": Sarah has no business learning it exists.
        var act = () => Subject(ctx).GetAsync(assignment.Id);

        await act.Should().ThrowAsync<NotFoundException>();
    }
}
