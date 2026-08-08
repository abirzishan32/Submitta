using AssignmentSystem.Domain.Exceptions;

namespace AssignmentSystem.Application.Common.Interfaces;

/// <summary>
/// Turns a persistence failure into the domain exception it actually represents.
///
/// The database is the last line of defence, not just a store. Services check
/// for a duplicate before inserting, but two concurrent requests can both pass
/// that check and only the unique index stops the second — so the index firing
/// is a *conflict*, an expected outcome, not an internal fault. Without this
/// translation the caller receives 500 "an unexpected error occurred" for a
/// situation the API understands perfectly well, and the log fills with
/// unhandled-exception noise for behaviour that is working as designed.
///
/// The abstraction lives here, and the implementation in Infrastructure,
/// because recognising a failure requires provider-specific knowledge — a
/// PostgreSQL SQLSTATE means nothing to SQL Server. Inverting the dependency
/// keeps that detail behind an interface: the API layer translates errors
/// without ever referencing a database driver, and swapping provider means
/// writing one new implementation rather than editing middleware.
/// </summary>
public interface IDatabaseErrorTranslator
{
    /// <summary>
    /// Returns the domain exception this failure corresponds to, or
    /// <see langword="null"/> when it is genuinely unexpected and should be
    /// reported as an internal error.
    /// </summary>
    DomainException? Translate(Exception exception);
}
