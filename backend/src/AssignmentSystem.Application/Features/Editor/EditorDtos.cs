using AssignmentSystem.Domain.Enums;

namespace AssignmentSystem.Application.Features.Editor;

/// <summary>
/// One recorded operation, as sent by the editor.
///
/// Events arrive in batches rather than one request per keystroke — a student
/// typing at speed would otherwise generate hundreds of requests a minute.
/// </summary>
public sealed record EventInput(
    long Sequence,
    SubmissionEventType Type,
    long OffsetMs,
    Guid SessionId,
    int? CursorFrom,
    int? CursorTo,
    string? BlockId,
    string? Payload,
    int CharactersAdded,
    int CharactersRemoved,
    int PastedWords);

/// <summary>
/// A batch of events plus the document state they produced.
///
/// <paramref name="ContentJson"/> is the document after these events, so a save
/// and the log that explains it can never describe different states.
/// </summary>
public sealed record RecordEventsRequest(
    IReadOnlyList<EventInput> Events,
    string? ContentJson,
    string? PlainText,
    bool CreateVersion,
    string? VersionReason);

public sealed record RecordEventsResponse(
    long LastSequence,
    int Accepted,
    int Skipped,
    int? VersionNumber);

/// <summary>
/// What the editor needs to resume an existing document.
///
/// Writing happens across sittings, so the log has to continue rather than
/// restart: sequence numbers are unique per submission, and a fresh editor that
/// began again at 1 would have every event rejected as a duplicate. The offset
/// keeps the replay one continuous timeline instead of several overlapping ones.
/// </summary>
public sealed record EditorSessionDto(
    Guid SubmissionId,
    string? ContentJson,
    string PlainText,
    long LastSequence,
    long LastOffsetMs,
    bool Editable);

/// <summary>An event as replayed to a teacher.</summary>
public sealed record ReplayEventDto(
    long Sequence,
    SubmissionEventType Type,
    long OffsetMs,
    string? BlockId,
    int? CursorFrom,
    int? CursorTo,
    string? Payload,
    int CharactersAdded,
    int CharactersRemoved,
    int PastedWords);

/// <summary>Everything the replay player needs in one response.</summary>
public sealed record ReplayDto(
    Guid SubmissionId,
    string StudentName,
    string AssignmentTitle,
    string? FinalContentJson,
    long TotalDurationMs,
    int EventCount,
    IReadOnlyList<ReplayEventDto> Events,
    WritingAnalyticsDto Analytics);

/// <summary>
/// Derived writing statistics.
///
/// Computed from the event log on read rather than maintained as counters:
/// the log is the source of truth, and a counter that drifts from it would be
/// worse than no counter.
/// </summary>
public sealed record WritingAnalyticsDto(
    long TotalDurationMs,
    long ActiveWritingMs,
    long IdleMs,
    int WordsTyped,
    int WordsPasted,
    double PastePercentage,
    double TypingSpeedWpm,
    int CharactersTyped,
    int CharactersDeleted,
    int DeleteCount,
    int UndoCount,
    int RedoCount,
    int PasteCount,
    int LargestPasteWords,
    int ImagesInserted,
    int TablesInserted,
    int CodeBlocksInserted,
    int EquationsInserted,
    long AveragePauseMs,
    long LongestPauseMs,
    int SessionCount,
    int FocusLostCount,
    DateTimeOffset? FirstEditAt,
    DateTimeOffset? LastEditAt,
    IReadOnlyList<PasteIncidentDto> LargePastes);

/// <summary>
/// A paste worth a teacher's attention.
///
/// Reported rather than judged: a long paste may be the student's own notes
/// moved in from elsewhere. The system surfaces it; the teacher decides.
/// </summary>
public sealed record PasteIncidentDto(
    long Sequence,
    long OffsetMs,
    int Words,
    int Characters,
    string? Preview);

public sealed record VersionDto(
    Guid Id,
    int VersionNumber,
    int WordCount,
    string Reason,
    long AtSequence,
    DateTimeOffset CreatedAt);

public sealed record VersionDetailDto(
    Guid Id,
    int VersionNumber,
    string ContentJson,
    string PlainText,
    int WordCount,
    string Reason,
    DateTimeOffset CreatedAt);
