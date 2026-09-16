using AssignmentSystem.Application.Common.Security;
using AssignmentSystem.Application.Features.Teacher.Grading;
using AssignmentSystem.Domain.Enums;
using AssignmentSystem.Domain.Exceptions;
using AssignmentSystem.UnitTests.Infrastructure;
using FluentAssertions;

namespace AssignmentSystem.UnitTests;

/// <summary>
/// Marking: bounds on marks, the grading record, and status transitions.
/// </summary>
public class GradingTests
{
    private static GradingService Subject(TestContext ctx) =>
        new(
            ctx.Db,
            new AccessControl(ctx.Db, ctx.CurrentUser),
            ctx.CurrentUser,
            ctx.Clock,
            ctx.Notifications,
            TestContext.Logger<GradingService>());

    [Fact]
    public async Task Grading_records_the_mark_the_grader_and_the_time()
    {
        using var ctx = new TestContext();
        var (teacher, _, submission) = Scenario(ctx);
        ctx.SignIn(teacher);

        var graded = await Subject(ctx).GradeAsync(
            submission.Id, new GradeSubmissionRequest(85m, "Good work."));

        graded.Status.Should().Be(SubmissionStatus.Graded);
        graded.Marks.Should().Be(85m);
        graded.GradedByTeacherId.Should().Be(teacher.Id);
        graded.GradedAt.Should().Be(ctx.Clock.UtcNow);
        graded.Feedback.Should().ContainSingle();
    }

    [Fact]
    public async Task Marks_above_the_assignment_maximum_are_refused()
    {
        using var ctx = new TestContext();
        var (teacher, _, submission) = Scenario(ctx, maxMarks: 100m);
        ctx.SignIn(teacher);

        var act = () => Subject(ctx).GradeAsync(
            submission.Id, new GradeSubmissionRequest(150m, null));

        await act.Should().ThrowAsync<BusinessRuleException>();
    }

    [Fact]
    public async Task Marks_equal_to_the_maximum_are_accepted()
    {
        using var ctx = new TestContext();
        var (teacher, _, submission) = Scenario(ctx, maxMarks: 100m);
        ctx.SignIn(teacher);

        var graded = await Subject(ctx).GradeAsync(
            submission.Id, new GradeSubmissionRequest(100m, null));

        graded.Marks.Should().Be(100m);
    }

    [Fact]
    public async Task Zero_is_a_legitimate_mark()
    {
        using var ctx = new TestContext();
        var (teacher, _, submission) = Scenario(ctx);
        ctx.SignIn(teacher);

        var graded = await Subject(ctx).GradeAsync(
            submission.Id, new GradeSubmissionRequest(0m, "Nothing correct here."));

        graded.Marks.Should().Be(0m);
        graded.Status.Should().Be(SubmissionStatus.Graded);
    }

    [Fact]
    public async Task A_teacher_cannot_grade_another_teachers_offering()
    {
        using var ctx = new TestContext();
        var (_, _, submission) = Scenario(ctx);
        var interloper = ctx.AddUser(UserRole.Teacher, "Interloper");
        ctx.SignIn(interloper);

        var act = () => Subject(ctx).GradeAsync(
            submission.Id, new GradeSubmissionRequest(50m, null));

        await act.Should().ThrowAsync<ForbiddenException>();
    }

    [Fact]
    public async Task Setting_Graded_without_marks_is_refused()
    {
        using var ctx = new TestContext();
        var (teacher, _, submission) = Scenario(ctx);
        ctx.SignIn(teacher);

        // Mirrors the database check constraint: graded work must have a mark.
        var act = () => Subject(ctx).ChangeStatusAsync(
            submission.Id, new ChangeSubmissionStatusRequest(SubmissionStatus.Graded, null));

        await act.Should().ThrowAsync<BusinessRuleException>();
    }

    [Fact]
    public async Task Moving_away_from_Graded_withdraws_the_mark()
    {
        using var ctx = new TestContext();
        var (teacher, _, submission) = Scenario(ctx);
        ctx.SignIn(teacher);

        await Subject(ctx).GradeAsync(submission.Id, new GradeSubmissionRequest(85m, "Marked."));

        var returned = await Subject(ctx).ChangeStatusAsync(
            submission.Id,
            new ChangeSubmissionStatusRequest(
                SubmissionStatus.ReturnedForRevision, "Please redo question 9."));

        // A submission must never carry marks while it is not graded.
        returned.Status.Should().Be(SubmissionStatus.ReturnedForRevision);
        returned.Marks.Should().BeNull();
        returned.GradedAt.Should().BeNull();
        returned.GradedByTeacherId.Should().BeNull();
    }

    [Fact]
    public async Task Feedback_history_survives_a_regrade()
    {
        using var ctx = new TestContext();
        var (teacher, _, submission) = Scenario(ctx);
        ctx.SignIn(teacher);

        await Subject(ctx).GradeAsync(submission.Id, new GradeSubmissionRequest(60m, "First pass."));
        await Subject(ctx).ChangeStatusAsync(
            submission.Id,
            new ChangeSubmissionStatusRequest(SubmissionStatus.ReturnedForRevision, "Try again."));
        var regraded = await Subject(ctx).GradeAsync(
            submission.Id, new GradeSubmissionRequest(80m, "Much better."));

        // This is why feedback is a table rather than a column.
        regraded.Feedback.Should().HaveCount(3);
        regraded.Feedback.First().MarksAtTime.Should().Be(60m);
        regraded.Marks.Should().Be(80m);
    }

    [Fact]
    public async Task Feedback_may_be_added_without_changing_marks_or_status()
    {
        using var ctx = new TestContext();
        var (teacher, _, submission) = Scenario(ctx);
        ctx.SignIn(teacher);

        var result = await Subject(ctx).AddFeedbackAsync(
            submission.Id, new AddFeedbackRequest("A note before marking."));

        result.Status.Should().Be(SubmissionStatus.Submitted);
        result.Marks.Should().BeNull();
        result.Feedback.Should().ContainSingle();
    }

    [Fact]
    public async Task The_per_assignment_view_lists_students_who_have_not_submitted()
    {
        using var ctx = new TestContext();
        var teacher = ctx.AddUser(UserRole.Teacher);
        var submitted = ctx.AddUser(UserRole.Student, "Submitted Student");
        var missing = ctx.AddUser(UserRole.Student, "Missing Student");

        var offering = ctx.AddOffering();
        ctx.AssignTeacher(teacher, offering);
        ctx.Enroll(submitted, offering);
        ctx.Enroll(missing, offering);

        var assignment = ctx.AddAssignment(offering, teacher);
        ctx.AddSubmission(assignment, submitted);

        ctx.SignIn(teacher);

        var view = await Subject(ctx).ListForAssignmentAsync(assignment.Id);

        view.EnrolledStudentCount.Should().Be(2);
        view.SubmittedCount.Should().Be(1);
        view.NotSubmitted.Should().ContainSingle()
            .Which.StudentName.Should().Be("Missing Student");
    }

    [Fact]
    public async Task A_teacher_only_lists_submissions_from_their_own_offerings()
    {
        using var ctx = new TestContext();
        var sarah = ctx.AddUser(UserRole.Teacher, "Sarah");
        var rafiq = ctx.AddUser(UserRole.Teacher, "Rafiq");
        var student = ctx.AddUser(UserRole.Student);

        var sarahs = ctx.AddOffering("G10-A", "MATH");
        var rafiqs = ctx.AddOffering("CSE-3101", "DBMS");
        ctx.AssignTeacher(sarah, sarahs);
        ctx.AssignTeacher(rafiq, rafiqs);
        ctx.Enroll(student, sarahs);
        ctx.Enroll(student, rafiqs);

        ctx.AddSubmission(ctx.AddAssignment(sarahs, sarah), student);
        ctx.AddSubmission(ctx.AddAssignment(rafiqs, rafiq), student);

        ctx.SignIn(sarah);

        var page = await Subject(ctx).ListAsync(new SubmissionListQuery());

        page.TotalCount.Should().Be(1);
    }

    // -----------------------------------------------------------------------

    private static (Domain.Entities.User Teacher, Domain.Entities.User Student, Domain.Entities.Submission Submission)
        Scenario(TestContext ctx, decimal maxMarks = 100m)
    {
        var teacher = ctx.AddUser(UserRole.Teacher);
        var student = ctx.AddUser(UserRole.Student);
        var offering = ctx.AddOffering();

        ctx.AssignTeacher(teacher, offering);
        ctx.Enroll(student, offering);

        var assignment = ctx.AddAssignment(offering, teacher, maxMarks: maxMarks);
        var submission = ctx.AddSubmission(assignment, student);

        return (teacher, student, submission);
    }
}
