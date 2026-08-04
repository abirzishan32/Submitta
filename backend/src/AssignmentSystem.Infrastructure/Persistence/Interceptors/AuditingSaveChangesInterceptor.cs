using AssignmentSystem.Application.Common.Interfaces;
using AssignmentSystem.Domain.Common;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace AssignmentSystem.Infrastructure.Persistence.Interceptors;

/// <summary>
/// Fills in audit fields and turns deletes into soft deletes on every save.
///
/// Doing this in one interceptor rather than in each service means no write path
/// can forget to stamp <c>UpdatedAt</c>, and no <c>Remove()</c> call anywhere in
/// the codebase can accidentally destroy a graded submission.
/// </summary>
public sealed class AuditingSaveChangesInterceptor(
    ICurrentUser currentUser,
    IDateTimeProvider dateTime) : SaveChangesInterceptor
{
    public override InterceptionResult<int> SavingChanges(
        DbContextEventData eventData,
        InterceptionResult<int> result)
    {
        Apply(eventData.Context);
        return base.SavingChanges(eventData, result);
    }

    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
        DbContextEventData eventData,
        InterceptionResult<int> result,
        CancellationToken cancellationToken = default)
    {
        Apply(eventData.Context);
        return base.SavingChangesAsync(eventData, result, cancellationToken);
    }

    private void Apply(DbContext? context)
    {
        if (context is null)
        {
            return;
        }

        var now = dateTime.UtcNow;
        var userId = currentUser.UserId;

        foreach (var entry in context.ChangeTracker.Entries<BaseEntity>())
        {
            switch (entry.State)
            {
                case EntityState.Added:
                    entry.Entity.CreatedAt = now;
                    entry.Entity.CreatedBy = userId;
                    break;

                case EntityState.Modified:
                    entry.Entity.UpdatedAt = now;
                    entry.Entity.ModifiedBy = userId;
                    // Creation facts are immutable regardless of what the
                    // in-memory object claims.
                    entry.Property(e => e.CreatedAt).IsModified = false;
                    entry.Property(e => e.CreatedBy).IsModified = false;
                    break;

                case EntityState.Deleted:
                    SoftDelete(entry, now, userId);
                    break;
            }
        }
    }

    /// <summary>
    /// Rewrites a delete as an update setting the soft-delete flags. The global
    /// query filter then hides the row from every subsequent read.
    /// </summary>
    private static void SoftDelete(EntityEntry<BaseEntity> entry, DateTimeOffset now, Guid? userId)
    {
        entry.State = EntityState.Modified;

        entry.Entity.IsDeleted = true;
        entry.Entity.DeletedAt = now;
        entry.Entity.DeletedBy = userId;
        entry.Entity.UpdatedAt = now;
        entry.Entity.ModifiedBy = userId;

        entry.Property(e => e.CreatedAt).IsModified = false;
        entry.Property(e => e.CreatedBy).IsModified = false;
    }
}
