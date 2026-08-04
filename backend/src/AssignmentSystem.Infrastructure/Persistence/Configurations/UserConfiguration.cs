using AssignmentSystem.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AssignmentSystem.Infrastructure.Persistence.Configurations;

public class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> builder)
    {
        builder.HasKey(u => u.Id);

        builder.Property(u => u.FullName).HasMaxLength(150).IsRequired();
        builder.Property(u => u.Email).HasMaxLength(256).IsRequired();
        builder.Property(u => u.PasswordHash).HasMaxLength(256).IsRequired();
        builder.Property(u => u.Role).IsRequired();

        // Unique on the lower-cased email, so "A@b.com" cannot be registered
        // alongside "a@b.com". A filtered index keeps a soft-deleted account's
        // address free for reuse.
        builder.HasIndex(u => u.Email)
            .IsUnique()
            .HasFilter("is_deleted = false")
            .HasDatabaseName("ix_users_email_unique");

        builder.HasIndex(u => u.Role).HasDatabaseName("ix_users_role");

        builder.HasMany(u => u.RefreshTokens)
            .WithOne(t => t.User)
            .HasForeignKey(t => t.UserId)
            // Tokens are worthless without their user, so let them go.
            .OnDelete(DeleteBehavior.Cascade);
    }
}
