using AssignmentSystem.Domain.Common;

namespace AssignmentSystem.Domain.Entities;

/// <summary>
/// A configurable application-level setting, backing the admin duty
/// "manage application-level settings where necessary".
///
/// Key/value rather than a fixed-column table so a new setting needs a seed row
/// rather than a migration.
/// </summary>
public class ApplicationSetting : BaseEntity
{
    /// <summary>Dotted key, e.g. "submission.allow_late_by_default".</summary>
    public required string Key { get; set; }

    public required string Value { get; set; }

    /// <summary>"boolean" | "integer" | "decimal" | "string" — drives parsing and the admin UI input type.</summary>
    public required string DataType { get; set; }

    public string? Description { get; set; }

    /// <summary>
    /// Whether non-admins may read this setting. Keeps operational settings from
    /// leaking through a public endpoint.
    /// </summary>
    public bool IsPublic { get; set; }
}
