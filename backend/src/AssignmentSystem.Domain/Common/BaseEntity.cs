namespace AssignmentSystem.Domain.Common;

/// <summary>
/// Base for every persisted entity: identity, audit trail and soft delete.
/// The audit fields are populated automatically by the SaveChanges interceptor
/// in the Infrastructure layer, never by hand in a service.
/// </summary>
public abstract class BaseEntity
{
    /// <summary>
    /// UUID v7 — time-ordered, so inserts stay at the right edge of the B-tree
    /// instead of fragmenting it the way random v4 GUIDs do.
    /// </summary>
    public Guid Id { get; set; } = Guid.CreateVersion7();

    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? UpdatedAt { get; set; }

    public Guid? CreatedBy { get; set; }
    public Guid? ModifiedBy { get; set; }

    /// <summary>
    /// Soft delete. A global query filter hides these rows from every read,
    /// so historical grades and submissions survive a "delete".
    /// </summary>
    public bool IsDeleted { get; set; }
    public DateTimeOffset? DeletedAt { get; set; }
    public Guid? DeletedBy { get; set; }
}
