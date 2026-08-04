using AssignmentSystem.Domain.Common;
using AssignmentSystem.Domain.Enums;

namespace AssignmentSystem.Domain.Entities;

/// <summary>
/// One notification, addressed to one person.
///
/// Fanned out at write time — a class of thirty students getting the same
/// announcement becomes thirty rows — rather than stored once and joined on
/// read. Read state is per person, the unread count has to be a single indexed
/// lookup, and a recipient must be able to dismiss their own copy without
/// touching anyone else's.
/// </summary>
public class Notification : BaseEntity
{
    public Guid UserId { get; set; }
    public User User { get; set; } = null!;

    public NotificationType Type { get; set; }

    /// <summary>One line, shown in bold in the list.</summary>
    public string Title { get; set; } = string.Empty;

    /// <summary>The supporting sentence. Kept short enough to read at a glance.</summary>
    public string Body { get; set; } = string.Empty;

    /// <summary>
    /// Where clicking it goes, as an application-relative path.
    ///
    /// Relative on purpose: an absolute URL stored today would still point at
    /// whatever host was current when it was written, and a notification that
    /// navigates off-site is a phishing vector waiting to happen.
    /// </summary>
    public string? LinkUrl { get; set; }

    public bool IsRead { get; set; }
    public DateTimeOffset? ReadAt { get; set; }

    /// <summary>
    /// Identifies the thing this is about, so a click can be resolved and so
    /// notifications for a deleted assignment can be found.
    /// </summary>
    public Guid? SubjectId { get; set; }

    /// <summary>
    /// Makes a notification idempotent.
    ///
    /// The deadline reminder runs on a timer, so without this a student would
    /// be told about the same assignment on every sweep. Unique per user, so
    /// "already sent" is a constraint the database enforces rather than a race
    /// the scheduler has to win.
    /// </summary>
    public string? DedupeKey { get; set; }
}
