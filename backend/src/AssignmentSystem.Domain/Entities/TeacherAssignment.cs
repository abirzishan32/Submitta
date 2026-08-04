using AssignmentSystem.Domain.Common;

namespace AssignmentSystem.Domain.Entities;

/// <summary>
/// Puts a teacher in charge of one class-subject offering — the admin duty
/// "assign teachers to subjects/classes".
///
/// Named for the domain concept, not the <see cref="Assignment"/> entity: this
/// is a staffing record, not a piece of work. It is the authority behind every
/// teacher-side permission check — creating assignments for an offering, and
/// viewing or grading its submissions.
/// </summary>
public class TeacherAssignment : BaseEntity
{
    public Guid TeacherId { get; set; }
    public User Teacher { get; set; } = null!;

    public Guid ClassSubjectId { get; set; }
    public ClassSubject ClassSubject { get; set; } = null!;

    public DateTimeOffset AssignedAt { get; set; }

    /// <summary>The admin who made the assignment.</summary>
    public Guid? AssignedByUserId { get; set; }
}
