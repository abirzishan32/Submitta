using AssignmentSystem.Application.Common.Interfaces;

namespace AssignmentSystem.Infrastructure.Services;

/// <summary>
/// Production clock. Always UTC — deadlines are compared across time zones, so
/// storing or comparing local time would make correctness depend on server locale.
/// </summary>
public sealed class DateTimeProvider : IDateTimeProvider
{
    public DateTimeOffset UtcNow => DateTimeOffset.UtcNow;
}
