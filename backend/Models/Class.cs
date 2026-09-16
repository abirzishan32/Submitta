using AssignmentSystem.Domain.Common;

namespace AssignmentSystem.Domain.Entities;

/// <summary>
/// A cohort of students — "Grade 10 - Section A" in a school, "CSE-3101" in a
/// college.
///
/// The requirements write "class/course" interchangeably throughout, so the two
/// are modelled as this one entity rather than inventing a hierarchy the brief
/// never describes. (Documented as an assumption in the README.)
/// </summary>
public class Class : BaseEntity
{
    public required string Name { get; set; }

    /// <summary>Short unique identifier used in listings and search, e.g. "G10-A".</summary>
    public required string Code { get; set; }

    public string? Description { get; set; }

    /// <summary>e.g. "2025-2026". Lets the same class code recur across years.</summary>
    public string? AcademicYear { get; set; }

    public bool IsActive { get; set; } = true;

    // Navigation
    public ICollection<ClassSubject> ClassSubjects { get; set; } = [];
    public ICollection<Enrollment> Enrollments { get; set; } = [];
}
