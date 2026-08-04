using AssignmentSystem.Domain.Enums;

namespace AssignmentSystem.Application.Features.Notifications;

/// <summary>One notification, as the bell menu renders it.</summary>
public sealed record NotificationDto(
    Guid Id,
    NotificationType Type,
    string Title,
    string Body,
    string? LinkUrl,
    bool IsRead,
    DateTimeOffset CreatedAt);

/// <summary>A page of notifications, with the badge count alongside.</summary>
public sealed record NotificationListDto(
    IReadOnlyList<NotificationDto> Items,
    int UnreadCount,
    int TotalCount);

/// <summary>
/// What travels down the live connection.
///
/// The unread count rides along with the notification rather than being fetched
/// afterwards, so the badge never shows a number that disagrees with the list
/// beneath it.
/// </summary>
public sealed record NotificationEvent(NotificationDto Notification, int UnreadCount);

/// <summary>
/// A notification to be created, before it is addressed to anyone.
///
/// Separating the content from the recipients is what lets one event fan out to
/// a whole class without writing the wording thirty times.
/// </summary>
public sealed record NotificationRequest(
    NotificationType Type,
    string Title,
    string Body,
    string? LinkUrl = null,
    Guid? SubjectId = null,
    string? DedupeKey = null);
