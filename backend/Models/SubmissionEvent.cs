using AssignmentSystem.Domain.Common;
using AssignmentSystem.Domain.Enums;

namespace AssignmentSystem.Domain.Entities;

/// <summary>
/// One recorded editing operation on a submission.
///
/// The replay is reconstructed from these rather than from a screen recording:
/// a structured operation log is a fraction of the size, stays queryable
/// (“show me every paste over 200 words”), and contains no pixels of anything
/// the student had open beside the editor.
///
/// Rows are append-only. Nothing edits or deletes an event once written —
/// a replay that could be rewritten afterwards would be worth very little.
/// </summary>
public class SubmissionEvent : BaseEntity
{
    public Guid SubmissionId { get; set; }
    public Submission Submission { get; set; } = null!;

    /// <summary>
    /// Monotonic per submission. Timestamps alone cannot order two operations
    /// inside the same millisecond, and a client clock can drift or jump.
    /// </summary>
    public long Sequence { get; set; }

    public SubmissionEventType Type { get; set; }

    /// <summary>
    /// Milliseconds since the writing session began, as measured by the client.
    ///
    /// The replay scrubs on this rather than on wall-clock time, so a document
    /// written across three days still plays as one continuous timeline.
    /// </summary>
    public long OffsetMs { get; set; }

    /// <summary>When the server accepted the event. Not client-controlled.</summary>
    public DateTimeOffset ReceivedAt { get; set; }

    /// <summary>Groups events from one continuous sitting.</summary>
    public Guid SessionId { get; set; }

    // --- Position ---------------------------------------------------------

    public int? CursorFrom { get; set; }
    public int? CursorTo { get; set; }

    /// <summary>Identifier of the block the operation touched, where one applies.</summary>
    public string? BlockId { get; set; }

    // --- Payload ----------------------------------------------------------

    /// <summary>
    /// Operation detail as JSONB: inserted or deleted text, formatting marks,
    /// node attributes, paste metrics. Shapes differ per event type, so a
    /// column per field would be mostly nulls.
    /// </summary>
    public string? Payload { get; set; }

    /// <summary>Characters inserted by this operation, for cheap aggregate queries.</summary>
    public int CharactersAdded { get; set; }

    public int CharactersRemoved { get; set; }

    /// <summary>
    /// Words arriving by paste. Stored on the row rather than only in the
    /// payload so “how much of this was pasted?” is a SUM, not a JSON scan.
    /// </summary>
    public int PastedWords { get; set; }
}
