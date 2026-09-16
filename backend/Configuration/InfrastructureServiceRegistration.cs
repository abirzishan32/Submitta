using AssignmentSystem.Application.Common.Interfaces;
using AssignmentSystem.Domain.Enums;
using AssignmentSystem.Application.Features.Notifications;
using AssignmentSystem.Infrastructure.Notifications;
using AssignmentSystem.Infrastructure.Persistence;
using AssignmentSystem.Infrastructure.Persistence.Interceptors;
using AssignmentSystem.Infrastructure.Persistence.Seeding;
using AssignmentSystem.Infrastructure.Security;
using AssignmentSystem.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace AssignmentSystem.Infrastructure;

/// <summary>
/// Composition root for the Infrastructure layer: persistence, security
/// primitives and anything else that talks to the outside world.
/// </summary>
public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddSingleton<IDateTimeProvider, DateTimeProvider>();

        // Singleton because it holds no state and the exception middleware
        // resolves its dependencies once, at application start.
        services.AddSingleton<IDatabaseErrorTranslator, PostgresErrorTranslator>();

        services.AddScoped<AuditingSaveChangesInterceptor>();

        var connectionString = ConnectionStringResolver.Resolve(configuration);

        services.AddDbContext<AppDbContext>((serviceProvider, options) =>
        {
            options.UseNpgsql(connectionString, npgsql =>
            {
                npgsql.MapEnum<UserRole>("user_role");
                npgsql.MapEnum<AssignmentStatus>("assignment_status");
                npgsql.MapEnum<SubmissionStatus>("submission_status");
                npgsql.MapEnum<SubmissionEventType>("submission_event_type");

                npgsql.MigrationsHistoryTable("__ef_migrations_history");

                // Supabase runs behind a pooler over the public internet, so a
                // transient network blip should retry rather than surface as a
                // 500 to the student mid-submission.
                npgsql.EnableRetryOnFailure(
                    maxRetryCount: 3,
                    maxRetryDelay: TimeSpan.FromSeconds(5),
                    errorCodesToAdd: null);
            });

            // snake_case tables and columns, so the schema reads naturally in
            // psql and raw SQL needs no quoting.
            options.UseSnakeCaseNamingConvention();

            options.AddInterceptors(
                serviceProvider.GetRequiredService<AuditingSaveChangesInterceptor>());
        });

        // Expose the context through the Application-layer abstraction, so
        // services depend on IAppDbContext rather than on EF directly.
        services.AddScoped<IAppDbContext>(sp => sp.GetRequiredService<AppDbContext>());

        services.AddScoped<IPasswordHasher, BCryptPasswordHasher>();
        services.AddScoped<ITokenService, JwtTokenService>();
        services.AddScoped<DatabaseSeeder>();

        // Singleton: it holds the live connections, so one instance has to
        // outlive the requests that publish through it.
        services.AddSingleton<INotificationStream, InProcessNotificationStream>();
        services.AddHostedService<DeadlineReminderService>();

        return services;
    }
}
