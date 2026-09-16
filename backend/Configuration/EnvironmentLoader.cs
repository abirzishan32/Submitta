namespace AssignmentSystem.Api.Configuration;

/// <summary>
/// Loads <c>backend/.env</c> into process environment variables at startup.
///
/// .NET has no built-in .env support, but environment variables are already the
/// highest-priority configuration source, so loading the file first lets keys
/// like <c>ConnectionStrings__DefaultConnection</c> and <c>Jwt__Key</c> flow
/// through <see cref="Microsoft.Extensions.Configuration.IConfiguration"/>
/// normally — while keeping secrets out of appsettings.json and out of git.
/// </summary>
public static class EnvironmentLoader
{
    private const string FileName = ".env";

    /// <summary>
    /// Walks up from the running assembly looking for a .env file. This keeps
    /// `dotnet run` working from the solution root, the Api project directory,
    /// or an IDE with its own working directory.
    /// </summary>
    public static void Load()
    {
        var path = FindUpwards(AppContext.BaseDirectory)
                   ?? FindUpwards(Directory.GetCurrentDirectory());

        if (path is null)
        {
            // Not an error: in production, configuration usually comes from real
            // environment variables rather than a file.
            Console.WriteLine($"[config] No {FileName} found; relying on environment variables.");
            return;
        }

        DotNetEnv.Env.Load(path, new DotNetEnv.LoadOptions(
            setEnvVars: true,
            clobberExistingVars: false, // a real env var always wins over the file
            onlyExactPath: true));

        Console.WriteLine($"[config] Loaded environment from {path}");
    }

    private static string? FindUpwards(string startDirectory)
    {
        var directory = new DirectoryInfo(startDirectory);

        while (directory is not null)
        {
            var candidate = Path.Combine(directory.FullName, FileName);
            if (File.Exists(candidate))
            {
                return candidate;
            }

            directory = directory.Parent;
        }

        return null;
    }
}
