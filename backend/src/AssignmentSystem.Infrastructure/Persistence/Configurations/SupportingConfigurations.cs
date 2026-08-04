using AssignmentSystem.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AssignmentSystem.Infrastructure.Persistence.Configurations;

public class ApplicationSettingConfiguration : IEntityTypeConfiguration<ApplicationSetting>
{
    public void Configure(EntityTypeBuilder<ApplicationSetting> builder)
    {
        builder.HasKey(s => s.Id);

        builder.Property(s => s.Key).HasMaxLength(150).IsRequired();
        builder.Property(s => s.Value).HasMaxLength(2000).IsRequired();
        builder.Property(s => s.DataType).HasMaxLength(20).IsRequired();
        builder.Property(s => s.Description).HasMaxLength(500);

        builder.HasIndex(s => s.Key)
            .IsUnique()
            .HasFilter("is_deleted = false")
            .HasDatabaseName("ix_application_settings_key_unique");

        builder.ToTable(t => t.HasCheckConstraint(
            "ck_application_settings_data_type",
            "data_type IN ('boolean', 'integer', 'decimal', 'string')"));
    }
}

public class AuditLogConfiguration : IEntityTypeConfiguration<AuditLog>
{
    public void Configure(EntityTypeBuilder<AuditLog> builder)
    {
        builder.HasKey(a => a.Id);

        builder.Property(a => a.Action).HasMaxLength(50).IsRequired();
        builder.Property(a => a.EntityName).HasMaxLength(100).IsRequired();
        builder.Property(a => a.IpAddress).HasMaxLength(64);

        // jsonb rather than text, so changes stay queryable when investigating
        // a disputed grade.
        builder.Property(a => a.OldValues).HasColumnType("jsonb");
        builder.Property(a => a.NewValues).HasColumnType("jsonb");

        builder.HasIndex(a => new { a.EntityName, a.EntityId })
            .HasDatabaseName("ix_audit_logs_entity");

        builder.HasIndex(a => a.CreatedAt)
            .IsDescending()
            .HasDatabaseName("ix_audit_logs_created_at");
    }
}
