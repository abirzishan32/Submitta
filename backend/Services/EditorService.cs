using System.Text.Json;
using AssignmentSystem.Application.Common.Interfaces;
using AssignmentSystem.Application.Common.Security;
using AssignmentSystem.Domain.Entities;
using AssignmentSystem.Domain.Enums;
using AssignmentSystem.Domain.Exceptions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace AssignmentSystem.Application.Features.Editor;

public interface IEditorService
{
    Task<EditorSessionDto> GetSessionAsync(Guid submissionId, CancellationToken ct = default);

    Task<RecordEventsResponse> RecordAsync(
        Guid submissionId, RecordEventsRequest request, CancellationToken ct = default);

    Task<ReplayDto> GetReplayAsync(Guid submissionId, CancellationToken ct = default);

    Task<WritingAnalyticsDto> GetAnalyticsAsync(Guid submissionId, CancellationToken ct = default);

    Task<IReadOnlyList<VersionDto>> ListVersionsAsync(Guid submissionId, CancellationToken ct = default);

    Task<VersionDetailDto> GetVersionAsync(Guid submissionId, int versionNumber, CancellationToken ct = default);

    Task<VersionDto> RestoreVersionAsync(Guid submissionId, int versionNumber, CancellationToken ct = default);
}

/// <summary>
/// Records the editing log for a submission, and reconstructs it for a teacher.
/// </summary>
public sealed class EditorService(
    IAppDbContext context,
    IAccessControl access,
    ICurrentUser currentUser,
    IDateTimeProvider dateTime,
    ILogger<EditorService> logger) : IEditorService
{
    /// <summary>A gap longer than this counts as a pause rather than thinking time.</summary>
    private const long IdleThresholdMs = 30_000;

    /// <summary>Pastes at or above this are surfaced to the teacher.</summary>
    private const int LargePasteWords = 40;

    /// <summary>How much of a pasted passage the teacher sees as a preview.</summary>
    private const int PreviewLength = 160;

    // -----------------------------------------------------------------------
    // Recording
    // -----------------------------------------------------------------------

    public async Task<EditorSessionDto> GetSessionAsync(
        Guid submissionId, CancellationToken ct = default)
    {
        var studentId = currentUser.RequireUserId();

        var submission = await context.Submissions
            .AsNoTracking()
            .Where(s => s.Id == submissionId && s.StudentId == studentId)
            .Select(s => new { s.Id, s.ContentJson, s.Content, s.Status })
            .FirstOrDefaultAsync(ct)
            ?? throw new NotFoundException("Submission", submissionId);

        // One query for both, so the two cannot be read from different states.
        var resume = await context.SubmissionEvents
            .AsNoTracking()
            .Where(e => e.SubmissionId == submissionId)
            .GroupBy(_ => 1)
            .Select(g => new { Sequence = g.Max(e => e.Sequence), Offset = g.Max(e => e.OffsetMs) })
            .FirstOrDefaultAsync(ct);

        return new EditorSessionDto(
            submission.Id,
            submission.ContentJson,
            submission.Content,
            resume?.Sequence ?? 0,
            resume?.Offset ?? 0,
            submission.Status != SubmissionStatus.Graded);
    }

    public async Task<RecordEventsResponse> RecordAsync(
        Guid submissionId, RecordEventsRequest request, CancellationToken ct = default)
    {
        var studentId = currentUser.RequireUserId();

        var submission = await context.Submissions
            .Include(s => s.Assignment)
            // Scoped to the author: a student may only write their own log,
            // and forging another's would make the replay worthless.
            .FirstOrDefaultAsync(s => s.Id == submissionId && s.StudentId == studentId, ct)
            ?? throw new NotFoundException("Submission", submissionId);

        if (submission.Status == SubmissionStatus.Graded)
        {
            throw new BusinessRuleException("This submission has been graded and can no longer be edited.");
        }

        var lastSequence = await context.SubmissionEvents
            .Where(e => e.SubmissionId == submissionId)
            .Select(e => (long?)e.Sequence)
            .MaxAsync(ct) ?? 0;

        var now = dateTime.UtcNow;
        var accepted = 0;
        var skipped = 0;

        foreach (var input in request.Events.OrderBy(e => e.Sequence))
        {
            // Batches are retried on a flaky connection, so the same events can
            // arrive twice. Sequence is unique per submission, so anything at or
            // below the high-water mark has already been stored.
            if (input.Sequence <= lastSequence)
            {
                skipped++;
                continue;
            }

            context.SubmissionEvents.Add(new SubmissionEvent
            {
                SubmissionId = submissionId,
                Sequence = input.Sequence,
                Type = input.Type,
                OffsetMs = Math.Max(0, input.OffsetMs),
                ReceivedAt = now,
                SessionId = input.SessionId,
                CursorFrom = input.CursorFrom,
                CursorTo = input.CursorTo,
                BlockId = Truncate(input.BlockId, 64),
                Payload = input.Payload,
                CharactersAdded = Math.Max(0, input.CharactersAdded),
                CharactersRemoved = Math.Max(0, input.CharactersRemoved),
                PastedWords = Math.Max(0, input.PastedWords),
            });

            lastSequence = input.Sequence;
            accepted++;
        }

        // The document travels with its events, so a save and the log that
        // produced it can never disagree.
        //
        // Changing the answer is governed by the same rules as the ordinary
        // update endpoint — this route must not become a way around them. The
        // log itself is still accepted: it is an audit record of work already
        // done, and refusing it would leave a hole in the replay.
        if (request.ContentJson is not null)
        {
            EnsureContentIsEditable(submission);

            submission.ContentJson = request.ContentJson;
            submission.Content = request.PlainText ?? submission.Content;
            submission.LastUpdatedAt = now;
        }

        int? versionNumber = null;

        if (request.CreateVersion && request.ContentJson is not null)
        {
            versionNumber = await CreateVersionAsync(
                submissionId,
                request.ContentJson,
                request.PlainText ?? string.Empty,
                lastSequence,
                request.VersionReason ?? "autosave",
                ct);
        }

        await context.SaveChangesAsync(ct);

        logger.LogDebug(
            "Recorded {Accepted} event(s) ({Skipped} duplicate) for submission {SubmissionId}.",
            accepted, skipped, submissionId);

        return new RecordEventsResponse(lastSequence, accepted, skipped, versionNumber);
    }

    /// <summary>
    /// Applies the submission's edit rules to a document write.
    ///
    /// Deliberately mirrors <c>StudentService.UpdateSubmissionAsync</c>: two
    /// endpoints that change the same field must agree, or the more permissive
    /// one silently becomes the real policy.
    /// </summary>
    private void EnsureContentIsEditable(Submission submission)
    {
        if (submission.Assignment.Deadline < dateTime.UtcNow)
        {
            throw new BusinessRuleException(
                "The deadline has passed, so this submission can no longer be edited.");
        }

        if (!submission.Assignment.AllowResubmission
            && submission.Status != SubmissionStatus.ReturnedForRevision)
        {
            throw new BusinessRuleException(
                "This assignment does not allow submissions to be changed once made.");
        }
    }

    private async Task<int> CreateVersionAsync(
        Guid submissionId, string contentJson, string plainText,
        long atSequence, string reason, CancellationToken ct)
    {
        var latest = await context.SubmissionVersions
            .Where(v => v.SubmissionId == submissionId)
            .Select(v => (int?)v.VersionNumber)
            .MaxAsync(ct) ?? 0;

        var next = latest + 1;

        context.SubmissionVersions.Add(new SubmissionVersion
        {
            SubmissionId = submissionId,
            VersionNumber = next,
            ContentJson = contentJson,
            PlainText = plainText,
            WordCount = CountWords(plainText),
            AtSequence = atSequence,
            Reason = reason,
        });

        return next;
    }

    // -----------------------------------------------------------------------
    // Replay
    // -----------------------------------------------------------------------

    public async Task<ReplayDto> GetReplayAsync(Guid submissionId, CancellationToken ct = default)
    {
        // The teacher of the offering, or the student who wrote it.
        await access.EnsureCanViewSubmissionAsync(submissionId, ct);

        var submission = await context.Submissions
            .AsNoTracking()
            .Where(s => s.Id == submissionId)
            .Select(s => new
            {
                s.Id,
                s.ContentJson,
                StudentName = s.Student.FullName,
                AssignmentTitle = s.Assignment.Title,
            })
            .FirstOrDefaultAsync(ct)
            ?? throw new NotFoundException("Submission", submissionId);

        // Loaded once and shared, so the timeline the teacher scrubs and the
        // figures printed beside it are computed from the same events.
        var raw = await LoadRawAsync(submissionId, ct);

        var events = raw
            .Select(e => new ReplayEventDto(
                e.Sequence, e.Type, e.OffsetMs, e.BlockId,
                e.CursorFrom, e.CursorTo, e.Payload,
                e.CharactersAdded, e.CharactersRemoved, e.PastedWords))
            .ToList();

        var analytics = Analyse(raw);

        return new ReplayDto(
            submission.Id,
            submission.StudentName,
            submission.AssignmentTitle,
            submission.ContentJson,
            events.Count > 0 ? events[^1].OffsetMs : 0,
            events.Count,
            events,
            analytics);
    }

    public async Task<WritingAnalyticsDto> GetAnalyticsAsync(
        Guid submissionId, CancellationToken ct = default)
    {
        await access.EnsureCanViewSubmissionAsync(submissionId, ct);
        return Analyse(await LoadRawAsync(submissionId, ct));
    }

    private async Task<List<RawEvent>> LoadRawAsync(Guid submissionId, CancellationToken ct)
    {
        var events = await context.SubmissionEvents
            .AsNoTracking()
            .Where(e => e.SubmissionId == submissionId)
            .OrderBy(e => e.Sequence)
            .Select(e => new RawEvent(
                e.Sequence, e.Type, e.OffsetMs, e.ReceivedAt, e.SessionId,
                e.CharactersAdded, e.CharactersRemoved, e.PastedWords, e.Payload,
                e.BlockId, e.CursorFrom, e.CursorTo))
            .ToListAsync(ct);

        return events;
    }

    private sealed record RawEvent(
        long Sequence, SubmissionEventType Type, long OffsetMs, DateTimeOffset ReceivedAt,
        Guid SessionId, int CharactersAdded, int CharactersRemoved, int PastedWords,
        string? Payload, string? BlockId, int? CursorFrom, int? CursorTo);

    /// <summary>
    /// Derives the statistics a teacher sees from the raw log.
    ///
    /// Kept as a pure function over the events so it can be tested directly,
    /// without a database or an editor.
    /// </summary>
    private static WritingAnalyticsDto Analyse(List<RawEvent> events)
    {
        if (events.Count == 0)
        {
            return new WritingAnalyticsDto(
                0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
                null, null, []);
        }

        var total = events[^1].OffsetMs;

        var charactersTyped = events
            .Where(e => e.Type == SubmissionEventType.Insert)
            .Sum(e => e.CharactersAdded);

        var charactersDeleted = events.Sum(e => e.CharactersRemoved);
        var wordsPasted = events.Sum(e => e.PastedWords);

        // Approximating a word as five characters is the standard convention for
        // typing speed, and avoids re-tokenising every insert payload.
        var wordsTyped = charactersTyped / 5;

        var pastes = events.Where(e => e.Type == SubmissionEventType.Paste).ToList();

        // Gaps between consecutive events. Anything over the threshold is a
        // pause rather than writing time.
        var gaps = new List<long>();
        for (var i = 1; i < events.Count; i++)
        {
            gaps.Add(Math.Max(0, events[i].OffsetMs - events[i - 1].OffsetMs));
        }

        var idle = gaps.Where(g => g > IdleThresholdMs).Sum();
        var active = Math.Max(0, total - idle);
        var pauses = gaps.Where(g => g > 1_000).ToList();

        var typingSpeed = active > 0
            ? Math.Round(wordsTyped / (active / 60_000.0), 1)
            : 0;

        var totalWords = wordsTyped + wordsPasted;
        var pastePercentage = totalWords > 0
            ? Math.Round(wordsPasted * 100.0 / totalWords, 1)
            : 0;

        var largePastes = pastes
            .Where(p => p.PastedWords >= LargePasteWords)
            .OrderByDescending(p => p.PastedWords)
            .Take(20)
            .Select(p => new PasteIncidentDto(
                p.Sequence, p.OffsetMs, p.PastedWords, p.CharactersAdded,
                ExtractPreview(p.Payload)))
            .ToList();

        return new WritingAnalyticsDto(
            TotalDurationMs: total,
            ActiveWritingMs: active,
            IdleMs: idle,
            WordsTyped: wordsTyped,
            WordsPasted: wordsPasted,
            PastePercentage: pastePercentage,
            TypingSpeedWpm: typingSpeed,
            CharactersTyped: charactersTyped,
            CharactersDeleted: charactersDeleted,
            DeleteCount: events.Count(e => e.Type == SubmissionEventType.Delete),
            UndoCount: events.Count(e => e.Type == SubmissionEventType.Undo),
            RedoCount: events.Count(e => e.Type == SubmissionEventType.Redo),
            PasteCount: pastes.Count,
            LargestPasteWords: pastes.Count > 0 ? pastes.Max(p => p.PastedWords) : 0,
            ImagesInserted: CountNode(events, "image"),
            TablesInserted: CountNode(events, "table"),
            CodeBlocksInserted: CountNode(events, "codeBlock"),
            EquationsInserted: CountNode(events, "math"),
            AveragePauseMs: pauses.Count > 0 ? (long)pauses.Average() : 0,
            LongestPauseMs: pauses.Count > 0 ? pauses.Max() : 0,
            SessionCount: events.Select(e => e.SessionId).Distinct().Count(),
            FocusLostCount: events.Count(e => e.Type == SubmissionEventType.FocusLost),
            FirstEditAt: events[0].ReceivedAt,
            LastEditAt: events[^1].ReceivedAt,
            LargePastes: largePastes);
    }

    /// <summary>
    /// Counts node insertions of a given kind.
    ///
    /// Parsed rather than string-matched, for the same reason as
    /// <see cref="ExtractPreview"/>: the payload comes back in PostgreSQL's
    /// normalised <c>jsonb</c> form, not as the editor wrote it.
    /// </summary>
    private static int CountNode(List<RawEvent> events, string nodeType) =>
        events.Count(e =>
            e.Type == SubmissionEventType.NodeInsert && NodesIn(e.Payload).Contains(nodeType));

    private static IReadOnlyCollection<string> NodesIn(string? payload)
    {
        if (string.IsNullOrWhiteSpace(payload)) return [];

        try
        {
            using var document = JsonDocument.Parse(payload);

            if (!document.RootElement.TryGetProperty("nodes", out var nodes)
                || nodes.ValueKind != JsonValueKind.Array)
            {
                return [];
            }

            return nodes.EnumerateArray()
                .Where(n => n.ValueKind == JsonValueKind.String)
                .Select(n => n.GetString()!)
                .ToHashSet(StringComparer.OrdinalIgnoreCase);
        }
        catch (JsonException)
        {
            return [];
        }
    }

    /// <summary>
    /// A short excerpt of pasted text, so the teacher sees what arrived without
    /// the whole block. Capped hard — this is a hint, not the content.
    /// </summary>
    /// <remarks>
    /// Parsed rather than string-matched. The column is <c>jsonb</c>, which
    /// PostgreSQL stores in its own normalised form: keys are reordered and
    /// separators respaced, so the text the editor wrote is not the text that
    /// comes back, and a substring search for a literal key silently returns
    /// nothing.
    /// </remarks>
    private static string? ExtractPreview(string? payload)
    {
        if (string.IsNullOrWhiteSpace(payload)) return null;

        try
        {
            using var document = JsonDocument.Parse(payload);

            if (!document.RootElement.TryGetProperty("text", out var element)
                || element.ValueKind != JsonValueKind.String)
            {
                return null;
            }

            var text = element.GetString();
            if (string.IsNullOrWhiteSpace(text)) return null;

            return text.Length <= PreviewLength ? text : text[..PreviewLength];
        }
        catch (JsonException)
        {
            // A payload we cannot read is not worth failing the whole request
            // for — the teacher simply sees no preview for that paste.
            return null;
        }
    }

    // -----------------------------------------------------------------------
    // Versions
    // -----------------------------------------------------------------------

    public async Task<IReadOnlyList<VersionDto>> ListVersionsAsync(
        Guid submissionId, CancellationToken ct = default)
    {
        await access.EnsureCanViewSubmissionAsync(submissionId, ct);

        return await context.SubmissionVersions
            .AsNoTracking()
            .Where(v => v.SubmissionId == submissionId)
            .OrderByDescending(v => v.VersionNumber)
            .Select(v => new VersionDto(
                v.Id, v.VersionNumber, v.WordCount, v.Reason, v.AtSequence, v.CreatedAt))
            .ToListAsync(ct);
    }

    public async Task<VersionDetailDto> GetVersionAsync(
        Guid submissionId, int versionNumber, CancellationToken ct = default)
    {
        await access.EnsureCanViewSubmissionAsync(submissionId, ct);

        return await context.SubmissionVersions
            .AsNoTracking()
            .Where(v => v.SubmissionId == submissionId && v.VersionNumber == versionNumber)
            .Select(v => new VersionDetailDto(
                v.Id, v.VersionNumber, v.ContentJson, v.PlainText,
                v.WordCount, v.Reason, v.CreatedAt))
            .FirstOrDefaultAsync(ct)
            ?? throw new NotFoundException("Version", versionNumber);
    }

    public async Task<VersionDto> RestoreVersionAsync(
        Guid submissionId, int versionNumber, CancellationToken ct = default)
    {
        var studentId = currentUser.RequireUserId();

        var submission = await context.Submissions
            .Include(s => s.Assignment)
            .FirstOrDefaultAsync(s => s.Id == submissionId && s.StudentId == studentId, ct)
            ?? throw new NotFoundException("Submission", submissionId);

        if (submission.Status == SubmissionStatus.Graded)
        {
            throw new BusinessRuleException("This submission has been graded and can no longer be edited.");
        }

        // Restoring replaces the answer, so it is subject to the same rules as
        // any other edit.
        EnsureContentIsEditable(submission);

        var version = await context.SubmissionVersions
            .AsNoTracking()
            .FirstOrDefaultAsync(v => v.SubmissionId == submissionId && v.VersionNumber == versionNumber, ct)
            ?? throw new NotFoundException("Version", versionNumber);

        submission.ContentJson = version.ContentJson;
        submission.Content = version.PlainText;
        submission.LastUpdatedAt = dateTime.UtcNow;

        // Restoring is itself a revision: snapshot the result rather than
        // rewriting history, so the trail shows that a restore happened.
        var lastSequence = await context.SubmissionEvents
            .Where(e => e.SubmissionId == submissionId)
            .Select(e => (long?)e.Sequence)
            .MaxAsync(ct) ?? 0;

        var newNumber = await CreateVersionAsync(
            submissionId, version.ContentJson, version.PlainText,
            lastSequence, $"restore:{versionNumber}", ct);

        await context.SaveChangesAsync(ct);

        logger.LogInformation(
            "Student {StudentId} restored submission {SubmissionId} to version {Version}.",
            studentId, submissionId, versionNumber);

        return new VersionDto(
            Guid.Empty, newNumber, version.WordCount,
            $"restore:{versionNumber}", lastSequence, dateTime.UtcNow);
    }

    // -----------------------------------------------------------------------

    private static int CountWords(string text) =>
        string.IsNullOrWhiteSpace(text)
            ? 0
            : text.Split(
                [' ', '\n', '\r', '\t'],
                StringSplitOptions.RemoveEmptyEntries).Length;

    private static string? Truncate(string? value, int max) =>
        value is null || value.Length <= max ? value : value[..max];
}
