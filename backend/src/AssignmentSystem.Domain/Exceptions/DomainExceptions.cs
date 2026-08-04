namespace AssignmentSystem.Domain.Exceptions;

/// <summary>
/// Base for every expected failure raised by the domain or application layers.
/// The API's exception middleware translates these into HTTP status codes, which
/// keeps controllers free of try/catch and status-code plumbing.
/// </summary>
public abstract class DomainException(string message) : Exception(message)
{
    /// <summary>Stable, machine-readable code returned to the client.</summary>
    public abstract string ErrorCode { get; }
}

/// <summary>Requested resource does not exist (or is soft-deleted). Maps to 404.</summary>
public sealed class NotFoundException(string resource, object key)
    : DomainException($"{resource} '{key}' was not found.")
{
    public override string ErrorCode => "not_found";
}

/// <summary>
/// The caller is authenticated but not permitted to touch this specific resource.
/// Maps to 403. Distinct from role checks, which the framework rejects earlier.
/// </summary>
public sealed class ForbiddenException(string message = "You are not allowed to perform this action.")
    : DomainException(message)
{
    public override string ErrorCode => "forbidden";
}

/// <summary>
/// The request collides with existing state — a duplicate submission, a
/// reused email, a subject already offered in a class. Maps to 409.
/// </summary>
public sealed class ConflictException(string message) : DomainException(message)
{
    public override string ErrorCode => "conflict";
}

/// <summary>
/// A business rule rejected the request: past deadline, marks above the maximum,
/// submitting to a draft. Maps to 422 so it is distinguishable from a malformed
/// request body (400).
/// </summary>
public sealed class BusinessRuleException(string message) : DomainException(message)
{
    public override string ErrorCode => "business_rule_violation";
}

/// <summary>Credentials rejected, or a token is missing/expired/revoked. Maps to 401.</summary>
public sealed class UnauthorizedException(string message = "Authentication failed.")
    : DomainException(message)
{
    public override string ErrorCode => "unauthorized";
}
