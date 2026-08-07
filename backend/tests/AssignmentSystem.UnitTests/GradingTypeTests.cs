using AssignmentSystem.Application.Common.Security;
using AssignmentSystem.Application.Features.Teacher.Assignments;
using AssignmentSystem.Application.Features.Teacher.Grading;
using AssignmentSystem.Domain.Entities;
using AssignmentSystem.Domain.Enums;
using AssignmentSystem.Domain.Exceptions;
using AssignmentSystem.UnitTests.Infrastructure;
using FluentAssertions;

namespace AssignmentSystem.UnitTests;

/// <summary>
/// How an assignment is marked.
///
/// The rules worth pinning are the ones that keep a mark meaning what it says:
/// a percentage out of 100, a pass worth one mark, a rubric totalling its own
/// criteria, and none of it changeable once students have been marked.
/// </summary>
public class GradingTypeTests
{
    private static AssignmentService Assignments(TestContext ctx) =>
        new(ctx.Db,
            new AccessControl(ctx.Db, ctx.CurrentUser),
            ctx.CurrentUser,
            ctx.Clock,
            ctx.Notifications,
            TestContext.Logger<AssignmentService>());

    private static GradingService Grading(TestContext ctx) =>
        new(ctx.Db,
            new AccessControl(ctx.Db, ctx.CurrentUser),
            ctx.CurrentUser,
            ctx.Clock,
            ctx.Notifications,
            TestContext.Logger<GradingService>());

    /// <summary>A teacher signed in, with an offering they may set work for.</summary>
    private static (User Teacher, ClassSubject Offering) Teaching(TestContext ctx)
    {
        var teacher = ctx.AddUser(UserRole.Teacher);
        var offering = ctx.AddOffering();
        ctx.AssignTeacher(teacher, offering);
        ctx.SignIn(teacher);
        return (teacher, offering);
    }

    private static CreateAssignmentRequest Request(
        Guid offeringId,
        TestContext ctx,
        GradingType type = GradingType.Points,
        decimal maxMarks = 50m,
        IReadOnlyList<RubricCriterionInput>? rubric = null) =>
        new("Essay", "Write an essay.", offeringId, ctx.Clock.UtcNow.AddDays(7),
            maxMarks, true, false, false, null, type, rubric);

    // --- The total each type implies ---------------------------------------

    [Fact]
    public async Task Points_keeps_the_total_the_teacher_chose()
    {
        using var ctx = new TestContext();
        var (_, offering) = Teaching(ctx);

        var created = await Assignments(ctx).CreateAsync(
            Request(offering.Id, ctx, GradingType.Points, maxMarks: 37m));

        created.MaxMarks.Should().Be(37m);
    }

    [Fact]
    public async Task Percentage_is_always_out_of_100()
    {
        // A percentage out of 50 is not a percentage. The requested total is
        // overridden rather than trusted.
        using var ctx = new TestContext();
        var (_, offering) = Teaching(ctx);

        var created = await Assignments(ctx).CreateAsync(
            Request(offering.Id, ctx, GradingType.Percentage, maxMarks: 50m));

        created.MaxMarks.Should().Be(100m);
    }

    [Fact]
    public async Task Pass_fail_is_one_mark_out_of_one()
    {
        // So it still averages alongside everything else the student has done.
        using var ctx = new TestContext();
        var (_, offering) = Teaching(ctx);

        var created = await Assignments(ctx).CreateAsync(
            Request(offering.Id, ctx, GradingType.PassFail, maxMarks: 50m));

        created.MaxMarks.Should().Be(1m);
    }

    [Fact]
    public async Task A_rubric_totals_its_own_criteria()
    {
        using var ctx = new TestContext();
        var (_, offering) = Teaching(ctx);

        var created = await Assignments(ctx).CreateAsync(Request(
            offering.Id, ctx, GradingType.Rubric, maxMarks: 999m,
            rubric:
            [
                new(null, "Argument", "Is the case made?", 20m),
                new(null, "Evidence", null, 15m),
                new(null, "Writing", null, 5m),
            ]));

        // Not the 999 that was asked for.
        created.MaxMarks.Should().Be(40m);
        created.Rubric.Should().HaveCount(3);
        created.Rubric[0].Title.Should().Be("Argument");
        created.Rubric[0].Order.Should().Be(0);
    }

    // --- Rubric integrity ---------------------------------------------------

    [Fact]
    public async Task A_rubric_assignment_needs_at_least_one_criterion()
    {
        using var ctx = new TestContext();
        var (_, offering) = Teaching(ctx);

        var act = () => Assignments(ctx).CreateAsync(
            Request(offering.Id, ctx, GradingType.Rubric, rubric: []));

        await act.Should().ThrowAsync<BusinessRuleException>();
    }

    [Fact]
    public async Task Two_criteria_cannot_share_a_name()
    {
        // "Which one did I lose marks on?" has to have an answer.
        using var ctx = new TestContext();
        var (_, offering) = Teaching(ctx);

        var act = () => Assignments(ctx).CreateAsync(Request(
            offering.Id, ctx, GradingType.Rubric,
            rubric: [new(null, "Evidence", null, 10m), new(null, "evidence", null, 5m)]));

        await act.Should().ThrowAsync<BusinessRuleException>();
    }

    [Fact]
    public async Task A_rubric_sent_with_another_type_is_discarded()
    {
        // Otherwise criteria nothing scores against would sit in the database,
        // ready to start applying if the type were ever changed.
        using var ctx = new TestContext();
        var (_, offering) = Teaching(ctx);

        var created = await Assignments(ctx).CreateAsync(Request(
            offering.Id, ctx, GradingType.Points, maxMarks: 20m,
            rubric: [new(null, "Ignored", null, 10m)]));

        created.Rubric.Should().BeEmpty();
        created.MaxMarks.Should().Be(20m);
        ctx.Db.RubricCriteria.Should().BeEmpty();
    }

    // --- Marking ------------------------------------------------------------

    [Fact]
    public async Task A_rubric_mark_is_the_sum_of_its_criteria()
    {
        using var ctx = new TestContext();
        var (teacher, offering) = Teaching(ctx);

        var created = await Assignments(ctx).CreateAsync(Request(
            offering.Id, ctx, GradingType.Rubric,
            rubric: [new(null, "Argument", null, 20m), new(null, "Evidence", null, 10m)]));

        var student = ctx.AddUser(UserRole.Student);
        ctx.Enroll(student, offering);

        var assignment = ctx.Db.Assignments.Single(a => a.Id == created.Id);
        var submission = ctx.AddSubmission(assignment, student);

        var criteria = ctx.Db.RubricCriteria.OrderBy(c => c.Order).ToList();

        ctx.SignIn(teacher);
        var graded = await Grading(ctx).GradeAsync(submission.Id, new GradeSubmissionRequest(
            // Deliberately wrong: for a rubric this figure is ignored.
            Marks: 999m,
            Feedback: null,
            CriterionScores:
            [
                new(criteria[0].Id, 18m, "Well argued"),
                new(criteria[1].Id, 7m, null),
            ]));

        graded.Marks.Should().Be(25m);
        graded.Rubric.Should().HaveCount(2);
        graded.Rubric[0].Points.Should().Be(18m);
        graded.Rubric[0].Comment.Should().Be("Well argued");
    }

    [Fact]
    public async Task Every_criterion_must_be_scored()
    {
        // A partial rubric produces a total that looks like a mark but silently
        // omits whatever was skipped.
        using var ctx = new TestContext();
        var (teacher, offering) = Teaching(ctx);

        var created = await Assignments(ctx).CreateAsync(Request(
            offering.Id, ctx, GradingType.Rubric,
            rubric: [new(null, "Argument", null, 20m), new(null, "Evidence", null, 10m)]));

        var student = ctx.AddUser(UserRole.Student);
        ctx.Enroll(student, offering);
        var assignment = ctx.Db.Assignments.Single(a => a.Id == created.Id);
        var submission = ctx.AddSubmission(assignment, student);

        var first = ctx.Db.RubricCriteria.OrderBy(c => c.Order).First();

        ctx.SignIn(teacher);
        var act = () => Grading(ctx).GradeAsync(submission.Id, new GradeSubmissionRequest(
            0m, null, [new(first.Id, 10m, null)]));

        var thrown = await act.Should().ThrowAsync<BusinessRuleException>();
        thrown.Which.Message.Should().Contain("Evidence");
    }

    [Fact]
    public async Task A_criterion_cannot_be_scored_above_its_own_maximum()
    {
        using var ctx = new TestContext();
        var (teacher, offering) = Teaching(ctx);

        var created = await Assignments(ctx).CreateAsync(Request(
            offering.Id, ctx, GradingType.Rubric,
            rubric: [new(null, "Argument", null, 10m)]));

        var student = ctx.AddUser(UserRole.Student);
        ctx.Enroll(student, offering);
        var assignment = ctx.Db.Assignments.Single(a => a.Id == created.Id);
        var submission = ctx.AddSubmission(assignment, student);
        var criterion = ctx.Db.RubricCriteria.Single();

        ctx.SignIn(teacher);
        var act = () => Grading(ctx).GradeAsync(submission.Id, new GradeSubmissionRequest(
            0m, null, [new(criterion.Id, 11m, null)]));

        await act.Should().ThrowAsync<BusinessRuleException>();
    }

    [Fact]
    public async Task Re_marking_a_rubric_replaces_the_scores_rather_than_doubling_them()
    {
        using var ctx = new TestContext();
        var (teacher, offering) = Teaching(ctx);

        var created = await Assignments(ctx).CreateAsync(Request(
            offering.Id, ctx, GradingType.Rubric,
            rubric: [new(null, "Argument", null, 20m)]));

        var student = ctx.AddUser(UserRole.Student);
        ctx.Enroll(student, offering);
        var assignment = ctx.Db.Assignments.Single(a => a.Id == created.Id);
        var submission = ctx.AddSubmission(assignment, student);
        var criterion = ctx.Db.RubricCriteria.Single();

        ctx.SignIn(teacher);
        var grading = Grading(ctx);

        await grading.GradeAsync(submission.Id,
            new GradeSubmissionRequest(0m, null, [new(criterion.Id, 12m, null)]));

        var regraded = await grading.GradeAsync(submission.Id,
            new GradeSubmissionRequest(0m, null, [new(criterion.Id, 16m, "On reflection")]));

        regraded.Marks.Should().Be(16m);
        ctx.Db.SubmissionCriterionScores.Should().ContainSingle();
    }

    [Fact]
    public async Task Pass_fail_accepts_only_a_pass_or_a_fail()
    {
        using var ctx = new TestContext();
        var (teacher, offering) = Teaching(ctx);

        var created = await Assignments(ctx).CreateAsync(
            Request(offering.Id, ctx, GradingType.PassFail));

        var student = ctx.AddUser(UserRole.Student);
        ctx.Enroll(student, offering);
        var assignment = ctx.Db.Assignments.Single(a => a.Id == created.Id);
        var submission = ctx.AddSubmission(assignment, student);

        ctx.SignIn(teacher);
        var grading = Grading(ctx);

        (await grading.GradeAsync(submission.Id, new GradeSubmissionRequest(1m, null)))
            .Marks.Should().Be(1m);

        var act = () => grading.GradeAsync(submission.Id, new GradeSubmissionRequest(0.5m, null));

        await act.Should().ThrowAsync<BusinessRuleException>();
    }

    // --- Changing the scheme after the fact ---------------------------------

    [Fact]
    public async Task The_grading_method_cannot_change_once_work_has_been_submitted()
    {
        // Marks already awarded would stop meaning what they say.
        using var ctx = new TestContext();
        var (teacher, offering) = Teaching(ctx);

        var created = await Assignments(ctx).CreateAsync(
            Request(offering.Id, ctx, GradingType.Points, maxMarks: 20m));

        var student = ctx.AddUser(UserRole.Student);
        ctx.Enroll(student, offering);
        var assignment = ctx.Db.Assignments.Single(a => a.Id == created.Id);
        ctx.AddSubmission(assignment, student);

        ctx.SignIn(teacher);
        var act = () => Assignments(ctx).UpdateAsync(created.Id, new UpdateAssignmentRequest(
            "Essay", "Write an essay.", ctx.Clock.UtcNow.AddDays(7), 20m, true, false,
            null, GradingType.Percentage, null));

        await act.Should().ThrowAsync<BusinessRuleException>();
    }

    [Fact]
    public async Task A_criterion_already_marked_against_cannot_be_removed()
    {
        using var ctx = new TestContext();
        var (teacher, offering) = Teaching(ctx);

        var created = await Assignments(ctx).CreateAsync(Request(
            offering.Id, ctx, GradingType.Rubric,
            rubric: [new(null, "Argument", null, 20m), new(null, "Evidence", null, 10m)]));

        var student = ctx.AddUser(UserRole.Student);
        ctx.Enroll(student, offering);
        var assignment = ctx.Db.Assignments.Single(a => a.Id == created.Id);
        var submission = ctx.AddSubmission(assignment, student);
        var criteria = ctx.Db.RubricCriteria.OrderBy(c => c.Order).ToList();

        ctx.SignIn(teacher);
        await Grading(ctx).GradeAsync(submission.Id, new GradeSubmissionRequest(
            0m, null,
            [new(criteria[0].Id, 15m, null), new(criteria[1].Id, 8m, null)]));

        // Dropping "Evidence", which has already been scored 8.
        var act = () => Assignments(ctx).UpdateAsync(created.Id, new UpdateAssignmentRequest(
            "Essay", "Write an essay.", ctx.Clock.UtcNow.AddDays(7), 0m, true, false,
            null, GradingType.Rubric, [new(criteria[0].Id, "Argument", null, 20m)]));

        await act.Should().ThrowAsync<BusinessRuleException>();
    }

    [Fact]
    public async Task Editing_a_criterion_keeps_the_marks_already_given_against_it()
    {
        using var ctx = new TestContext();
        var (teacher, offering) = Teaching(ctx);

        var created = await Assignments(ctx).CreateAsync(Request(
            offering.Id, ctx, GradingType.Rubric,
            rubric: [new(null, "Argument", null, 20m)]));

        var student = ctx.AddUser(UserRole.Student);
        ctx.Enroll(student, offering);
        var assignment = ctx.Db.Assignments.Single(a => a.Id == created.Id);
        var submission = ctx.AddSubmission(assignment, student);
        var criterion = ctx.Db.RubricCriteria.Single();

        ctx.SignIn(teacher);
        await Grading(ctx).GradeAsync(submission.Id,
            new GradeSubmissionRequest(0m, null, [new(criterion.Id, 15m, null)]));

        // Renaming and re-weighting, keeping the same id.
        var updated = await Assignments(ctx).UpdateAsync(created.Id, new UpdateAssignmentRequest(
            "Essay", "Write an essay.", ctx.Clock.UtcNow.AddDays(7), 0m, true, false,
            null, GradingType.Rubric,
            [new(criterion.Id, "Argument and structure", "Reworded", 25m)]));

        updated.MaxMarks.Should().Be(25m);
        updated.Rubric.Should().ContainSingle()
            .Which.Title.Should().Be("Argument and structure");

        // The score survived, because the row was updated rather than replaced.
        ctx.Db.SubmissionCriterionScores.Single().Points.Should().Be(15m);
    }
}
