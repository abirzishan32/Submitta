namespace AssignmentSystem.Domain.Enums;

/// <summary>
/// Lifecycle of an assignment. Students may only ever see <see cref="Published"/>.
/// </summary>
public enum AssignmentStatus
{
    /// <summary>Teacher is still editing. Invisible to students; cannot be submitted to.</summary>
    Draft = 1,

    /// <summary>Visible to enrolled students and open for submission.</summary>
    Published = 2,

    /// <summary>
    /// Withdrawn from circulation but retained. Used instead of deletion once
    /// submissions exist, so grades are never orphaned.
    /// </summary>
    Archived = 3
}
