using AssignmentSystem.Infrastructure.Persistence.Seeding;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace AssignmentSystem.Infrastructure.Persistence;

/// <summary>
/// Applies pending migrations and seeds demo data at startup.
///
/// The brief requires that an evaluator can set the database up without creating
/// tables by hand, so this runs automatically: clone, set the connection string,
/// `dotnet run`, and the schema and demo accounts exist.
/// </summary>
public static class DatabaseInitializer
{
    public static async Task InitializeAsync(IServiceProvider services, CancellationToken ct = default)
    {
        using var scope = services.CreateScope();
        var provider = scope.ServiceProvider;

        var logger = provider.GetRequiredService<ILoggerFactory>()
            .CreateLogger(typeof(DatabaseInitializer));
        var configuration = provider.GetRequiredService<IConfiguration>();
        var context = provider.GetRequiredService<AppDbContext>();

        try
        {
            var pending = (await context.Database.GetPendingMigrationsAsync(ct)).ToArray();

            if (pending.Length > 0)
            {
                logger.LogInformation("Applying {Count} pending migration(s): {Migrations}",
                    pending.Length, string.Join(", ", pending));
                await context.Database.MigrateAsync(ct);
            }
            else
            {
                logger.LogInformation("Database schema is up to date.");
            }

            await HardenAsync(context, logger, ct);

            if (!configuration.GetValue("Seed:Enabled", true))
            {
                logger.LogInformation("Seeding disabled by configuration.");
                return;
            }

            var password = configuration["Seed:DefaultPassword"];

            if (string.IsNullOrWhiteSpace(password))
            {
                // Falling back to a hardcoded password would put a known
                // credential on every deployment that forgot to set one.
                logger.LogWarning(
                    "Seed:DefaultPassword is not set — skipping seeding. "
                    + "Set Seed__DefaultPassword in backend/.env to seed demo accounts.");
                return;
            }

            var seeder = provider.GetRequiredService<DatabaseSeeder>();
            await seeder.SeedAsync(password, ct);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Database initialisation failed.");
            throw;
        }
    }

    /// <summary>
    /// Enables Row-Level Security across the <c>public</c> schema.
    /// </summary>
    /// <remarks>
    /// Run on every start rather than once in a migration, so a table added by
    /// a later migration cannot quietly ship without protection. It is cheap:
    /// one catalogue scan, and tables that already have RLS are skipped.
    /// </remarks>
    private static async Task HardenAsync(
        AppDbContext context, ILogger logger, CancellationToken ct)
    {
        // PostgreSQL only. A different provider has no such REST surface, and
        // the catalogue queries would not parse.
        if (!context.Database.IsNpgsql()) return;

        var connection = context.Database.GetDbConnection();

        if (connection.State != System.Data.ConnectionState.Open)
        {
            await context.Database.OpenConnectionAsync(ct);
        }

        try
        {
            if (await ScalarAsync<long>(connection, PublicSchemaHardening.UnprotectedCountSql, ct) == 0)
            {
                return;
            }

            // Checked first, because being locked out by RLS is silent: a role
            // subject to it with no policies gets zero rows, not an error. It
            // is far better to leave the schema as it is and say so loudly than
            // to bring the application up reading nothing.
            if (!await ScalarAsync<bool>(connection, PublicSchemaHardening.CanSafelyEnableSql, ct))
            {
                logger.LogWarning(
                    "Row-Level Security was NOT enabled: the database user does not own these "
                    + "tables and does not bypass RLS, so enabling it would make every query "
                    + "return nothing. Connect as the role that owns the schema, or enable RLS "
                    + "by hand. Until then the public schema is reachable by any REST client "
                    + "your database host exposes.");
                return;
            }

            await context.Database.ExecuteSqlRawAsync(PublicSchemaHardening.HardenSql, ct);

            var remaining = await ScalarAsync<long>(
                connection, PublicSchemaHardening.UnprotectedCountSql, ct);

            logger.LogInformation(
                "Row-Level Security enabled across the public schema ({Remaining} table(s) "
                + "still unprotected).", remaining);
        }
        catch (Exception ex)
        {
            // A managed host may withhold the rights to alter grants. Worth
            // reporting, never worth refusing to start over.
            logger.LogWarning(ex, "Could not harden the public schema.");
        }
    }

    private static async Task<T> ScalarAsync<T>(
        System.Data.Common.DbConnection connection, string sql, CancellationToken ct)
    {
        await using var command = connection.CreateCommand();
        command.CommandText = sql;

        var result = await command.ExecuteScalarAsync(ct);
        return (T)Convert.ChangeType(result!, typeof(T))!;
    }
}
