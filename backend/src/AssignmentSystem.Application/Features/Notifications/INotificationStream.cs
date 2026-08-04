namespace AssignmentSystem.Application.Features.Notifications;

/// <summary>
/// Delivers notifications to connections that are open right now.
///
/// Deliberately separate from storing them. Persistence is what makes a
/// notification survive a refresh; this is what makes it arrive without one.
/// If nobody is connected, publishing is a no-op and the row is still there
/// when they next load the page — the stream is an accelerator, never the
/// source of truth.
///
/// The default implementation is in-process, which is the honest scope for a
/// single-instance deployment. Running several instances behind a load balancer
/// would need this backed by Redis or a bus, and only this interface would
/// change.
/// </summary>
public interface INotificationStream
{
    /// <summary>Pushes to whichever of these users currently have a connection open.</summary>
    ValueTask PublishAsync(
        IReadOnlyCollection<Guid> userIds,
        Func<Guid, NotificationEvent> forUser,
        CancellationToken ct = default);

    /// <summary>
    /// Opens one connection's feed. Completes when <paramref name="ct"/> is
    /// cancelled, which is what happens when the client disconnects.
    /// </summary>
    IAsyncEnumerable<NotificationEvent> SubscribeAsync(Guid userId, CancellationToken ct);
}
