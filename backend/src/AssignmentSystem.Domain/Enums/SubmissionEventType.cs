namespace AssignmentSystem.Domain.Enums;

/// <summary>
/// The operations recorded while a submission is written.
///
/// Deliberately coarser than "every keystroke is its own row": consecutive
/// typing is coalesced by the client into a single insert event carrying the
/// run of text, which is what keeps a 2,000-word essay in the low thousands of
/// rows rather than the tens of thousands. The replay still reproduces
/// character-level playback by interpolating within a run.
/// </summary>
public enum SubmissionEventType
{
    /// <summary>The editor was opened on this submission.</summary>
    DocumentOpen = 1,

    /// <summary>Typed text. Payload carries the inserted run.</summary>
    Insert = 2,

    /// <summary>Text removed, by backspace, delete or replacing a selection.</summary>
    Delete = 3,

    /// <summary>
    /// Content arriving from the clipboard. Separated from <see cref="Insert"/>
    /// because the distinction is the point — see PastedWords.
    /// </summary>
    Paste = 4,

    Cut = 5,

    /// <summary>A mark applied or removed — bold, highlight, colour, link.</summary>
    Format = 6,

    /// <summary>A block changed type: paragraph to heading, list, quote, callout.</summary>
    BlockChange = 7,

    /// <summary>A structural node inserted — table, image, code block, equation, diagram.</summary>
    NodeInsert = 8,

    NodeDelete = 9,

    /// <summary>A block dragged or moved to a new position.</summary>
    BlockMove = 10,

    Undo = 11,
    Redo = 12,

    /// <summary>Cursor or selection moved without editing.</summary>
    SelectionChange = 13,

    /// <summary>No input for longer than the idle threshold.</summary>
    Idle = 14,

    /// <summary>The editor lost or regained focus — a tab switch, usually.</summary>
    FocusLost = 15,
    FocusRegained = 16,

    AutoSave = 17,
    ManualSave = 18,

    /// <summary>The student submitted. Terminates the timeline.</summary>
    Submit = 19,

    DocumentClose = 20,
}
