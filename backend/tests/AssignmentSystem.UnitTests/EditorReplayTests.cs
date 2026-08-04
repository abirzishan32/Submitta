using AssignmentSystem.Application.Common.Security;
using AssignmentSystem.Application.Features.Editor;
using AssignmentSystem.Domain.Entities;
using AssignmentSystem.Domain.Enums;
using AssignmentSystem.Domain.Exceptions;
using AssignmentSystem.UnitTests.Infrastructure;
using FluentAssertions;

namespace AssignmentSystem.UnitTests;

/// <summary>
/// The editing log behind a submission.
///
/// Two things have to hold for the replay to be worth anything: the log must be
/// an accurate, append-only record of what the student did, and the statistics
/// derived from it must be reproducible from the log alone. Everything here
/// tests one of those two.
/// </summary>
public class EditorReplayTests
{
    private static EditorService Subject(TestContext ctx) =>
        new(ctx.Db,
            new AccessControl(ctx.Db, ctx.CurrentUser),
            ctx.CurrentUser,
            ctx.Clock,
            TestContext.Logger<EditorService>());

    /// <summary>A student with a live submission they may still edit.</summary>
    private static (User Student, Submission Submission) Writing(
        TestContext ctx, bool allowResubmission = true)
    {
        var teacher = ctx.AddUser(UserRole.Teacher);
        var student = ctx.AddUser(UserRole.Student);
        var offering = ctx.AddOffering();

        ctx.AssignTeacher(teacher, offering);
        ctx.Enroll(student, offering);

        var assignment = ctx.AddAssignment(
            offering, teacher, allowResubmission: allowResubmission);
        var submission = ctx.AddSubmission(assignment, student);

        ctx.SignIn(student);
        return (student, submission);
    }

    private static EventInput Event(
        long sequence,
        SubmissionEventType type,
        long offsetMs,
        Guid session,
        int added = 0,
        int removed = 0,
        int pastedWords = 0,
        string? payload = null) =>
        new(sequence, type, offsetMs, session, null, null, null, payload,
            added, removed, pastedWords);

    private static RecordEventsRequest Batch(params EventInput[] events) =>
        new(events, null, null, false, null);

    // -----------------------------------------------------------------------
    // Recording
    // -----------------------------------------------------------------------

    [Fact]
    public async Task Records_a_batch_and_reports_the_new_high_water_mark()
    {
        using var ctx = new TestContext();
        var (_, submission) = Writing(ctx);
        var session = Guid.NewGuid();

        var result = await Subject(ctx).RecordAsync(submission.Id, Batch(
            Event(1, SubmissionEventType.DocumentOpen, 0, session),
            Event(2, SubmissionEventType.Insert, 900, session, added: 12),
            Event(3, SubmissionEventType.Insert, 1800, session, added: 8)));

        result.Accepted.Should().Be(3);
        result.Skipped.Should().Be(0);
        result.LastSequence.Should().Be(3);
    }

    [Fact]
    public async Task Skips_events_already_recorded_so_a_retried_batch_does_not_double_the_log()
    {
        using var ctx = new TestContext();
        var (_, submission) = Writing(ctx);
        var session = Guid.NewGuid();
        var service = Subject(ctx);

        var batch = Batch(
            Event(1, SubmissionEventType.Insert, 100, session, added: 5),
            Event(2, SubmissionEventType.Insert, 200, session, added: 5));

        await service.RecordAsync(submission.Id, batch);

        // The same batch again, as a flaky connection would resend it.
        var replayed = await service.RecordAsync(submission.Id, batch);

        replayed.Accepted.Should().Be(0);
        replayed.Skipped.Should().Be(2);
        ctx.Db.SubmissionEvents.Count(e => e.SubmissionId == submission.Id).Should().Be(2);
    }

    [Fact]
    public async Task Refuses_to_record_against_another_students_submission()
    {
        using var ctx = new TestContext();
        var (_, submission) = Writing(ctx);

        var intruder = ctx.AddUser(UserRole.Student, "Someone Else");
        ctx.SignIn(intruder);

        var act = () => Subject(ctx).RecordAsync(
            submission.Id,
            Batch(Event(1, SubmissionEventType.Insert, 0, Guid.NewGuid(), added: 3)));

        // Reported as missing rather than forbidden, so the response does not
        // confirm that another student's submission exists.
        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task Refuses_to_record_once_the_submission_is_graded()
    {
        using var ctx = new TestContext();
        var (_, submission) = Writing(ctx);

        submission.Status = SubmissionStatus.Graded;
        ctx.Db.SaveChanges();

        var act = () => Subject(ctx).RecordAsync(
            submission.Id,
            Batch(Event(1, SubmissionEventType.Insert, 0, Guid.NewGuid(), added: 3)));

        await act.Should().ThrowAsync<BusinessRuleException>();
    }

    [Fact]
    public async Task Refuses_a_document_write_when_the_assignment_forbids_resubmission()
    {
        // The editor must not become a way around the rules the ordinary update
        // endpoint enforces.
        using var ctx = new TestContext();
        var (_, submission) = Writing(ctx, allowResubmission: false);

        var act = () => Subject(ctx).RecordAsync(submission.Id, new RecordEventsRequest(
            [Event(1, SubmissionEventType.Insert, 0, Guid.NewGuid(), added: 4)],
            ContentJson: "{\"type\":\"doc\"}",
            PlainText: "Rewritten",
            CreateVersion: false,
            VersionReason: null));

        await act.Should().ThrowAsync<BusinessRuleException>();
    }

    [Fact]
    public async Task Refuses_a_document_write_after_the_deadline()
    {
        using var ctx = new TestContext();
        var (_, submission) = Writing(ctx);

        ctx.Clock.Advance(TimeSpan.FromDays(30));

        var act = () => Subject(ctx).RecordAsync(submission.Id, new RecordEventsRequest(
            [], ContentJson: "{\"type\":\"doc\"}", PlainText: "Late edit",
            CreateVersion: false, VersionReason: null));

        await act.Should().ThrowAsync<BusinessRuleException>();
    }

    [Fact]
    public async Task Stores_the_document_alongside_its_events()
    {
        using var ctx = new TestContext();
        var (_, submission) = Writing(ctx);

        await Subject(ctx).RecordAsync(submission.Id, new RecordEventsRequest(
            [Event(1, SubmissionEventType.Insert, 500, Guid.NewGuid(), added: 9)],
            ContentJson: "{\"type\":\"doc\",\"content\":[]}",
            PlainText: "My answer",
            CreateVersion: true,
            VersionReason: "manual"));

        var stored = ctx.Db.Submissions.Single(s => s.Id == submission.Id);
        stored.ContentJson.Should().Be("{\"type\":\"doc\",\"content\":[]}");
        stored.Content.Should().Be("My answer");

        var version = ctx.Db.SubmissionVersions.Single(v => v.SubmissionId == submission.Id);
        version.VersionNumber.Should().Be(1);
        version.WordCount.Should().Be(2);
        version.Reason.Should().Be("manual");
    }

    // -----------------------------------------------------------------------
    // Resuming
    // -----------------------------------------------------------------------

    [Fact]
    public async Task Session_reports_where_the_log_left_off()
    {
        using var ctx = new TestContext();
        var (_, submission) = Writing(ctx);
        var session = Guid.NewGuid();
        var service = Subject(ctx);

        await service.RecordAsync(submission.Id, Batch(
            Event(1, SubmissionEventType.Insert, 1_000, session, added: 4),
            Event(2, SubmissionEventType.Insert, 7_500, session, added: 6)));

        var resume = await service.GetSessionAsync(submission.Id);

        // A reopened editor continues from here, so its sequences stay unique
        // and its timeline stays continuous.
        resume.LastSequence.Should().Be(2);
        resume.LastOffsetMs.Should().Be(7_500);
        resume.Editable.Should().BeTrue();
    }

    [Fact]
    public async Task Session_on_an_untouched_submission_starts_from_zero()
    {
        using var ctx = new TestContext();
        var (_, submission) = Writing(ctx);

        var resume = await Subject(ctx).GetSessionAsync(submission.Id);

        resume.LastSequence.Should().Be(0);
        resume.LastOffsetMs.Should().Be(0);
    }

    // -----------------------------------------------------------------------
    // Analytics
    // -----------------------------------------------------------------------

    [Fact]
    public async Task Analytics_on_an_empty_log_are_zero_rather_than_absent()
    {
        using var ctx = new TestContext();
        var (_, submission) = Writing(ctx);

        var analytics = await Subject(ctx).GetAnalyticsAsync(submission.Id);

        analytics.TotalDurationMs.Should().Be(0);
        analytics.WordsTyped.Should().Be(0);
        analytics.PastePercentage.Should().Be(0);
        analytics.LargePastes.Should().BeEmpty();
    }

    [Fact]
    public async Task Separates_typed_words_from_pasted_ones()
    {
        using var ctx = new TestContext();
        var (_, submission) = Writing(ctx);
        var session = Guid.NewGuid();
        var service = Subject(ctx);

        await service.RecordAsync(submission.Id, Batch(
            Event(1, SubmissionEventType.DocumentOpen, 0, session),
            // 250 characters typed — 50 words at the conventional five
            // characters per word.
            Event(2, SubmissionEventType.Insert, 60_000, session, added: 250),
            Event(3, SubmissionEventType.Paste, 61_000, session,
                added: 300, pastedWords: 50,
                payload: "{\"text\":\"A pasted paragraph\",\"words\":50}")));

        var analytics = await service.GetAnalyticsAsync(submission.Id);

        analytics.WordsTyped.Should().Be(50);
        analytics.WordsPasted.Should().Be(50);
        analytics.PastePercentage.Should().Be(50);
        analytics.PasteCount.Should().Be(1);
        analytics.LargestPasteWords.Should().Be(50);
    }

    [Fact]
    public async Task Surfaces_large_pastes_with_a_preview_and_ignores_small_ones()
    {
        using var ctx = new TestContext();
        var (_, submission) = Writing(ctx);
        var session = Guid.NewGuid();
        var service = Subject(ctx);

        await service.RecordAsync(submission.Id, Batch(
            // Below the threshold: quoting a line is not worth flagging.
            Event(1, SubmissionEventType.Paste, 1_000, session,
                added: 40, pastedWords: 8, payload: "{\"text\":\"a short quote\"}"),
            Event(2, SubmissionEventType.Paste, 2_000, session,
                added: 900, pastedWords: 160,
                payload: "{\"text\":\"The industrial revolution began\"}")));

        var analytics = await service.GetAnalyticsAsync(submission.Id);

        analytics.PasteCount.Should().Be(2);
        analytics.LargePastes.Should().ContainSingle()
            .Which.Words.Should().Be(160);
        analytics.LargePastes[0].Preview.Should().Be("The industrial revolution began");
    }

    [Fact]
    public async Task Reads_payloads_in_the_normalised_form_postgres_stores_them_in()
    {
        // The payload column is jsonb, so PostgreSQL returns its own normalised
        // rendering — keys reordered, separators respaced — not the JSON the
        // editor wrote. Anything that reads a payload has to parse it; matching
        // on a literal "key":"value" silently finds nothing.
        using var ctx = new TestContext();
        var (_, submission) = Writing(ctx);
        var session = Guid.NewGuid();
        var service = Subject(ctx);

        await service.RecordAsync(submission.Id, Batch(
            Event(1, SubmissionEventType.Paste, 1_000, session,
                added: 900, pastedWords: 120,
                payload: """{"words": 120, "html": false, "text": "Scheduling determines which process runs next."}"""),
            Event(2, SubmissionEventType.NodeInsert, 2_000, session,
                payload: """{"nodes": ["table"]}""")));

        var analytics = await service.GetAnalyticsAsync(submission.Id);

        analytics.LargePastes.Should().ContainSingle()
            .Which.Preview.Should().Be("Scheduling determines which process runs next.");
        analytics.TablesInserted.Should().Be(1);
    }

    [Fact]
    public async Task Truncates_a_long_paste_preview()
    {
        using var ctx = new TestContext();
        var (_, submission) = Writing(ctx);

        var longText = new string('x', 500);

        await Subject(ctx).RecordAsync(submission.Id, Batch(
            Event(1, SubmissionEventType.Paste, 0, Guid.NewGuid(),
                added: 500, pastedWords: 100,
                payload: $$"""{"text": "{{longText}}"}""")));

        var analytics = await Subject(ctx).GetAnalyticsAsync(submission.Id);

        // A hint at what arrived, not a second copy of it.
        analytics.LargePastes[0].Preview.Should().HaveLength(160);
    }

    [Fact]
    public async Task Counts_a_long_gap_as_a_pause_rather_than_writing_time()
    {
        using var ctx = new TestContext();
        var (_, submission) = Writing(ctx);
        var session = Guid.NewGuid();
        var service = Subject(ctx);

        await service.RecordAsync(submission.Id, Batch(
            Event(1, SubmissionEventType.Insert, 0, session, added: 50),
            // Ten minutes away from the document.
            Event(2, SubmissionEventType.Insert, 600_000, session, added: 50),
            Event(3, SubmissionEventType.Insert, 605_000, session, added: 50)));

        var analytics = await service.GetAnalyticsAsync(submission.Id);

        analytics.TotalDurationMs.Should().Be(605_000);
        analytics.IdleMs.Should().Be(600_000);
        analytics.ActiveWritingMs.Should().Be(5_000);
        analytics.LongestPauseMs.Should().Be(600_000);
    }

    [Fact]
    public async Task Counts_distinct_sittings_as_separate_sessions()
    {
        using var ctx = new TestContext();
        var (_, submission) = Writing(ctx);
        var monday = Guid.NewGuid();
        var tuesday = Guid.NewGuid();
        var service = Subject(ctx);

        await service.RecordAsync(submission.Id, Batch(
            Event(1, SubmissionEventType.DocumentOpen, 0, monday),
            Event(2, SubmissionEventType.Insert, 5_000, monday, added: 100),
            Event(3, SubmissionEventType.DocumentOpen, 90_000_000, tuesday),
            Event(4, SubmissionEventType.Insert, 90_005_000, tuesday, added: 100)));

        var analytics = await service.GetAnalyticsAsync(submission.Id);

        analytics.SessionCount.Should().Be(2);
    }

    [Fact]
    public async Task Counts_structural_insertions_by_kind()
    {
        using var ctx = new TestContext();
        var (_, submission) = Writing(ctx);
        var session = Guid.NewGuid();
        var service = Subject(ctx);

        await service.RecordAsync(submission.Id, Batch(
            Event(1, SubmissionEventType.NodeInsert, 100, session,
                payload: "{\"nodes\":[\"table\"]}"),
            Event(2, SubmissionEventType.NodeInsert, 200, session,
                payload: "{\"nodes\":[\"image\"]}"),
            Event(3, SubmissionEventType.NodeInsert, 300, session,
                payload: "{\"nodes\":[\"codeBlock\"]}")));

        var analytics = await service.GetAnalyticsAsync(submission.Id);

        analytics.TablesInserted.Should().Be(1);
        analytics.ImagesInserted.Should().Be(1);
        analytics.CodeBlocksInserted.Should().Be(1);
    }

    // -----------------------------------------------------------------------
    // Replay access
    // -----------------------------------------------------------------------

    [Fact]
    public async Task Teacher_of_the_offering_may_replay_the_submission()
    {
        using var ctx = new TestContext();
        var teacher = ctx.AddUser(UserRole.Teacher);
        var student = ctx.AddUser(UserRole.Student);
        var offering = ctx.AddOffering();

        ctx.AssignTeacher(teacher, offering);
        ctx.Enroll(student, offering);

        var assignment = ctx.AddAssignment(offering, teacher);
        var submission = ctx.AddSubmission(assignment, student);

        ctx.SignIn(student);
        await Subject(ctx).RecordAsync(submission.Id, Batch(
            Event(1, SubmissionEventType.Insert, 1_000, Guid.NewGuid(), added: 20)));

        ctx.SignIn(teacher);
        var replay = await Subject(ctx).GetReplayAsync(submission.Id);

        replay.EventCount.Should().Be(1);
        replay.TotalDurationMs.Should().Be(1_000);
        replay.StudentName.Should().Be(student.FullName);
    }

    [Fact]
    public async Task Another_students_replay_is_not_readable()
    {
        using var ctx = new TestContext();
        var (_, submission) = Writing(ctx);

        var classmate = ctx.AddUser(UserRole.Student, "Classmate");
        ctx.SignIn(classmate);

        var act = () => Subject(ctx).GetReplayAsync(submission.Id);

        await act.Should().ThrowAsync<ForbiddenException>();
    }

    // -----------------------------------------------------------------------
    // Versions
    // -----------------------------------------------------------------------

    [Fact]
    public async Task Restoring_a_version_adds_a_new_one_rather_than_erasing_history()
    {
        using var ctx = new TestContext();
        var (_, submission) = Writing(ctx);
        var service = Subject(ctx);

        await service.RecordAsync(submission.Id, new RecordEventsRequest(
            [], "{\"v\":1}", "First draft", CreateVersion: true, VersionReason: "manual"));

        await service.RecordAsync(submission.Id, new RecordEventsRequest(
            [], "{\"v\":2}", "Second draft", CreateVersion: true, VersionReason: "manual"));

        var restored = await service.RestoreVersionAsync(submission.Id, 1);

        restored.VersionNumber.Should().Be(3);
        restored.Reason.Should().Be("restore:1");

        var stored = ctx.Db.Submissions.Single(s => s.Id == submission.Id);
        stored.ContentJson.Should().Be("{\"v\":1}");
        stored.Content.Should().Be("First draft");

        // The version that was restored over is still there.
        ctx.Db.SubmissionVersions
            .Count(v => v.SubmissionId == submission.Id)
            .Should().Be(3);
    }
}
