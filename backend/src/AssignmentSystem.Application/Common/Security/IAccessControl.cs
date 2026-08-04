namespace AssignmentSystem.Application.Common.Security;

/// <summary>
/// Resource-level authorization: not "is this caller a Teacher?" but "is this
/// caller the teacher of <em>this</em> offering?".
///
/// Role attributes on a controller cannot answer that — the answer depends on
/// data. Every teacher- and student-scoped operation routes through here, so a
/// teacher cannot reach another teacher's class and a student cannot reach
/// another student's submission.
///
/// The <c>Ensure*</c> methods throw <see cref="Domain.Exceptions.ForbiddenException"/>
/// rather than returning false, so a caller that forgets to check the result
/// still fails closed.
/// </summary>
public interface IAccessControl
{
    /// <summary>True when the caller is an Admin, who may read and manage everything.</summary>
    bool IsAdmin { get; }

    /// <summary>Whether the caller teaches this class-subject offering.</summary>
    Task<bool> IsTeacherOfAsync(Guid classSubjectId, CancellationToken ct = default);

    /// <summary>Whether the caller is enrolled in the class this offering belongs to.</summary>
    Task<bool> IsEnrolledInOfferingAsync(Guid classSubjectId, CancellationToken ct = default);

    /// <summary>
    /// Admin, or the teacher assigned to this offering. Used for creating,
    /// editing and grading work within it.
    /// </summary>
    Task EnsureCanManageOfferingAsync(Guid classSubjectId, CancellationToken ct = default);

    /// <summary>
    /// Admin, the teacher of the assignment's offering, or a student enrolled in
    /// it. Read access only.
    /// </summary>
    Task EnsureCanViewAssignmentAsync(Guid assignmentId, CancellationToken ct = default);

    /// <summary>
    /// Admin, the teacher of the parent assignment's offering, or the student who
    /// wrote it. This is what stops one student reading another's work.
    /// </summary>
    Task EnsureCanViewSubmissionAsync(Guid submissionId, CancellationToken ct = default);
}
