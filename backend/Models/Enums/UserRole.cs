namespace AssignmentSystem.Domain.Enums;

/// <summary>
/// The three roles defined by the requirements. Stored as a native PostgreSQL
/// enum (<c>user_role</c>) rather than a lookup table: the set is fixed, there
/// is no runtime role management in scope, and it maps directly onto
/// <c>[Authorize(Roles = ...)]</c>.
/// </summary>
public enum UserRole
{
    Admin = 1,
    Teacher = 2,
    Student = 3
}
