using AssignmentSystem.Application.Common.Models;

namespace AssignmentSystem.Application.Features.Admin.Academics;

// --- Classes / courses ------------------------------------------------------

public sealed record ClassDto(
    Guid Id,
    string Name,
    string Code,
    string? Description,
    string? AcademicYear,
    bool IsActive,
    int EnrolledStudentCount,
    int SubjectCount,
    DateTimeOffset CreatedAt);

public sealed record CreateClassRequest(
    string Name, string Code, string? Description, string? AcademicYear);

public sealed record UpdateClassRequest(
    string Name, string Code, string? Description, string? AcademicYear, bool IsActive);

public sealed class ClassListQuery : PaginationQuery
{
    public bool? IsActive { get; set; }
    public string? AcademicYear { get; set; }
}

// --- Subjects ---------------------------------------------------------------

public sealed record SubjectDto(
    Guid Id,
    string Name,
    string Code,
    string? Description,
    bool IsActive,
    int OfferingCount,
    DateTimeOffset CreatedAt);

public sealed record CreateSubjectRequest(string Name, string Code, string? Description);

public sealed record UpdateSubjectRequest(
    string Name, string Code, string? Description, bool IsActive);

public sealed class SubjectListQuery : PaginationQuery
{
    public bool? IsActive { get; set; }
}

// --- Offerings (a subject taught to a class) --------------------------------

public sealed record OfferingDto(
    Guid Id,
    Guid ClassId,
    string ClassName,
    string ClassCode,
    Guid SubjectId,
    string SubjectName,
    string SubjectCode,
    IReadOnlyList<AssignedTeacherDto> Teachers,
    int AssignmentCount);

public sealed record AssignedTeacherDto(
    Guid TeacherAssignmentId,
    Guid TeacherId,
    string TeacherName,
    string TeacherEmail,
    DateTimeOffset AssignedAt);

public sealed record CreateOfferingRequest(Guid ClassId, Guid SubjectId);

public sealed class OfferingListQuery : PaginationQuery
{
    public Guid? ClassId { get; set; }
    public Guid? SubjectId { get; set; }

    /// <summary>Limits results to offerings this teacher is assigned to.</summary>
    public Guid? TeacherId { get; set; }
}

// --- Teacher assignments ----------------------------------------------------

public sealed record AssignTeacherRequest(Guid TeacherId, Guid ClassSubjectId);

// --- Enrolments -------------------------------------------------------------

public sealed record EnrollmentDto(
    Guid Id,
    Guid StudentId,
    string StudentName,
    string StudentEmail,
    Guid ClassId,
    string ClassName,
    string ClassCode,
    DateTimeOffset EnrolledAt);

public sealed record CreateEnrollmentRequest(Guid StudentId, Guid ClassId);

/// <summary>Enrols several students into one class in a single call.</summary>
public sealed record BulkEnrollRequest(Guid ClassId, IReadOnlyList<Guid> StudentIds);

public sealed class EnrollmentListQuery : PaginationQuery
{
    public Guid? ClassId { get; set; }
    public Guid? StudentId { get; set; }
}
