using AssignmentSystem.Application.Common.Interfaces;
using AssignmentSystem.Domain.Entities;
using AssignmentSystem.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace AssignmentSystem.Application.Features.Notifications;

public interface INotificationService
{
    /// <summary>The caller's notifications, newest first.</summary>
    Task<NotificationListDto> ListAsync(int take = 20, CancellationToken ct = default);

    Task<int> UnreadCountAsync(CancellationToken ct = default);

    Task MarkReadAsync(Guid id, CancellationToken ct = default);

    Task<int> MarkAllReadAsync(CancellationToken ct = default);

    /// <summary>
    /// Creates one notification for each recipient and pushes it to any live
    /// connection. Returns how many were actually written.
    /// </summary>
    Task<int> NotifyAsync(
        IReadOnlyCollection<Guid> userIds,
        NotificationRequest request,
        CancellationToken ct = default);
}

/// <summary>
/// Reading and writing notifications.
///
/// Everything a person is told goes through here, so the rules about who hears
/// what live in one place rather than scattered across the services that happen
/// to trigger them.
/// </summary>
public sealed class NotificationService(
    IAppDbContext context,
    ICurrentUser currentUser,
    IDateTimeProvider dateTime,
    INotificationStream stream,
    ILogger<NotificationService> logger) : INotificationService
{
    public async Task<NotificationListDto> ListAsync(int take = 20, CancellationToken ct = default)
    {
        var userId = currentUser.RequireUserId();
        var capped = Math.Clamp(take, 1, 100);

        var mine = context.Notifications.AsNoTracking().Where(n => n.UserId == userId);

        var items = await mine
            .OrderByDescending(n => n.CreatedAt)
            .Take(capped)
            .Select(n => new NotificationDto(
                n.Id, n.Type, n.Title, n.Body, n.LinkUrl, n.IsRead, n.CreatedAt))
            .ToListAsync(ct);

        return new NotificationListDto(
            items,
            await mine.CountAsync(n => !n.IsRead, ct),
            await mine.CountAsync(ct));
    }

    public async Task<int> UnreadCountAsync(CancellationToken ct = default)
    {
        var userId = currentUser.RequireUserId();

        return await context.Notifications
            .AsNoTracking()
            .CountAsync(n => n.UserId == userId && !n.IsRead, ct);
    }

    public async Task MarkReadAsync(Guid id, CancellationToken ct = default)
    {
        var userId = currentUser.RequireUserId();

        // Scoped to the caller, so an id from someone else's feed finds nothing
        // rather than marking their notification read.
        var notification = await context.Notifications
            .FirstOrDefaultAsync(n => n.Id == id && n.UserId == userId, ct);

        if (notification is null || notification.IsRead) return;

        notification.IsRead = true;
        notification.ReadAt = dateTime.UtcNow;

        await context.SaveChangesAsync(ct);
    }

    public async Task<int> MarkAllReadAsync(CancellationToken ct = default)
    {
        var userId = currentUser.RequireUserId();
        var now = dateTime.UtcNow;

        var unread = await context.Notifications
            .Where(n => n.UserId == userId && !n.IsRead)
            .ToListAsync(ct);

        foreach (var notification in unread)
        {
            notification.IsRead = true;
            notification.ReadAt = now;
        }

        await context.SaveChangesAsync(ct);
        return unread.Count;
    }

    public async Task<int> NotifyAsync(
        IReadOnlyCollection<Guid> userIds,
        NotificationRequest request,
        CancellationToken ct = default)
    {
        if (userIds.Count == 0) return 0;

        // One person can be a recipient twice over — a teacher of two offerings
        // in the same class, say — and should still be told once.
        var recipients = userIds.Distinct().ToList();

        // Anything already sent under this key is skipped. The unique index is
        // what actually guarantees it; this check is what keeps the common case
        // from throwing.
        if (request.DedupeKey is not null)
        {
            var already = await context.Notifications
                .Where(n => n.DedupeKey == request.DedupeKey && recipients.Contains(n.UserId))
                .Select(n => n.UserId)
                .ToListAsync(ct);

            recipients = recipients.Except(already).ToList();
            if (recipients.Count == 0) return 0;
        }

        var created = recipients
            .Select(userId => new Notification
            {
                UserId = userId,
                Type = request.Type,
                Title = request.Title,
                Body = request.Body,
                LinkUrl = request.LinkUrl,
                SubjectId = request.SubjectId,
                DedupeKey = request.DedupeKey,
            })
            .ToList();

        context.Notifications.AddRange(created);
        await context.SaveChangesAsync(ct);

        logger.LogInformation(
            "Sent {Count} '{Type}' notification(s).", created.Count, request.Type);

        await PushAsync(created, ct);

        return created.Count;
    }

    /// <summary>
    /// Pushes freshly written notifications to any open connection.
    /// </summary>
    /// <remarks>
    /// Failures here are logged and swallowed. The notification is already
    /// stored, so the worst case is that the recipient sees it on their next
    /// page load instead of immediately — which is not a reason to fail the
    /// publish or the submission that triggered it.
    /// </remarks>
    private async Task PushAsync(List<Notification> created, CancellationToken ct)
    {
        try
        {
            var counts = await context.Notifications
                .AsNoTracking()
                .Where(n => created.Select(c => c.UserId).Contains(n.UserId) && !n.IsRead)
                .GroupBy(n => n.UserId)
                .Select(g => new { UserId = g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.UserId, x => x.Count, ct);

            var byUser = created.ToDictionary(n => n.UserId, n => n);

            await stream.PublishAsync(
                byUser.Keys,
                userId =>
                {
                    var n = byUser[userId];
                    return new NotificationEvent(
                        new NotificationDto(
                            n.Id, n.Type, n.Title, n.Body, n.LinkUrl, n.IsRead, n.CreatedAt),
                        counts.GetValueOrDefault(userId, 1));
                },
                ct);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Could not push notifications to live connections.");
        }
    }
}

/// <summary>
/// Works out who should hear about something.
///
/// Kept apart from <see cref="NotificationService"/> because the audience for
/// an event is a question about the domain — who teaches this, who is enrolled
/// in that — rather than about notifications.
/// </summary>
public interface INotificationAudience
{
    /// <summary>Students enrolled in the class an assignment belongs to.</summary>
    Task<IReadOnlyList<Guid>> StudentsForAssignmentAsync(Guid assignmentId, CancellationToken ct = default);

    /// <summary>Teachers assigned to the offering an assignment belongs to.</summary>
    Task<IReadOnlyList<Guid>> TeachersForAssignmentAsync(Guid assignmentId, CancellationToken ct = default);

    /// <summary>Every active administrator.</summary>
    Task<IReadOnlyList<Guid>> AdminsAsync(CancellationToken ct = default);
}

public sealed class NotificationAudience(IAppDbContext context) : INotificationAudience
{
    public async Task<IReadOnlyList<Guid>> StudentsForAssignmentAsync(
        Guid assignmentId, CancellationToken ct = default) =>
        await context.Enrollments
            .AsNoTracking()
            .Where(e => context.Assignments.Any(a =>
                a.Id == assignmentId && a.ClassSubject.ClassId == e.ClassId))
            // A deactivated account cannot sign in to read it.
            .Where(e => e.Student.IsActive)
            .Select(e => e.StudentId)
            .Distinct()
            .ToListAsync(ct);

    public async Task<IReadOnlyList<Guid>> TeachersForAssignmentAsync(
        Guid assignmentId, CancellationToken ct = default) =>
        await context.TeacherAssignments
            .AsNoTracking()
            .Where(ta => context.Assignments.Any(a =>
                a.Id == assignmentId && a.ClassSubjectId == ta.ClassSubjectId))
            .Where(ta => ta.Teacher.IsActive)
            .Select(ta => ta.TeacherId)
            .Distinct()
            .ToListAsync(ct);

    public async Task<IReadOnlyList<Guid>> AdminsAsync(CancellationToken ct = default) =>
        await context.Users
            .AsNoTracking()
            .Where(u => u.Role == UserRole.Admin && u.IsActive)
            .Select(u => u.Id)
            .ToListAsync(ct);
}
