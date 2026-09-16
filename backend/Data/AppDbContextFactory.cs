using AssignmentSystem.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;

namespace AssignmentSystem.Infrastructure.Persistence;

/// <summary>
/// Lets <c>dotnet ef</c> build a context without starting the API.
///
/// The design-time tools otherwise have to spin up the whole host to find a
/// connection string; this reads backend/.env directly instead, so
/// `dotnet ef migrations add` works from any directory in the solution.
/// </summary>
public class AppDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    public AppDbContext CreateDbContext(string[] args)
    {
        var envPath = FindEnvFile();
        if (envPath is not null)
        {
            DotNetEnv.Env.Load(envPath, new DotNetEnv.LoadOptions(
                setEnvVars: true, clobberExistingVars: false, onlyExactPath: true));
        }

        var configuration = new ConfigurationBuilder()
            .AddEnvironmentVariables()
            .Build();

        var connectionString = ConnectionStringResolver.Resolve(configuration);

        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(connectionString, npgsql =>
            {
                npgsql.MapEnum<UserRole>("user_role");
                npgsql.MapEnum<AssignmentStatus>("assignment_status");
                npgsql.MapEnum<SubmissionStatus>("submission_status");
                npgsql.MapEnum<SubmissionEventType>("submission_event_type");
                npgsql.MigrationsHistoryTable("__ef_migrations_history");
            })
            .UseSnakeCaseNamingConvention()
            .Options;

        return new AppDbContext(options);
    }

    private static string? FindEnvFile()
    {
        var directory = new DirectoryInfo(Directory.GetCurrentDirectory());

        while (directory is not null)
        {
            var candidate = Path.Combine(directory.FullName, ".env");
            if (File.Exists(candidate))
            {
                return candidate;
            }

            directory = directory.Parent;
        }

        return null;
    }
}
