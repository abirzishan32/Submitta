using AssignmentSystem.Application.Common.Interfaces;
using AssignmentSystem.Application.Features.Notifications;
using AssignmentSystem.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace AssignmentSystem.Infrastructure.Notifications;

/// <summary>
/// Reminds students about deadlines they have not yet submitted for.
///
/// A timer rather than a scheduled job at the exact hour: nothing here needs
/// minute accuracy, and a sweep that simply asks "what is due soon and who has
/// not answered it?" recovers by itself from a restart, a missed tick, or a
/// deadline changed after the fact. There is no state to keep in step.
///
/// Being told twice is prevented by the notification's dedupe key, which is
/// backed by a unique index — so overlapping sweeps cannot both send.
/// </summary>
public sealed class DeadlineReminderService(
    IServiceScopeFactory scopeFactory,
    ILogger<DeadlineReminderService> logger) : BackgroundService
{
    /// <summary>
    /// How far ahead to warn, from furthest to nearest.
    ///
    /// Two reminders: one with enough time to start the work, one on the day.
    /// A third would be nagging, and nagging gets notifications turned off.
    /// </summary>
    private static readonly (TimeSpan Within, string Key, string Phrase)[] Thresholds =
    [
        (TimeSpan.FromHours(24), "24h", "due in less than 24 hours"),
        (TimeSpan.FromHours(2), "2h", "due in under 2 hours"),
    ];

    private static readonly TimeSpan Interval = TimeSpan.FromMinutes(10);

    /// <summary>
    /// Long enough for the API to finish starting and short enough that a
    /// developer restarting the server sees the sweep run.
    /// </summary>
    private static readonly TimeSpan StartupDelay = TimeSpan.FromSeconds(20);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try
        {
            await Task.Delay(StartupDelay, stoppingToken);
        }
        catch (OperationCanceledException)
        {
            return;
        }

        using var timer = new PeriodicTimer(Interval);

        do
        {
            try
            {
                await SweepAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                return;
            }
            catch (Exception ex)
            {
                // A failed sweep must not kill the loop — the next one in ten
                // minutes will pick up whatever this one missed.
                logger.LogError(ex, "Deadline reminder sweep failed.");
            }
        }
        while (await SafeWaitAsync(timer, stoppingToken));
    }

    private static async Task<bool> SafeWaitAsync(PeriodicTimer timer, CancellationToken ct)
    {
        try
        {
            return await timer.WaitForNextTickAsync(ct);
        }
        catch (OperationCanceledException)
        {
            return false;
        }
    }

    private async Task SweepAsync(CancellationToken ct)
    {
        // A background service is a singleton; the context and the services it
        // needs are scoped, so each sweep gets its own scope.
        using var scope = scopeFactory.CreateScope();

        var context = scope.ServiceProvider.GetRequiredService<IAppDbContext>();
        var notifications = scope.ServiceProvider.GetRequiredService<INotificationService>();
        var clock = scope.ServiceProvider.GetRequiredService<IDateTimeProvider>();

        var now = clock.UtcNow;
        var sent = 0;

        foreach (var (within, key, phrase) in Thresholds)
        {
            var cutoff = now.Add(within);

            var due = await context.Assignments
                .AsNoTracking()
                .Where(a => a.Status == AssignmentStatus.Published)
                .Where(a => a.Deadline > now && a.Deadline <= cutoff)
                .Select(a => new
                {
                    a.Id,
                    a.Title,
                    a.Deadline,
                    a.ClassSubject.ClassId,
                    SubjectName = a.ClassSubject.Subject.Name,
                })
                .ToListAsync(ct);

            foreach (var assignment in due)
            {
                // Only students who have not answered yet. Reminding someone
                // about work they have already handed in is the fastest way to
                // teach them to ignore the bell.
                var pending = await context.Enrollments
                    .AsNoTracking()
                    .Where(e => e.ClassId == assignment.ClassId && e.Student.IsActive)
                    .Where(e => !context.Submissions.Any(s =>
                        s.AssignmentId == assignment.Id && s.StudentId == e.StudentId))
                    .Select(e => e.StudentId)
                    .ToListAsync(ct);

                if (pending.Count == 0) continue;

                sent += await notifications.NotifyAsync(pending, new NotificationRequest(
                    NotificationType.DeadlineApproaching,
                    $"{assignment.Title} is {phrase}",
                    $"{assignment.SubjectName} · closes {assignment.Deadline:d MMM, HH:mm}",
                    $"/student/assignments/{assignment.Id}",
                    assignment.Id,
                    $"deadline:{key}:{assignment.Id}"), ct);
            }
        }

        if (sent > 0)
        {
            logger.LogInformation("Deadline sweep sent {Count} reminder(s).", sent);
        }
    }
}
