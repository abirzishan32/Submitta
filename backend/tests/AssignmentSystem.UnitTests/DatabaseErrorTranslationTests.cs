using AssignmentSystem.Domain.Exceptions;
using AssignmentSystem.Infrastructure.Persistence;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace AssignmentSystem.UnitTests;

/// <summary>
/// Translation of database constraint violations into domain exceptions.
///
/// These exist because the database is the last line of defence, not merely a
/// store. A service checks for a duplicate before inserting, but two concurrent
/// requests can both pass that check and only the unique index stops the
/// second — so the index firing is a conflict the API understands, not an
/// internal fault. Without translation the caller receives 500 for a situation
/// that is working exactly as designed.
/// </summary>
public class DatabaseErrorTranslationTests
{
    private static readonly PostgresErrorTranslator Translator = new();

    /// <summary>
    /// Builds a driver exception carrying a specific SQLSTATE, wrapped the way
    /// EF Core delivers it in production.
    /// </summary>
    private static DbUpdateException WrappedPostgresError(string sqlState) =>
        new("An error occurred while saving the entity changes.",
            new PostgresException(
                messageText: "constraint violated",
                severity: "ERROR",
                invariantSeverity: "ERROR",
                sqlState: sqlState));

    // --- Violations that correspond to a rule the API already enforces ------

    [Fact]
    public void A_unique_violation_becomes_a_conflict()
    {
        var translated = Translator.Translate(
            WrappedPostgresError(PostgresErrorCodes.UniqueViolation));

        translated.Should().BeOfType<ConflictException>();
        translated!.ErrorCode.Should().Be("conflict");
    }

    [Fact]
    public void A_foreign_key_violation_becomes_a_conflict()
    {
        Translator.Translate(WrappedPostgresError(PostgresErrorCodes.ForeignKeyViolation))
            .Should().BeOfType<ConflictException>();
    }

    /// <summary>
    /// A CHECK constraint is the database's copy of a business rule — marks
    /// within range, a published assignment carrying a date — so it reports the
    /// same way as when the service layer catches the rule first.
    /// </summary>
    [Fact]
    public void A_check_violation_becomes_a_business_rule_failure()
    {
        var translated = Translator.Translate(
            WrappedPostgresError(PostgresErrorCodes.CheckViolation));

        translated.Should().BeOfType<BusinessRuleException>();
        translated!.ErrorCode.Should().Be("business_rule_violation");
    }

    [Fact]
    public void A_not_null_violation_becomes_a_business_rule_failure()
    {
        Translator.Translate(WrappedPostgresError(PostgresErrorCodes.NotNullViolation))
            .Should().BeOfType<BusinessRuleException>();
    }

    // --- Everything else stays an internal error ---------------------------

    /// <summary>
    /// The important negative case. Translating unrecognised database failures
    /// would dress genuine defects — a syntax error, a dropped connection — as
    /// client mistakes, and they would stop being reported as bugs.
    /// </summary>
    [Fact]
    public void An_unrecognised_sql_state_is_left_as_an_internal_error()
    {
        Translator.Translate(WrappedPostgresError("42601")) // syntax_error
            .Should().BeNull();
    }

    [Fact]
    public void An_exception_unrelated_to_the_database_is_not_translated()
    {
        Translator.Translate(new InvalidOperationException("something else"))
            .Should().BeNull();
    }

    // --- Finding the cause -------------------------------------------------

    /// <summary>
    /// EF wraps the driver's exception, and a retrying execution strategy wraps
    /// that again, so the cause has to be found by walking the chain rather
    /// than by inspecting InnerException once.
    /// </summary>
    [Fact]
    public void The_cause_is_found_however_deeply_it_is_wrapped()
    {
        var deeplyNested = new InvalidOperationException(
            "retry failed",
            WrappedPostgresError(PostgresErrorCodes.UniqueViolation));

        Translator.Translate(deeplyNested).Should().BeOfType<ConflictException>();
    }

    [Fact]
    public void An_unwrapped_driver_exception_is_translated_too()
    {
        var bare = new PostgresException(
            messageText: "duplicate key",
            severity: "ERROR",
            invariantSeverity: "ERROR",
            sqlState: PostgresErrorCodes.UniqueViolation);

        Translator.Translate(bare).Should().BeOfType<ConflictException>();
    }
}
