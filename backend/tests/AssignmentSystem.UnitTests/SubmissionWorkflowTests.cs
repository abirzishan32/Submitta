using AssignmentSystem.Application.Features.Student;
using AssignmentSystem.Domain.Enums;
using AssignmentSystem.Domain.Exceptions;
using AssignmentSystem.Infrastructure.Security;
using AssignmentSystem.UnitTests.Infrastructure;
using FluentAssertions;

namespace AssignmentSystem.UnitTests;

/// <summary>
/// The student submission workflow: what is visible, what may be submitted, and
/// when an answer may still be changed.
/// </summary>
public class SubmissionWorkflowTests
{
    private static StudentService Subject(TestContext ctx) =>
        new(ctx.Db, new BCryptPasswordHasher(), ctx.CurrentUser, ctx.Clock, ctx.Notifications,
            TestContext.Logger<StudentService>());

    // --- Visibility --------------------------------------------------------

    [Fact]
    public async Task Drafts_are_invisible_to_students()
    {
        using var ctx = new TestContext();
        var teacher = ctx.AddUser(UserRole.Teacher);
        var student = ctx.AddUser(UserRole.Student);
        var offering = ctx.AddOffering();
        ctx.Enroll(student, offering);

        ctx.AddAssignment(offering, teacher, AssignmentStatus.Published);
        ctx.AddAssignment(offering, teacher, AssignmentStatus.Draft);

        ctx.SignIn(student);

        var page = await Subject(ctx).ListAssignmentsAsync(new StudentAssignmentListQuery());

        page.TotalCount.Should().Be(1);
    }

    [Fact]
    public async Task Archived_work_is_invisible_to_students()
    {
        using var ctx = new TestContext();
        var teacher = ctx.AddUser(UserRole.Teacher);
        var student = ctx.AddUser(UserRole.Student);
        var offering = ctx.AddOffering();
        ctx.Enroll(student, offering);

        ctx.AddAssignment(offering, teacher, AssignmentStatus.Archived);
        ctx.SignIn(student);

        var page = await Subject(ctx).ListAssignmentsAsync(new StudentAssignmentListQuery());

        page.TotalCount.Should().Be(0);
    }

    [Fact]
    public async Task Students_only_see_work_for_classes_they_are_enrolled_in()
    {
        using var ctx = new TestContext();
        var teacher = ctx.AddUser(UserRole.Teacher);
        var student = ctx.AddUser(UserRole.Student);

        var theirs = ctx.AddOffering("G10-A", "MATH");
        var other = ctx.AddOffering("CSE-3101", "DBMS");
        ctx.Enroll(student, theirs);

        ctx.AddAssignment(theirs, teacher);
        ctx.AddAssignment(other, teacher);

        ctx.SignIn(student);

        var page = await Subject(ctx).ListAssignmentsAsync(new StudentAssignmentListQuery());

        page.TotalCount.Should().Be(1);
    }

    [Fact]
    public async Task Opening_a_draft_directly_reports_not_found()
    {
        using var ctx = new TestContext();
        var teacher = ctx.AddUser(UserRole.Teacher);
        var student = ctx.AddUser(UserRole.Student);
        var offering = ctx.AddOffering();
        ctx.Enroll(student, offering);

        var draft = ctx.AddAssignment(offering, teacher, AssignmentStatus.Draft);
        ctx.SignIn(student);

        var act = () => Subject(ctx).GetAssignmentAsync(draft.Id);

        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task A_student_cannot_read_another_students_submission()
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

        ctx.SignIn(nadia);

        var act = () => Subject(ctx).GetSubmissionAsync(tanvirsWork.Id);

        await act.Should().ThrowAsync<NotFoundException>();
    }

    // --- Submitting --------------------------------------------------------

    [Fact]
    public async Task Submitting_before_the_deadline_is_not_flagged_late()
    {
        using var ctx = new TestContext();
        var (student, assignment) = Scenario(ctx);
        ctx.SignIn(student);

        var submission = await Subject(ctx).SubmitAsync(
            assignment.Id, new SubmitAssignmentRequest("My answer.", null));

        submission.IsLate.Should().BeFalse();
        submission.Status.Should().Be(SubmissionStatus.Submitted);
    }

    [Fact]
    public async Task Submitting_twice_is_refused()
    {
        using var ctx = new TestContext();
        var (student, assignment) = Scenario(ctx);
        ctx.SignIn(student);

        await Subject(ctx).SubmitAsync(assignment.Id, new SubmitAssignmentRequest("First.", null));

        var act = () => Subject(ctx).SubmitAsync(
            assignment.Id, new SubmitAssignmentRequest("Second.", null));

        await act.Should().ThrowAsync<ConflictException>();
    }

    [Fact]
    public async Task Submitting_after_the_deadline_is_refused_when_late_work_is_not_accepted()
    {
        using var ctx = new TestContext();
        var (student, assignment) = Scenario(ctx, allowLateSubmission: false);
        ctx.SignIn(student);

        ctx.Clock.Advance(TimeSpan.FromDays(8));

        var act = () => Subject(ctx).SubmitAsync(
            assignment.Id, new SubmitAssignmentRequest("Too late.", null));

        await act.Should().ThrowAsync<BusinessRuleException>();
    }

    [Fact]
    public async Task Submitting_after_the_deadline_is_accepted_and_flagged_when_late_work_is_allowed()
    {
        using var ctx = new TestContext();
        var (student, assignment) = Scenario(ctx, allowLateSubmission: true);
        ctx.SignIn(student);

        ctx.Clock.Advance(TimeSpan.FromDays(8));

        var submission = await Subject(ctx).SubmitAsync(
            assignment.Id, new SubmitAssignmentRequest("Late but accepted.", null));

        submission.IsLate.Should().BeTrue();
    }

    [Fact]
    public async Task Lateness_is_fixed_at_submission_time()
    {
        using var ctx = new TestContext();
        var teacher = ctx.AddUser(UserRole.Teacher);
        var student = ctx.AddUser(UserRole.Student);
        var offering = ctx.AddOffering();
        ctx.Enroll(student, offering);

        var assignment = ctx.AddAssignment(
            offering, teacher, deadline: ctx.Clock.UtcNow.AddDays(7));

        ctx.SignIn(student);
        await Subject(ctx).SubmitAsync(assignment.Id, new SubmitAssignmentRequest("On time.", null));

        // The teacher later brings the deadline forward. That must not make a
        // student retroactively late for work handed in on time.
        assignment.Deadline = ctx.Clock.UtcNow.AddDays(-1);
        ctx.Db.SaveChanges();

        var submission = (await Subject(ctx).ListSubmissionsAsync(new())).Items.Single();

        submission.IsLate.Should().BeFalse();
    }

    [Fact]
    public async Task Submitting_to_a_class_the_student_is_not_enrolled_in_reports_not_found()
    {
        using var ctx = new TestContext();
        var teacher = ctx.AddUser(UserRole.Teacher);
        var student = ctx.AddUser(UserRole.Student);

        var other = ctx.AddOffering("CSE-3101", "DBMS");
        var assignment = ctx.AddAssignment(other, teacher);

        ctx.SignIn(student);

        var act = () => Subject(ctx).SubmitAsync(
            assignment.Id, new SubmitAssignmentRequest("Not my class.", null));

        await act.Should().ThrowAsync<NotFoundException>();
    }

    // --- Updating ----------------------------------------------------------

    [Fact]
    public async Task An_answer_may_be_changed_before_the_deadline_when_allowed()
    {
        using var ctx = new TestContext();
        var (student, assignment) = Scenario(ctx, allowResubmission: true);
        ctx.SignIn(student);

        var created = await Subject(ctx).SubmitAsync(
            assignment.Id, new SubmitAssignmentRequest("First attempt.", null));

        ctx.Clock.Advance(TimeSpan.FromHours(1));

        var updated = await Subject(ctx).UpdateSubmissionAsync(
            created.Id, new UpdateSubmissionRequest("Revised answer.", null));

        updated.Content.Should().Be("Revised answer.");
        updated.LastUpdatedAt.Should().NotBeNull();
    }

    [Fact]
    public async Task An_answer_may_not_be_changed_when_resubmission_is_off()
    {
        using var ctx = new TestContext();
        var (student, assignment) = Scenario(ctx, allowResubmission: false);
        ctx.SignIn(student);

        var created = await Subject(ctx).SubmitAsync(
            assignment.Id, new SubmitAssignmentRequest("Final.", null));

        var act = () => Subject(ctx).UpdateSubmissionAsync(
            created.Id, new UpdateSubmissionRequest("Changed my mind.", null));

        await act.Should().ThrowAsync<BusinessRuleException>();
    }

    [Fact]
    public async Task An_answer_may_not_be_changed_after_the_deadline()
    {
        using var ctx = new TestContext();
        var (student, assignment) = Scenario(ctx, allowResubmission: true);
        ctx.SignIn(student);

        var created = await Subject(ctx).SubmitAsync(
            assignment.Id, new SubmitAssignmentRequest("On time.", null));

        ctx.Clock.Advance(TimeSpan.FromDays(8));

        // The deadline always applies, whatever the resubmission setting says.
        var act = () => Subject(ctx).UpdateSubmissionAsync(
            created.Id, new UpdateSubmissionRequest("Sneaking an edit in.", null));

        await act.Should().ThrowAsync<BusinessRuleException>();
    }

    [Fact]
    public async Task Graded_work_may_not_be_changed()
    {
        using var ctx = new TestContext();
        var teacher = ctx.AddUser(UserRole.Teacher);
        var student = ctx.AddUser(UserRole.Student);
        var offering = ctx.AddOffering();
        ctx.Enroll(student, offering);

        var assignment = ctx.AddAssignment(offering, teacher, allowResubmission: true);
        var submission = ctx.AddSubmission(
            assignment, student, SubmissionStatus.Graded, marks: 85m);

        ctx.SignIn(student);

        var act = () => Subject(ctx).UpdateSubmissionAsync(
            submission.Id, new UpdateSubmissionRequest("Improving my graded answer.", null));

        await act.Should().ThrowAsync<BusinessRuleException>();
    }

    [Fact]
    public async Task Work_returned_for_revision_may_be_changed_even_when_resubmission_is_off()
    {
        using var ctx = new TestContext();
        var teacher = ctx.AddUser(UserRole.Teacher);
        var student = ctx.AddUser(UserRole.Student);
        var offering = ctx.AddOffering();
        ctx.Enroll(student, offering);

        var assignment = ctx.AddAssignment(offering, teacher, allowResubmission: false);
        var submission = ctx.AddSubmission(
            assignment, student, SubmissionStatus.ReturnedForRevision);

        ctx.SignIn(student);

        var updated = await Subject(ctx).UpdateSubmissionAsync(
            submission.Id, new UpdateSubmissionRequest("Revised as asked.", null));

        // Re-editing puts it back in the marking queue.
        updated.Status.Should().Be(SubmissionStatus.Submitted);
    }

    [Fact]
    public async Task A_student_cannot_change_another_students_answer()
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

        ctx.SignIn(nadia);

        var act = () => Subject(ctx).UpdateSubmissionAsync(
            tanvirsWork.Id, new UpdateSubmissionRequest("Sabotage.", null));

        await act.Should().ThrowAsync<NotFoundException>();
    }

    // --- Availability flags ------------------------------------------------

    [Fact]
    public async Task Availability_is_reported_with_a_reason_when_blocked()
    {
        using var ctx = new TestContext();
        var (student, assignment) = Scenario(ctx, allowLateSubmission: false);
        ctx.SignIn(student);

        ctx.Clock.Advance(TimeSpan.FromDays(8));

        var detail = await Subject(ctx).GetAssignmentAsync(assignment.Id);

        detail.CanSubmit.Should().BeFalse();
        detail.CanEdit.Should().BeFalse();
        detail.BlockedReason.Should().NotBeNullOrWhiteSpace();
    }

    [Fact]
    public async Task Availability_warns_before_a_late_submission_is_made()
    {
        using var ctx = new TestContext();
        var (student, assignment) = Scenario(ctx, allowLateSubmission: true);
        ctx.SignIn(student);

        ctx.Clock.Advance(TimeSpan.FromDays(8));

        var detail = await Subject(ctx).GetAssignmentAsync(assignment.Id);

        // Allowed, but the student is told it will count as late first.
        detail.CanSubmit.Should().BeTrue();
        detail.BlockedReason.Should().NotBeNullOrWhiteSpace();
    }

    // -----------------------------------------------------------------------

    private static (Domain.Entities.User Student, Domain.Entities.Assignment Assignment) Scenario(
        TestContext ctx,
        bool allowResubmission = true,
        bool allowLateSubmission = false)
    {
        var teacher = ctx.AddUser(UserRole.Teacher);
        var student = ctx.AddUser(UserRole.Student);
        var offering = ctx.AddOffering();

        ctx.AssignTeacher(teacher, offering);
        ctx.Enroll(student, offering);

        var assignment = ctx.AddAssignment(
            offering, teacher,
            deadline: ctx.Clock.UtcNow.AddDays(7),
            allowResubmission: allowResubmission,
            allowLateSubmission: allowLateSubmission);

        return (student, assignment);
    }
}
