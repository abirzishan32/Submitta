using AssignmentSystem.Application.Features.Notifications;
using AssignmentSystem.Domain.Enums;
using AssignmentSystem.UnitTests.Infrastructure;
using FluentAssertions;

namespace AssignmentSystem.UnitTests;

/// <summary>
/// Who gets told what.
///
/// The rules worth pinning are the ones that decide whether the bell is useful
/// or ignored: everyone who should hear does, nobody hears twice, and nobody
/// hears about something that is not theirs.
/// </summary>
public class NotificationTests
{
    private static NotificationService Subject(TestContext ctx) =>
        new(ctx.Db, ctx.CurrentUser, ctx.Clock, new NullStream(),
            TestContext.Logger<NotificationService>());

    private static NotificationAudience Audience(TestContext ctx) => new(ctx.Db);

    private static NotificationRequest Request(string? dedupeKey = null) =>
        new(NotificationType.AssignmentPublished, "New assignment", "Due soon",
            "/student/assignments/x", null, dedupeKey);

    // --- Fan-out -----------------------------------------------------------

    [Fact]
    public async Task Every_recipient_gets_their_own_copy()
    {
        // Fanned out at write time, because read state is per person.
        using var ctx = new TestContext();
        var a = ctx.AddUser(UserRole.Student, "A");
        var b = ctx.AddUser(UserRole.Student, "B");

        var sent = await Subject(ctx).NotifyAsync([a.Id, b.Id], Request());

        sent.Should().Be(2);
        ctx.Db.Notifications.Should().HaveCount(2);
    }

    [Fact]
    public async Task A_recipient_listed_twice_is_told_once()
    {
        // A teacher can be reached through two offerings in the same class.
        using var ctx = new TestContext();
        var teacher = ctx.AddUser(UserRole.Teacher);

        var sent = await Subject(ctx).NotifyAsync([teacher.Id, teacher.Id], Request());

        sent.Should().Be(1);
    }

    [Fact]
    public async Task Notifying_nobody_does_nothing()
    {
        using var ctx = new TestContext();

        (await Subject(ctx).NotifyAsync([], Request())).Should().Be(0);
        ctx.Db.Notifications.Should().BeEmpty();
    }

    // --- Dedupe ------------------------------------------------------------

    [Fact]
    public async Task The_same_keyed_notification_is_not_sent_twice()
    {
        // The deadline sweep runs every ten minutes; without this a student
        // would be reminded about the same assignment on every pass.
        using var ctx = new TestContext();
        var student = ctx.AddUser(UserRole.Student);
        var service = Subject(ctx);

        await service.NotifyAsync([student.Id], Request("deadline:24h:abc"));
        var second = await service.NotifyAsync([student.Id], Request("deadline:24h:abc"));

        second.Should().Be(0);
        ctx.Db.Notifications.Should().HaveCount(1);
    }

    [Fact]
    public async Task A_repeat_still_reaches_someone_who_has_not_had_it()
    {
        // A student enrolled after the first sweep must still be reminded.
        using var ctx = new TestContext();
        var first = ctx.AddUser(UserRole.Student, "First");
        var late = ctx.AddUser(UserRole.Student, "Late");
        var service = Subject(ctx);

        await service.NotifyAsync([first.Id], Request("deadline:24h:abc"));
        var second = await service.NotifyAsync([first.Id, late.Id], Request("deadline:24h:abc"));

        second.Should().Be(1);
        ctx.Db.Notifications.Should().HaveCount(2);
    }

    [Fact]
    public async Task Unkeyed_notifications_repeat_freely()
    {
        // Re-marking is news each time it happens.
        using var ctx = new TestContext();
        var student = ctx.AddUser(UserRole.Student);
        var service = Subject(ctx);

        await service.NotifyAsync([student.Id], Request());
        await service.NotifyAsync([student.Id], Request());

        ctx.Db.Notifications.Should().HaveCount(2);
    }

    // --- Reading -----------------------------------------------------------

    [Fact]
    public async Task The_list_and_the_count_only_show_the_callers_own()
    {
        using var ctx = new TestContext();
        var mine = ctx.AddUser(UserRole.Student, "Mine");
        var theirs = ctx.AddUser(UserRole.Student, "Theirs");
        var service = Subject(ctx);

        await service.NotifyAsync([mine.Id], Request());
        await service.NotifyAsync([theirs.Id], Request());

        ctx.SignIn(mine);
        var list = await service.ListAsync();

        list.Items.Should().HaveCount(1);
        list.UnreadCount.Should().Be(1);
    }

    [Fact]
    public async Task Marking_read_drops_the_count()
    {
        using var ctx = new TestContext();
        var student = ctx.AddUser(UserRole.Student);
        var service = Subject(ctx);

        await service.NotifyAsync([student.Id], Request());
        ctx.SignIn(student);

        var id = (await service.ListAsync()).Items[0].Id;
        await service.MarkReadAsync(id);

        (await service.UnreadCountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task Someone_elses_notification_cannot_be_marked_read()
    {
        using var ctx = new TestContext();
        var owner = ctx.AddUser(UserRole.Student, "Owner");
        var intruder = ctx.AddUser(UserRole.Student, "Intruder");
        var service = Subject(ctx);

        await service.NotifyAsync([owner.Id], Request());
        var id = ctx.Db.Notifications.Single().Id;

        ctx.SignIn(intruder);
        await service.MarkReadAsync(id);

        ctx.Db.Notifications.Single().IsRead.Should().BeFalse();
    }

    [Fact]
    public async Task Mark_all_read_clears_only_the_callers_own()
    {
        using var ctx = new TestContext();
        var mine = ctx.AddUser(UserRole.Student, "Mine");
        var theirs = ctx.AddUser(UserRole.Student, "Theirs");
        var service = Subject(ctx);

        await service.NotifyAsync([mine.Id, theirs.Id], Request());
        ctx.SignIn(mine);

        (await service.MarkAllReadAsync()).Should().Be(1);
        ctx.Db.Notifications.Count(n => n.UserId == theirs.Id && !n.IsRead).Should().Be(1);
    }

    [Fact]
    public async Task The_list_is_newest_first()
    {
        using var ctx = new TestContext();
        var student = ctx.AddUser(UserRole.Student);
        var service = Subject(ctx);

        await service.NotifyAsync([student.Id], Request() with { Title = "Older" });
        ctx.Clock.Advance(TimeSpan.FromMinutes(5));
        await service.NotifyAsync([student.Id], Request() with { Title = "Newer" });

        ctx.SignIn(student);
        var list = await service.ListAsync();

        list.Items[0].Title.Should().Be("Newer");
    }

    // --- Audience ----------------------------------------------------------

    [Fact]
    public async Task Only_students_of_that_class_are_in_the_audience()
    {
        using var ctx = new TestContext();
        var teacher = ctx.AddUser(UserRole.Teacher);

        var thisClass = ctx.AddOffering("G10-A", "MATH");
        var otherClass = ctx.AddOffering("G11-B", "PHYS");

        var enrolled = ctx.AddUser(UserRole.Student, "Enrolled");
        var elsewhere = ctx.AddUser(UserRole.Student, "Elsewhere");

        ctx.Enroll(enrolled, thisClass);
        ctx.Enroll(elsewhere, otherClass);

        var assignment = ctx.AddAssignment(thisClass, teacher);

        var audience = await Audience(ctx).StudentsForAssignmentAsync(assignment.Id);

        audience.Should().ContainSingle().Which.Should().Be(enrolled.Id);
    }

    [Fact]
    public async Task A_deactivated_student_is_not_in_the_audience()
    {
        // They cannot sign in to read it, so the row would only ever be noise.
        using var ctx = new TestContext();
        var teacher = ctx.AddUser(UserRole.Teacher);
        var offering = ctx.AddOffering();

        var active = ctx.AddUser(UserRole.Student, "Active");
        var disabled = ctx.AddUser(UserRole.Student, "Disabled", isActive: false);

        ctx.Enroll(active, offering);
        ctx.Enroll(disabled, offering);

        var assignment = ctx.AddAssignment(offering, teacher);

        (await Audience(ctx).StudentsForAssignmentAsync(assignment.Id))
            .Should().ContainSingle().Which.Should().Be(active.Id);
    }

    [Fact]
    public async Task Only_teachers_of_that_offering_are_in_the_audience()
    {
        using var ctx = new TestContext();
        var mine = ctx.AddUser(UserRole.Teacher, "Mine");
        var other = ctx.AddUser(UserRole.Teacher, "Other");

        var offering = ctx.AddOffering("G10-A", "MATH");
        var elsewhere = ctx.AddOffering("G11-B", "PHYS");

        ctx.AssignTeacher(mine, offering);
        ctx.AssignTeacher(other, elsewhere);

        var assignment = ctx.AddAssignment(offering, mine);

        (await Audience(ctx).TeachersForAssignmentAsync(assignment.Id))
            .Should().ContainSingle().Which.Should().Be(mine.Id);
    }

    [Fact]
    public async Task Only_active_administrators_are_in_the_audience()
    {
        using var ctx = new TestContext();
        var active = ctx.AddUser(UserRole.Admin, "Active");
        ctx.AddUser(UserRole.Admin, "Retired", isActive: false);
        ctx.AddUser(UserRole.Teacher, "Teacher");

        (await Audience(ctx).AdminsAsync())
            .Should().ContainSingle().Which.Should().Be(active.Id);
    }

    /// <summary>A stream that goes nowhere; delivery is tested separately.</summary>
    private sealed class NullStream : INotificationStream
    {
        public ValueTask PublishAsync(
            IReadOnlyCollection<Guid> userIds,
            Func<Guid, NotificationEvent> forUser,
            CancellationToken ct = default) => ValueTask.CompletedTask;

        public async IAsyncEnumerable<NotificationEvent> SubscribeAsync(
            Guid userId,
            [System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken ct)
        {
            await Task.CompletedTask;
            yield break;
        }
    }
}
