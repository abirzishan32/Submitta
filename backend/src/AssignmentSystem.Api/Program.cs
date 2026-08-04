using System.Text.Json.Serialization;
using Asp.Versioning;
using AssignmentSystem.Api.Configuration;
using AssignmentSystem.Api.Filters;
using AssignmentSystem.Api.Middleware;
using AssignmentSystem.Api.Services;
using AssignmentSystem.Application;
using AssignmentSystem.Application.Common.Interfaces;
using AssignmentSystem.Infrastructure;
using AssignmentSystem.Infrastructure.Persistence;
using Serilog;

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
// Load backend/.env into the environment before the host reads configuration,
// so ConnectionStrings__DefaultConnection and Jwt__Key resolve through the
// standard IConfiguration pipeline. Secrets stay out of appsettings.json.
EnvironmentLoader.Load();

var builder = WebApplication.CreateBuilder(args);

builder.Host.UseSerilog((context, services, configuration) => configuration
    .ReadFrom.Configuration(context.Configuration)
    .ReadFrom.Services(services)
    .Enrich.FromLogContext());

// ---------------------------------------------------------------------------
// Services
// ---------------------------------------------------------------------------
builder.Services
    .AddControllers(options => options.Filters.Add<ValidationFilter>())
    .AddJsonOptions(options =>
    {
        // Serialise enums as names ("Published") rather than integers, so API
        // consumers and Swagger both read meaningfully.
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());

        // Null properties are written explicitly rather than omitted. A grading
        // client has to be able to tell "not yet marked" (marks: null) from a
        // field that is missing, and explicit nulls keep the generated
        // TypeScript types honest instead of making every field optional.
        // The response envelope opts out individually — see ApiResponse.
    });

builder.Services.AddApiVersioning(options =>
    {
        options.DefaultApiVersion = new ApiVersion(1, 0);
        options.AssumeDefaultVersionWhenUnspecified = true;
        options.ReportApiVersions = true;
        options.ApiVersionReader = new UrlSegmentApiVersionReader();
    })
    .AddApiExplorer(options =>
    {
        options.GroupNameFormat = "'v'VVV";
        options.SubstituteApiVersionInUrl = true;
    });

builder.Services.AddSwaggerDocumentation();

builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUser, CurrentUser>();

builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);

builder.Services.AddJwtAuthentication(builder.Configuration, builder.Environment);

var corsOrigins = builder.Configuration
    .GetSection("Cors:AllowedOrigins")
    .Get<string[]>() ?? ["http://localhost:3000"];

builder.Services.AddCors(options =>
    options.AddPolicy("Frontend", policy => policy
        .WithOrigins(corsOrigins)
        .AllowAnyHeader()
        .AllowAnyMethod()
        .AllowCredentials()));

builder.Services.AddApiRateLimiting();
builder.Services.AddResponseCompression(options => options.EnableForHttps = true);
builder.Services.AddProblemDetails();

var app = builder.Build();

// Apply migrations and seed demo data before serving traffic, so a fresh clone
// needs no manual database setup.
await DatabaseInitializer.InitializeAsync(app.Services);

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------
// Exception handling goes first so it wraps everything downstream.
app.UseMiddleware<ExceptionHandlingMiddleware>();
app.UseMiddleware<SecurityHeadersMiddleware>();

app.UseResponseCompression();
app.UseSerilogRequestLogging();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(options =>
    {
        options.SwaggerEndpoint("/swagger/v1/swagger.json", "Submitta API v1");
        options.DocumentTitle = "Assignment & Submission Management API";
        options.DisplayRequestDuration();
    });
}
else
{
    app.UseHttpsRedirection();
}

app.UseCors("Frontend");

// Order matters: identity must be established before it can be authorized.
app.UseAuthentication();
app.UseAuthorization();

// After authentication, so an authenticated caller is partitioned by user
// rather than sharing a bucket with everyone behind the same IP.
app.UseRateLimiter();

app.MapControllers();

// Explicitly anonymous: the fallback authorization policy applies to every
// endpoint, and a health check that needs a bearer token is no use to a load
// balancer or a container probe.
app.MapGet("/health", () => Results.Ok(new { status = "healthy", timestamp = DateTimeOffset.UtcNow }))
   .AllowAnonymous()
   .WithTags("Health")
   .ExcludeFromDescription();

app.Run();

/// <summary>
/// Exposed so an integration-test host can reference this entry point.
/// </summary>
public partial class Program;
