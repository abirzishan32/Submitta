using Microsoft.Extensions.Configuration;
using Npgsql;

namespace AssignmentSystem.Infrastructure.Persistence;

/// <summary>
/// Resolves the PostgreSQL connection string from configuration, accepting both
/// the ADO.NET keyword format and the <c>postgresql://</c> URI that Supabase,
/// Heroku and Railway hand out.
///
/// Npgsql only understands the keyword format, so the URI is converted here
/// rather than making whoever sets up the project reformat it by hand.
/// </summary>
public static class ConnectionStringResolver
{
    /// <summary>
    /// Configuration keys checked in order. The first non-empty value wins, so
    /// an explicit ConnectionStrings entry always beats the Supabase fallbacks.
    /// </summary>
    private static readonly string[] CandidateKeys =
    [
        "ConnectionStrings:DefaultConnection",
        "SUPABASE_SESSION_POOLER",
        "SUPABASE_DB_URL",
        "DATABASE_URL"
    ];

    public static string Resolve(IConfiguration configuration)
    {
        foreach (var key in CandidateKeys)
        {
            var value = configuration[key];
            if (!string.IsNullOrWhiteSpace(value))
            {
                return Normalize(value.Trim().Trim('"', '\''));
            }
        }

        throw new InvalidOperationException(
            "No database connection string found. Set ConnectionStrings__DefaultConnection " +
            "or SUPABASE_SESSION_POOLER in backend/.env — see backend/.env.example.");
    }

    /// <summary>
    /// Converts a postgres URI into Npgsql keyword form, and leaves an already
    /// keyword-formatted string alone apart from enforcing TLS.
    /// </summary>
    public static string Normalize(string connectionString)
    {
        if (!IsPostgresUri(connectionString))
        {
            return EnsureTls(connectionString);
        }

        var uri = new Uri(connectionString);
        var userInfo = uri.UserInfo.Split(':', 2);

        var builder = new NpgsqlConnectionStringBuilder
        {
            Host = uri.Host,
            Port = uri.Port > 0 ? uri.Port : 5432,
            Database = uri.AbsolutePath.TrimStart('/') is { Length: > 0 } db ? db : "postgres",
            // Credentials arrive percent-encoded in a URI; passwords frequently
            // contain characters that require it.
            Username = Uri.UnescapeDataString(userInfo[0]),
            Password = userInfo.Length > 1 ? Uri.UnescapeDataString(userInfo[1]) : null
        };

        // A URI may carry ?sslmode=..., which the caller meant.
        var explicitSslMode = ParseSslModeFromQuery(uri.Query);

        ApplyDefaults(builder, explicitSslMode);
        return builder.ConnectionString;
    }

    private static bool IsPostgresUri(string value) =>
        value.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase) ||
        value.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase);

    private static string EnsureTls(string keywordConnectionString)
    {
        var builder = new NpgsqlConnectionStringBuilder(keywordConnectionString);

        // Respect an SSL Mode the caller wrote themselves.
        var explicitSslMode = keywordConnectionString.Contains("ssl", StringComparison.OrdinalIgnoreCase)
            ? builder.SslMode
            : (SslMode?)null;

        ApplyDefaults(builder, explicitSslMode);
        return builder.ConnectionString;
    }

    private static void ApplyDefaults(NpgsqlConnectionStringBuilder builder, SslMode? explicitSslMode)
    {
        // An explicit choice always wins over the defaults below.
        if (explicitSslMode is { } mode)
        {
            builder.SslMode = mode;
        }
        else if (IsLocalHost(builder.Host))
        {
            // A Docker or locally installed PostgreSQL does not serve TLS by
            // default, and requiring it there would fail the connection outright.
            builder.SslMode = SslMode.Disable;
        }
        else
        {
            // Anything remote — Supabase and friends — must be encrypted.
            // `Require` encrypts without verifying the certificate chain, so setup
            // does not depend on the provider's CA being in the local trust store.
            // A deployment that pins the CA should raise this to VerifyFull.
            builder.SslMode = SslMode.Require;
        }

        // A hosted pooler already multiplexes; a large client-side pool on top of
        // it just burns server-side slots.
        if (builder.MaxPoolSize > 20)
        {
            builder.MaxPoolSize = 20;
        }
    }

    /// <summary>
    /// True for loopback addresses and for bare hostnames such as the "postgres"
    /// service name used inside a Docker Compose network — neither is a public
    /// endpoint, and neither serves TLS out of the box.
    /// </summary>
    private static bool IsLocalHost(string? host) =>
        string.IsNullOrWhiteSpace(host)
        || host is "localhost" or "127.0.0.1" or "::1" or "host.docker.internal"
        || !host.Contains('.');

    private static SslMode? ParseSslModeFromQuery(string query)
    {
        if (string.IsNullOrWhiteSpace(query))
        {
            return null;
        }

        foreach (var pair in query.TrimStart('?').Split('&', StringSplitOptions.RemoveEmptyEntries))
        {
            var parts = pair.Split('=', 2);
            if (parts.Length == 2
                && parts[0].Equals("sslmode", StringComparison.OrdinalIgnoreCase)
                && Enum.TryParse<SslMode>(parts[1].Replace("-", ""), ignoreCase: true, out var mode))
            {
                return mode;
            }
        }

        return null;
    }
}
