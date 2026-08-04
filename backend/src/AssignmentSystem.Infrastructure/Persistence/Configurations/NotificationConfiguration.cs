using AssignmentSystem.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AssignmentSystem.Infrastructure.Persistence.Configurations;

public class NotificationConfiguration : IEntityTypeConfiguration<Notification>
{
    public void Configure(EntityTypeBuilder<Notification> builder)
    {
        builder.HasKey(n => n.Id);

        builder.Property(n => n.Type).IsRequired();
        builder.Property(n => n.Title).HasMaxLength(200).IsRequired();
        builder.Property(n => n.Body).HasMaxLength(500).IsRequired();
        builder.Property(n => n.LinkUrl).HasMaxLength(300);
        builder.Property(n => n.DedupeKey).HasMaxLength(120);

        builder.HasOne(n => n.User)
            .WithMany()
            // A deleted account's notifications have no one to read them.
            .HasForeignKey(n => n.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        // The only list query: this person's notifications, newest first.
        builder.HasIndex(n => new { n.UserId, n.CreatedAt })
            .HasDatabaseName("ix_notifications_user_created");

        // The badge count, on every page load and every stream tick. Filtered
        // so the index holds only the rows it is asked about.
        builder.HasIndex(n => new { n.UserId, n.IsRead })
            .HasFilter("is_read = false AND is_deleted = false")
            .HasDatabaseName("ix_notifications_user_unread");

        // What makes a repeated notification impossible rather than unlikely.
        // The deadline sweep runs on a timer and may overlap itself; this is
        // the guarantee that a student is told once, not once per sweep.
        builder.HasIndex(n => new { n.UserId, n.DedupeKey })
            .IsUnique()
            .HasFilter("dedupe_key IS NOT NULL AND is_deleted = false")
            .HasDatabaseName("ix_notifications_user_dedupe_unique");
    }
}
