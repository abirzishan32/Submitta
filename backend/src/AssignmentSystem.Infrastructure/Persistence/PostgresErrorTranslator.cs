using AssignmentSystem.Application.Common.Interfaces;
using AssignmentSystem.Domain.Exceptions;
using Npgsql;

namespace AssignmentSystem.Infrastructure.Persistence;


public sealed class PostgresErrorTranslator : IDatabaseErrorTranslator
{
    public DomainException? Translate(Exception exception)
    {
        // EF wraps the driver's exception in DbUpdateException, and a retrying
        // execution strategy may wrap that again, so the cause is found by
        // walking the chain rather than by checking InnerException once.
        var postgres = FindPostgresException(exception);

        if (postgres is null)
        {
            return null;
        }

        return postgres.SqlState switch
        {
            // A row that already exists. The service checked first and lost the
            // race; the index is what made the check reliable.
            PostgresErrorCodes.UniqueViolation =>
                new ConflictException(
                    "That record already exists. It may have just been created by "
                    + "another request — reload and try again."),

            // Pointing at something that has since been removed, or was never
            // there. From the caller's side this is a stale reference.
            PostgresErrorCodes.ForeignKeyViolation =>
                new ConflictException(
                    "A referenced record no longer exists. Reload and try again."),

            // A CHECK constraint is the database's copy of a business rule —
            // marks within range, a published assignment carrying a date — so
            // 422 is the honest status, matching how the service layer reports
            // the same rule when it catches it first.
            PostgresErrorCodes.CheckViolation =>
                new BusinessRuleException(
                    "The request breaks a rule enforced by the database and was rejected."),

            PostgresErrorCodes.NotNullViolation =>
                new BusinessRuleException("A required value was missing."),

            // Deliberately not translated: unrecognised codes stay internal
            // errors so real defects remain visible.
            _ => null,
        };
    }

    private static PostgresException? FindPostgresException(Exception? exception)
    {
        for (var current = exception; current is not null; current = current.InnerException)
        {
            if (current is PostgresException postgres)
            {
                return postgres;
            }
        }

        return null;
    }
}
