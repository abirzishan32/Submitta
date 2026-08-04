namespace AssignmentSystem.Domain.Enums;

/// <summary>
/// What a notification is about.
///
/// The type drives the icon and the wording on the client, so it is stored
/// rather than derived from the message text — a rewording should never change
/// how a notification is rendered or filtered.
/// </summary>
public enum NotificationType
{
    /// <summary>A teacher published work to a class the recipient is in.</summary>
    AssignmentPublished = 1,

    /// <summary>A deadline the recipient has not yet submitted for is approaching.</summary>
    DeadlineApproaching = 2,

    /// <summary>A student submitted work the recipient is responsible for marking.</summary>
    SubmissionReceived = 3,

    /// <summary>The recipient's own submission has been marked.</summary>
    SubmissionGraded = 4,

    /// <summary>A teacher sent the recipient's submission back for another attempt.</summary>
    SubmissionReturned = 5,

    /// <summary>An account was created and is waiting for an administrator.</summary>
    AccountAwaitingApproval = 6
}
