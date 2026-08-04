using System.Linq.Expressions;
using AssignmentSystem.Application.Common.Interfaces;
using AssignmentSystem.Domain.Common;
using AssignmentSystem.Domain.Entities;
using AssignmentSystem.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace AssignmentSystem.Infrastructure.Persistence;

/// <summary>
/// EF Core context for the whole application.
///
/// Two behaviours are applied globally in <see cref="OnModelCreating"/> rather
/// than per entity, so no query or configuration can forget them:
/// soft-delete filtering, and UTC storage of every timestamp.
/// </summary>
public class AppDbContext(DbContextOptions<AppDbContext> options)
    : DbContext(options), IAppDbContext
{
    public DbSet<User> Users => Set<User>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<Class> Classes => Set<Class>();
    public DbSet<Subject> Subjects => Set<Subject>();
    public DbSet<ClassSubject> ClassSubjects => Set<ClassSubject>();
    public DbSet<Enrollment> Enrollments => Set<Enrollment>();
    public DbSet<TeacherAssignment> TeacherAssignments => Set<TeacherAssignment>();
    public DbSet<Assignment> Assignments => Set<Assignment>();
    public DbSet<Submission> Submissions => Set<Submission>();
    public DbSet<SubmissionFeedback> SubmissionFeedbacks => Set<SubmissionFeedback>();
    public DbSet<SubmissionEvent> SubmissionEvents => Set<SubmissionEvent>();
    public DbSet<SubmissionVersion> SubmissionVersions => Set<SubmissionVersion>();
    public DbSet<ApplicationSetting> ApplicationSettings => Set<ApplicationSetting>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<Notification> Notifications => Set<Notification>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Native PostgreSQL enum types, so the database is self-describing
        // instead of storing opaque integers.
        modelBuilder.HasPostgresEnum<UserRole>();
        modelBuilder.HasPostgresEnum<AssignmentStatus>();
        modelBuilder.HasPostgresEnum<SubmissionStatus>();
        modelBuilder.HasPostgresEnum<SubmissionEventType>();

        // Pick up every IEntityTypeConfiguration in this assembly.
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);

        ApplySoftDeleteQueryFilters(modelBuilder);
    }

    /// <summary>
    /// Adds <c>WHERE is_deleted = false</c> to every entity deriving from
    /// <see cref="BaseEntity"/>.
    ///
    /// Doing this centrally means a forgotten filter cannot leak deleted rows —
    /// the alternative is remembering it in every single query.
    /// </summary>
    private static void ApplySoftDeleteQueryFilters(ModelBuilder modelBuilder)
    {
        foreach (var entityType in modelBuilder.Model.GetEntityTypes())
        {
            if (!typeof(BaseEntity).IsAssignableFrom(entityType.ClrType))
            {
                continue;
            }

            // e => !EF.Property<bool>(e, "IsDeleted")
            var parameter = Expression.Parameter(entityType.ClrType, "e");
            var isDeleted = Expression.Call(
                typeof(EF),
                nameof(EF.Property),
                [typeof(bool)],
                parameter,
                Expression.Constant(nameof(BaseEntity.IsDeleted)));

            var filter = Expression.Lambda(Expression.Not(isDeleted), parameter);
            entityType.SetQueryFilter(filter);
        }
    }

    protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
    {
        base.ConfigureConventions(configurationBuilder);

        // `timestamptz` for every DateTimeOffset. PostgreSQL normalises these to
        // UTC on write, which is what keeps deadline comparisons correct
        // regardless of the server's or the client's time zone.
        configurationBuilder.Properties<DateTimeOffset>()
            .HaveColumnType("timestamptz");

        configurationBuilder.Properties<DateTimeOffset?>()
            .HaveColumnType("timestamptz");

        // Marks: 0.00 to 999.99 is ample and avoids float rounding on grades.
        configurationBuilder.Properties<decimal>()
            .HavePrecision(6, 2);
    }
}
