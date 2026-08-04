using AssignmentSystem.Domain.Common;

namespace AssignmentSystem.Domain.Entities;

/// <summary>
/// Record of a state-changing action. Grades and deadlines are disputable, so
/// having an immutable trail of who changed what is worth the write cost.
///
/// Written by the persistence interceptor, never edited afterwards.
/// </summary>
public class AuditLog : BaseEntity
{
    /// <summary>Actor. Null for system actions such as seeding.</summary>
    public Guid? UserId { get; set; }

    /// <summary>"Created" | "Updated" | "Deleted".</summary>
    public required string Action { get; set; }

    public required string EntityName { get; set; }

    public Guid? EntityId { get; set; }

    /// <summary>Changed values before and after, as JSONB. Null on create/delete respectively.</summary>
    public string? OldValues { get; set; }
    public string? NewValues { get; set; }

    public string? IpAddress { get; set; }
}
