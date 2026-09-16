using System.Text.Json;
using Asp.Versioning;
using AssignmentSystem.Application.Common.Interfaces;
using AssignmentSystem.Application.Common.Models;
using AssignmentSystem.Application.Features.Notifications;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AssignmentSystem.Api.Controllers;

/// <summary>
/// The signed-in user's notifications, and the live feed behind the bell.
/// </summary>
[ApiController]
[ApiVersion("1.0")]
[Authorize]
[Route("api/v{version:apiVersion}/notifications")]
[Produces("application/json")]
public sealed class NotificationsController(
    INotificationService notifications,
    INotificationStream stream,
    ICurrentUser currentUser) : ControllerBase
{
    /// <summary>The caller's notifications, newest first, with the unread count.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<NotificationListDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> List([FromQuery] int take = 20, CancellationToken ct = default)
        => Ok(ApiResponse<NotificationListDto>.Ok(await notifications.ListAsync(take, ct)));

    /// <summary>Just the badge number.</summary>
    [HttpGet("unread-count")]
    [ProducesResponseType(typeof(ApiResponse<int>), StatusCodes.Status200OK)]
    public async Task<IActionResult> UnreadCount(CancellationToken ct)
        => Ok(ApiResponse<int>.Ok(await notifications.UnreadCountAsync(ct)));

    /// <summary>Marks one notification read. Someone else's id finds nothing.</summary>
    [HttpPost("{id:guid}/read")]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> MarkRead(Guid id, CancellationToken ct)
    {
        await notifications.MarkReadAsync(id, ct);
        return Ok(ApiResponse.Ok());
    }

    /// <summary>Marks everything read, and reports how many that was.</summary>
    [HttpPost("read-all")]
    [ProducesResponseType(typeof(ApiResponse<int>), StatusCodes.Status200OK)]
    public async Task<IActionResult> MarkAllRead(CancellationToken ct)
        => Ok(ApiResponse<int>.Ok(await notifications.MarkAllReadAsync(ct)));

    /// <summary>
    /// A live feed of this user's notifications, as server-sent events.
    /// </summary>
    /// <remarks>
    /// SSE rather than WebSockets: nothing is ever sent upstream on this
    /// connection, and `EventSource` reconnects on its own — behaviour that
    /// would otherwise have to be written and then got right.
    ///
    /// The response is streamed for as long as the client stays connected. It
    /// closes when they navigate away, which cancels the request token and ends
    /// the subscription.
    /// </remarks>
    [HttpGet("stream")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task Stream(CancellationToken ct)
    {
        var userId = currentUser.RequireUserId();

        Response.ContentType = "text/event-stream";
        Response.Headers.CacheControl = "no-cache, no-transform";
        Response.Headers.Connection = "keep-alive";
        // Tells nginx and friends not to buffer, which would hold events until
        // the buffer filled and defeat the point of streaming.
        Response.Headers["X-Accel-Buffering"] = "no";

        // Sent immediately so the client knows the connection is live rather
        // than merely pending, and so any proxy in between flushes its headers.
        await WriteAsync("ready", new { unreadCount = await notifications.UnreadCountAsync(ct) }, ct);

        // A comment frame on a timer. Idle connections are dropped by proxies
        // and by some browsers after a minute or two of silence; this keeps the
        // connection alive without inventing an event the client must ignore.
        using var heartbeat = new PeriodicTimer(TimeSpan.FromSeconds(25));
        var beating = HeartbeatAsync(heartbeat, ct);

        try
        {
            await foreach (var item in stream.SubscribeAsync(userId, ct))
            {
                await WriteAsync("notification", item, ct);
            }
        }
        catch (OperationCanceledException)
        {
            // The client went away. Not an error.
        }
        finally
        {
            await beating.ConfigureAwait(false);
        }
    }

    private async Task HeartbeatAsync(PeriodicTimer timer, CancellationToken ct)
    {
        try
        {
            while (await timer.WaitForNextTickAsync(ct))
            {
                await Response.WriteAsync(": ping\n\n", ct);
                await Response.Body.FlushAsync(ct);
            }
        }
        catch (OperationCanceledException)
        {
            // Expected on disconnect.
        }
        catch (Exception)
        {
            // A broken pipe means the client is gone; the subscription loop
            // will notice and unwind.
        }
    }

    private async Task WriteAsync(string eventName, object payload, CancellationToken ct)
    {
        var json = JsonSerializer.Serialize(payload, SerializerOptions);

        await Response.WriteAsync($"event: {eventName}\n", ct);
        await Response.WriteAsync($"data: {json}\n\n", ct);
        await Response.Body.FlushAsync(ct);
    }

    /// <summary>
    /// camelCase, matching every other response. The stream bypasses the MVC
    /// formatters, so it has to say so itself.
    /// </summary>
    private static readonly JsonSerializerOptions SerializerOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        Converters = { new System.Text.Json.Serialization.JsonStringEnumConverter() },
    };
}
