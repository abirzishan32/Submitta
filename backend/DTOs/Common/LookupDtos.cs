namespace AssignmentSystem.Application.Common.Models;

/// <summary>
/// A class-subject offering reduced to what a picker needs.
///
/// Exists because the admin offerings endpoint is admin-only, while a teacher
/// still has to choose an offering when creating an assignment — they need
/// their own, not everyone's.
/// </summary>
public sealed record OfferingOptionDto(
    Guid ClassSubjectId,
    Guid ClassId,
    string ClassName,
    string ClassCode,
    Guid SubjectId,
    string SubjectName,
    string SubjectCode,
    int EnrolledStudentCount)
{
    /// <summary>Ready-made label, so every client renders offerings identically.</summary>
    public string Label => $"{ClassCode} · {SubjectName}";
}

/// <summary>A class the caller is connected to, for filter dropdowns.</summary>
public sealed record ClassOptionDto(
    Guid ClassId,
    string ClassName,
    string ClassCode,
    string? AcademicYear);

/// <summary>A subject the caller is connected to, for filter dropdowns.</summary>
public sealed record SubjectOptionDto(
    Guid SubjectId,
    string SubjectName,
    string SubjectCode);
