using AssignmentSystem.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace AssignmentSystem.Application.Common.Interfaces;

/// <summary>
/// The persistence surface the Application layer is allowed to touch.
///
/// Services depend on this rather than on the concrete DbContext, which keeps
/// business logic in a project that has no reference to Infrastructure and lets
/// tests swap in an in-memory implementation.
/// </summary>
public interface IAppDbContext
{
    DbSet<User> Users { get; }
    DbSet<RefreshToken> RefreshTokens { get; }
    DbSet<Class> Classes { get; }
    DbSet<Subject> Subjects { get; }
    DbSet<ClassSubject> ClassSubjects { get; }
    DbSet<Enrollment> Enrollments { get; }
    DbSet<TeacherAssignment> TeacherAssignments { get; }
    DbSet<Assignment> Assignments { get; }
    DbSet<Submission> Submissions { get; }
    DbSet<SubmissionFeedback> SubmissionFeedbacks { get; }
    DbSet<SubmissionEvent> SubmissionEvents { get; }
    DbSet<SubmissionVersion> SubmissionVersions { get; }
    DbSet<ApplicationSetting> ApplicationSettings { get; }
    DbSet<AuditLog> AuditLogs { get; }
    DbSet<Notification> Notifications { get; }
    DbSet<SubmissionCriterionScore> SubmissionCriterionScores { get; }
    DbSet<RubricCriterion> RubricCriteria { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
