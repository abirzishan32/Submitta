using AssignmentSystem.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace AssignmentSystem.Infrastructure.Persistence.Configurations;

public class ClassConfiguration : IEntityTypeConfiguration<Class>
{
    public void Configure(EntityTypeBuilder<Class> builder)
    {
        builder.HasKey(c => c.Id);

        builder.Property(c => c.Name).HasMaxLength(150).IsRequired();
        builder.Property(c => c.Code).HasMaxLength(50).IsRequired();
        builder.Property(c => c.Description).HasMaxLength(1000);
        builder.Property(c => c.AcademicYear).HasMaxLength(20);

        builder.HasIndex(c => c.Code)
            .IsUnique()
            .HasFilter("is_deleted = false")
            .HasDatabaseName("ix_classes_code_unique");
    }
}

public class SubjectConfiguration : IEntityTypeConfiguration<Subject>
{
    public void Configure(EntityTypeBuilder<Subject> builder)
    {
        builder.HasKey(s => s.Id);

        builder.Property(s => s.Name).HasMaxLength(150).IsRequired();
        builder.Property(s => s.Code).HasMaxLength(50).IsRequired();
        builder.Property(s => s.Description).HasMaxLength(1000);

        builder.HasIndex(s => s.Code)
            .IsUnique()
            .HasFilter("is_deleted = false")
            .HasDatabaseName("ix_subjects_code_unique");
    }
}

public class ClassSubjectConfiguration : IEntityTypeConfiguration<ClassSubject>
{
    public void Configure(EntityTypeBuilder<ClassSubject> builder)
    {
        builder.HasKey(cs => cs.Id);

        builder.HasOne(cs => cs.Class)
            .WithMany(c => c.ClassSubjects)
            .HasForeignKey(cs => cs.ClassId)
            // Deleting a class that still has offerings would orphan its
            // assignments; block it and require the offerings be removed first.
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(cs => cs.Subject)
            .WithMany(s => s.ClassSubjects)
            .HasForeignKey(cs => cs.SubjectId)
            .OnDelete(DeleteBehavior.Restrict);

        // A subject is offered to a class at most once.
        builder.HasIndex(cs => new { cs.ClassId, cs.SubjectId })
            .IsUnique()
            .HasFilter("is_deleted = false")
            .HasDatabaseName("ix_class_subjects_class_subject_unique");
    }
}

public class EnrollmentConfiguration : IEntityTypeConfiguration<Enrollment>
{
    public void Configure(EntityTypeBuilder<Enrollment> builder)
    {
        builder.HasKey(e => e.Id);

        builder.HasOne(e => e.Student)
            .WithMany(u => u.Enrollments)
            .HasForeignKey(e => e.StudentId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(e => e.Class)
            .WithMany(c => c.Enrollments)
            .HasForeignKey(e => e.ClassId)
            .OnDelete(DeleteBehavior.Restrict);

        // A student is enrolled in a given class at most once.
        builder.HasIndex(e => new { e.StudentId, e.ClassId })
            .IsUnique()
            .HasFilter("is_deleted = false")
            .HasDatabaseName("ix_enrollments_student_class_unique");

        // Drives "which assignments may this student see?".
        builder.HasIndex(e => e.ClassId).HasDatabaseName("ix_enrollments_class");
    }
}

public class TeacherAssignmentConfiguration : IEntityTypeConfiguration<TeacherAssignment>
{
    public void Configure(EntityTypeBuilder<TeacherAssignment> builder)
    {
        builder.HasKey(ta => ta.Id);

        builder.HasOne(ta => ta.Teacher)
            .WithMany(u => u.TeacherAssignments)
            .HasForeignKey(ta => ta.TeacherId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(ta => ta.ClassSubject)
            .WithMany(cs => cs.TeacherAssignments)
            .HasForeignKey(ta => ta.ClassSubjectId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(ta => new { ta.TeacherId, ta.ClassSubjectId })
            .IsUnique()
            .HasFilter("is_deleted = false")
            .HasDatabaseName("ix_teacher_assignments_teacher_class_subject_unique");

        // Read on every teacher-side permission check.
        builder.HasIndex(ta => ta.ClassSubjectId)
            .HasDatabaseName("ix_teacher_assignments_class_subject");
    }
}
