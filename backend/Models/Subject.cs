using AssignmentSystem.Domain.Common;

namespace AssignmentSystem.Domain.Entities;

/// <summary>
/// A discipline taught across classes — "Mathematics", "Data Structures".
/// Independent of any class, so one subject can be offered to many.
/// </summary>
public class Subject : BaseEntity
{
    public required string Name { get; set; }

    /// <summary>Short unique identifier, e.g. "MATH", "CSE-DS".</summary>
    public required string Code { get; set; }

    public string? Description { get; set; }

    public bool IsActive { get; set; } = true;

    // Navigation
    public ICollection<ClassSubject> ClassSubjects { get; set; } = [];
}
