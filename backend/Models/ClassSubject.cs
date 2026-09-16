using AssignmentSystem.Domain.Common;

namespace AssignmentSystem.Domain.Entities;

/// <summary>
/// A subject offered to a class — "Mathematics, as taught to Grade 10-A".
///
/// This is the pivot the whole system turns on. The brief says a teacher assigns
/// work "to a specific class/course <em>and</em> subject", so an assignment
/// belongs to an offering rather than to a class or a subject alone. Teacher
/// permissions attach here too, which is what makes "can this teacher grade this
/// submission?" a single lookup.
/// </summary>
public class ClassSubject : BaseEntity
{
    public Guid ClassId { get; set; }
    public Class Class { get; set; } = null!;

    public Guid SubjectId { get; set; }
    public Subject Subject { get; set; } = null!;

    // Navigation
    public ICollection<TeacherAssignment> TeacherAssignments { get; set; } = [];
    public ICollection<Assignment> Assignments { get; set; } = [];
}
