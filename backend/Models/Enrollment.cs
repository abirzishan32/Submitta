using AssignmentSystem.Domain.Common;

namespace AssignmentSystem.Domain.Entities;

/// <summary>
/// Places a student in a class/course.
///
/// A join table rather than a ClassId column on User, because the brief covers
/// both schools and colleges and a college student takes several courses at
/// once. This is also the query that answers "which assignments is this student
/// allowed to see?".
/// </summary>
public class Enrollment : BaseEntity
{
    public Guid StudentId { get; set; }
    public User Student { get; set; } = null!;

    public Guid ClassId { get; set; }
    public Class Class { get; set; } = null!;

    public DateTimeOffset EnrolledAt { get; set; }
}
