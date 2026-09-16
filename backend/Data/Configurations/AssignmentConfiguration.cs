using AssignmentSystem.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AssignmentSystem.Infrastructure.Persistence.Configurations;

public class AssignmentConfiguration : IEntityTypeConfiguration<Assignment>
{
    public void Configure(EntityTypeBuilder<Assignment> builder)
    {
        builder.HasKey(a => a.Id);

        builder.Property(a => a.Title).HasMaxLength(200).IsRequired();
        builder.Property(a => a.Description).HasMaxLength(10_000).IsRequired();
        builder.Property(a => a.Status).IsRequired();
        builder.Property(a => a.MaxMarks).HasPrecision(6, 2).IsRequired();

        builder.HasOne(a => a.ClassSubject)
            .WithMany(cs => cs.Assignments)
            .HasForeignKey(a => a.ClassSubjectId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(a => a.CreatedByTeacher)
            .WithMany(u => u.CreatedAssignments)
            .HasForeignKey(a => a.CreatedByTeacherId)
            .OnDelete(DeleteBehavior.Restrict);

        // The student-facing list query: published assignments for an offering.
        builder.HasIndex(a => new { a.ClassSubjectId, a.Status })
            .HasDatabaseName("ix_assignments_class_subject_status");

        builder.HasIndex(a => a.Deadline).HasDatabaseName("ix_assignments_deadline");

        builder.HasIndex(a => a.CreatedByTeacherId)
            .HasDatabaseName("ix_assignments_created_by_teacher");

        // Marks must be a positive ceiling. Enforced in the database as well as
        // the service layer, so no code path can write a nonsensical assignment.
        builder.ToTable(t => t.HasCheckConstraint(
            "ck_assignments_max_marks_positive",
            "max_marks > 0"));

        // A published assignment must record when it was published.
        builder.ToTable(t => t.HasCheckConstraint(
            "ck_assignments_published_has_timestamp",
            "status <> 'published' OR published_at IS NOT NULL"));
    }
}

public class SubmissionConfiguration : IEntityTypeConfiguration<Submission>
{
    public void Configure(EntityTypeBuilder<Submission> builder)
    {
        builder.HasKey(s => s.Id);

        builder.Property(s => s.Content).HasMaxLength(50_000).IsRequired();
        builder.Property(s => s.AttachmentUrl).HasMaxLength(2048);
        builder.Property(s => s.Status).IsRequired();
        builder.Property(s => s.Marks).HasPrecision(6, 2);

        builder.HasOne(s => s.Assignment)
            .WithMany(a => a.Submissions)
            .HasForeignKey(s => s.AssignmentId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(s => s.Student)
            .WithMany(u => u.Submissions)
            .HasForeignKey(s => s.StudentId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(s => s.GradedByTeacher)
            .WithMany()
            .HasForeignKey(s => s.GradedByTeacherId)
            .OnDelete(DeleteBehavior.Restrict);

        // One submission per student per assignment. This is the duplicate-
        // submission rule as a database constraint, so two concurrent requests
        // cannot both pass a service-level "does one already exist?" check.
        builder.HasIndex(s => new { s.AssignmentId, s.StudentId })
            .IsUnique()
            .HasFilter("is_deleted = false")
            .HasDatabaseName("ix_submissions_assignment_student_unique");

        builder.HasIndex(s => new { s.AssignmentId, s.Status })
            .HasDatabaseName("ix_submissions_assignment_status");

        builder.HasIndex(s => s.StudentId).HasDatabaseName("ix_submissions_student");

        // Marks cannot be negative. The upper bound depends on the parent
        // assignment's MaxMarks, which a check constraint cannot reference, so
        // the ceiling is enforced in the grading service.
        builder.ToTable(t => t.HasCheckConstraint(
            "ck_submissions_marks_non_negative",
            "marks IS NULL OR marks >= 0"));

        // Graded work must record who graded it and when.
        builder.ToTable(t => t.HasCheckConstraint(
            "ck_submissions_graded_has_grader",
            "status <> 'graded' OR (marks IS NOT NULL AND graded_by_teacher_id IS NOT NULL AND graded_at IS NOT NULL)"));
    }
}

public class SubmissionFeedbackConfiguration : IEntityTypeConfiguration<SubmissionFeedback>
{
    public void Configure(EntityTypeBuilder<SubmissionFeedback> builder)
    {
        builder.HasKey(f => f.Id);

        builder.Property(f => f.Comment).HasMaxLength(5000).IsRequired();
        builder.Property(f => f.MarksAtTime).HasPrecision(6, 2);

        builder.HasOne(f => f.Submission)
            .WithMany(s => s.Feedbacks)
            .HasForeignKey(f => f.SubmissionId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(f => f.Teacher)
            .WithMany()
            .HasForeignKey(f => f.TeacherId)
            .OnDelete(DeleteBehavior.Restrict);

        // Feedback is read as a chronological thread per submission.
        builder.HasIndex(f => new { f.SubmissionId, f.CreatedAt })
            .HasDatabaseName("ix_submission_feedbacks_submission_created");
    }
}
