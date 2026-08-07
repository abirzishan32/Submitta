using AssignmentSystem.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AssignmentSystem.Infrastructure.Persistence.Configurations;

public class RubricCriterionConfiguration : IEntityTypeConfiguration<RubricCriterion>
{
    public void Configure(EntityTypeBuilder<RubricCriterion> builder)
    {
        builder.HasKey(c => c.Id);

        builder.Property(c => c.Title).HasMaxLength(200).IsRequired();
        builder.Property(c => c.Description).HasMaxLength(1000);
        builder.Property(c => c.MaxPoints).HasPrecision(6, 2);

        builder.HasOne(c => c.Assignment)
            .WithMany(a => a.RubricCriteria)
            .HasForeignKey(c => c.AssignmentId)
            .OnDelete(DeleteBehavior.Cascade);

        // The rubric is always read whole, in the teacher's order.
        builder.HasIndex(c => new { c.AssignmentId, c.Order })
            .HasDatabaseName("ix_rubric_criteria_assignment_order");

        builder.ToTable(t => t.HasCheckConstraint(
            "ck_rubric_criteria_points_positive",
            "max_points > 0"));
    }
}

public class SubmissionCriterionScoreConfiguration
    : IEntityTypeConfiguration<SubmissionCriterionScore>
{
    public void Configure(EntityTypeBuilder<SubmissionCriterionScore> builder)
    {
        builder.HasKey(s => s.Id);

        builder.Property(s => s.Points).HasPrecision(6, 2);
        builder.Property(s => s.Comment).HasMaxLength(1000);

        builder.HasOne(s => s.Submission)
            .WithMany(s => s.CriterionScores)
            .HasForeignKey(s => s.SubmissionId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(s => s.RubricCriterion)
            .WithMany(c => c.Scores)
            .HasForeignKey(s => s.RubricCriterionId)
            // Restrict, not cascade: deleting a criterion that has already been
            // marked against would silently rewrite students' results. The
            // service refuses that edit instead.
            .OnDelete(DeleteBehavior.Restrict);

        // One score per criterion per submission. Re-marking updates the row
        // rather than adding a second, which would double the total.
        builder.HasIndex(s => new { s.SubmissionId, s.RubricCriterionId })
            .IsUnique()
            .HasFilter("is_deleted = false")
            .HasDatabaseName("ix_criterion_scores_submission_criterion_unique");

        builder.ToTable(t => t.HasCheckConstraint(
            "ck_criterion_scores_points_non_negative",
            "points >= 0"));
    }
}
