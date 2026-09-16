using System.Collections.Concurrent;
using System.Runtime.CompilerServices;
using System.Threading.Channels;
using AssignmentSystem.Application.Features.Notifications;
using Microsoft.Extensions.Logging;

namespace AssignmentSystem.Infrastructure.Notifications;

/// <summary>
/// Delivers notifications to open connections, in this process.
///
/// Each connection gets a bounded channel. One user can have several — a laptop
/// and a phone, or two tabs — so the map holds a list per user and every one of
/// them receives the same event.
///
/// The channels drop their oldest item when full rather than blocking. A slow
/// or wedged client must never be able to stall the request that is publishing,
/// and the notification is already in the database, so the worst outcome is
/// that the client's badge lags until its next fetch.
/// </summary>
public sealed class InProcessNotificationStream(ILogger<InProcessNotificationStream> logger)
    : INotificationStream
{
    /// <summary>
    /// Deep enough to absorb a burst — a whole class submitting at once — but
    /// small enough that a dead connection cannot hold much memory.
    /// </summary>
    private const int Capacity = 64;

    private readonly ConcurrentDictionary<Guid, List<Channel<NotificationEvent>>> subscribers = new();

    public ValueTask PublishAsync(
        IReadOnlyCollection<Guid> userIds,
        Func<Guid, NotificationEvent> forUser,
        CancellationToken ct = default)
    {
        foreach (var userId in userIds)
        {
            if (!subscribers.TryGetValue(userId, out var channels)) continue;

            // Copied under the lock: a subscriber can disconnect while this is
            // iterating, and mutating the list from another thread mid-loop
            // would throw.
            Channel<NotificationEvent>[] snapshot;
            lock (channels)
            {
                snapshot = [.. channels];
            }

            if (snapshot.Length == 0) continue;

            var payload = forUser(userId);

            foreach (var channel in snapshot)
            {
                channel.Writer.TryWrite(payload);
            }
        }

        return ValueTask.CompletedTask;
    }

    public async IAsyncEnumerable<NotificationEvent> SubscribeAsync(
        Guid userId,
        [EnumeratorCancellation] CancellationToken ct)
    {
        var channel = Channel.CreateBounded<NotificationEvent>(
            new BoundedChannelOptions(Capacity)
            {
                FullMode = BoundedChannelFullMode.DropOldest,
                SingleReader = true,
            });

        Add(userId, channel);
        logger.LogDebug("Notification stream opened for {UserId}.", userId);

        try
        {
            await foreach (var item in channel.Reader.ReadAllAsync(ct))
            {
                yield return item;
            }
        }
        finally
        {
            Remove(userId, channel);
            logger.LogDebug("Notification stream closed for {UserId}.", userId);
        }
    }

    /// <remarks>
    /// Retries because the list this finds can be removed from the map by a
    /// departing subscriber before the lock is acquired. Adding to it then
    /// would attach the connection to a list nothing publishes to, and the
    /// symptom — one tab silently never receiving anything — is close to
    /// undebuggable. Re-reading under the lock makes that impossible.
    /// </remarks>
    private void Add(Guid userId, Channel<NotificationEvent> channel)
    {
        while (true)
        {
            var channels = subscribers.GetOrAdd(userId, _ => []);

            lock (channels)
            {
                if (subscribers.TryGetValue(userId, out var current) && ReferenceEquals(current, channels))
                {
                    channels.Add(channel);
                    return;
                }
            }
        }
    }

    private void Remove(Guid userId, Channel<NotificationEvent> channel)
    {
        if (!subscribers.TryGetValue(userId, out var channels)) return;

        lock (channels)
        {
            channels.Remove(channel);

            // Removing the entry when the last connection goes keeps the map
            // from growing one dead key per user who has ever signed in.
            if (channels.Count == 0)
            {
                subscribers.TryRemove(userId, out _);
            }
        }
    }
}
