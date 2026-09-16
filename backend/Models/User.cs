using AssignmentSystem.Domain.Common;
using AssignmentSystem.Domain.Enums;

namespace AssignmentSystem.Domain.Entities;

/// <summary>
/// An account in the system. One table covers all three roles rather than
/// separate Admin/Teacher/Student tables: they share every identity field, and
/// a single table keeps authentication and the foreign keys straightforward.
/// </summary>
public class User : BaseEntity
{
    public required string FullName { get; set; }

    /// <summary>
    /// Login identifier. Stored lower-cased with a unique index, so
    /// "A@b.com" and "a@b.com" cannot both register.
    /// </summary>
    public required string Email { get; set; }

    /// <summary>BCrypt hash including its own salt and work factor. Never leaves the server.</summary>
    public required string PasswordHash { get; set; }

    public UserRole Role { get; set; }

    /// <summary>
    /// Deactivated accounts fail login but keep their history, so a graduated
    /// student's submissions and grades stay intact and attributable.
    /// </summary>
    public bool IsActive { get; set; } = true;

    public DateTimeOffset? LastLoginAt { get; set; }

    // Navigation
    public ICollection<RefreshToken> RefreshTokens { get; set; } = [];

    /// <summary>Classes this user is enrolled in. Populated for Students only.</summary>
    public ICollection<Enrollment> Enrollments { get; set; } = [];

    /// <summary>Class-subject offerings this user teaches. Populated for Teachers only.</summary>
    public ICollection<TeacherAssignment> TeacherAssignments { get; set; } = [];

    /// <summary>Assignments authored by this user. Populated for Teachers only.</summary>
    public ICollection<Assignment> CreatedAssignments { get; set; } = [];

    /// <summary>Submissions made by this user. Populated for Students only.</summary>
    public ICollection<Submission> Submissions { get; set; } = [];
}
