using AssignmentSystem.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AssignmentSystem.Infrastructure.Persistence.Configurations;

public class SubmissionEventConfiguration : IEntityTypeConfiguration<SubmissionEvent>
{
    public void Configure(EntityTypeBuilder<SubmissionEvent> builder)
    {
        builder.HasKey(e => e.Id);

        builder.Property(e => e.Type).IsRequired();
        builder.Property(e => e.BlockId).HasMaxLength(64);

        // jsonb rather than text: payload shapes differ per event type, and
        // questions like "the largest paste in this submission" are then a
        // query rather than a client-side scan.
        builder.Property(e => e.Payload).HasColumnType("jsonb");

        builder.HasOne(e => e.Submission)
            .WithMany(s => s.Events)
            // The log is meaningless without its submission, and a submission
            // can only be soft-deleted anyway.
            .HasForeignKey(e => e.SubmissionId)
            .OnDelete(DeleteBehavior.Cascade);

        // The replay's only read pattern: every event for one submission, in
        // order. This index makes it a single ordered scan.
        builder.HasIndex(e => new { e.SubmissionId, e.Sequence })
            .IsUnique()
            .HasDatabaseName("ix_submission_events_submission_sequence");

        // Drives the "large paste" warning without touching the payload.
        builder.HasIndex(e => new { e.SubmissionId, e.Type })
            .HasDatabaseName("ix_submission_events_submission_type");

        builder.ToTable(t => t.HasCheckConstraint(
            "ck_submission_events_offset_non_negative",
            "offset_ms >= 0"));
    }
}

public class SubmissionVersionConfiguration : IEntityTypeConfiguration<SubmissionVersion>
{
    public void Configure(EntityTypeBuilder<SubmissionVersion> builder)
    {
        builder.HasKey(v => v.Id);

        builder.Property(v => v.ContentJson).HasColumnType("jsonb").IsRequired();
        builder.Property(v => v.PlainText).IsRequired();
        builder.Property(v => v.Reason).HasMaxLength(32).IsRequired();

        builder.HasOne(v => v.Submission)
            .WithMany(s => s.Versions)
            .HasForeignKey(v => v.SubmissionId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(v => new { v.SubmissionId, v.VersionNumber })
            .IsUnique()
            .HasFilter("is_deleted = false")
            .HasDatabaseName("ix_submission_versions_submission_number_unique");

        builder.ToTable(t => t.HasCheckConstraint(
            "ck_submission_versions_number_positive",
            "version_number > 0"));
    }
}
