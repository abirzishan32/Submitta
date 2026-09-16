namespace AssignmentSystem.Application.Common.Interfaces;

/// <summary>
/// Abstraction over the system clock.
///
/// Deadline rules are the heart of this system, so the clock has to be
/// injectable — otherwise "reject a submission after the deadline" can only be
/// tested by sleeping or by seeding dates relative to the real now.
/// </summary>
public interface IDateTimeProvider
{
    DateTimeOffset UtcNow { get; }
}
