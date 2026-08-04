using System.Text;
using System.Text.Json;
using AssignmentSystem.Application.Common.Models;
using AssignmentSystem.Domain.Enums;
using AssignmentSystem.Infrastructure.Security;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;

namespace AssignmentSystem.Api.Configuration;

/// <summary>Role names used by <c>[Authorize(Policy = ...)]</c>.</summary>
public static class Policies
{
    public const string AdminOnly = nameof(AdminOnly);
    public const string TeacherOnly = nameof(TeacherOnly);
    public const string StudentOnly = nameof(StudentOnly);
    public const string AdminOrTeacher = nameof(AdminOrTeacher);
}

public static class AuthenticationSetup
{
    public static IServiceCollection AddJwtAuthentication(
        this IServiceCollection services,
        IConfiguration configuration,
        IWebHostEnvironment environment)
    {
        services.AddOptions<JwtOptions>()
            .Bind(configuration.GetSection(JwtOptions.SectionName))
            .ValidateDataAnnotations()
            // Fail at startup rather than on the first login, so a missing or
            // too-short signing key is impossible to deploy unnoticed.
            .ValidateOnStart();

        var jwt = configuration.GetSection(JwtOptions.SectionName).Get<JwtOptions>()
                  ?? new JwtOptions();

        if (string.IsNullOrWhiteSpace(jwt.Key) && !environment.IsDevelopment())
        {
            throw new InvalidOperationException(
                "Jwt:Key is not configured. Set Jwt__Key in the environment before running "
                + "outside Development. See backend/.env.example.");
        }

        services
            .AddAuthentication(options =>
            {
                options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
                options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
            })
            .AddJwtBearer(options =>
            {
                options.RequireHttpsMetadata = !environment.IsDevelopment();
                options.SaveToken = true;

                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = true,
                    ValidIssuer = jwt.Issuer,

                    ValidateAudience = true,
                    ValidAudience = jwt.Audience,

                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.Key)),

                    ValidateLifetime = true,
                    // No grace period. The default five-minute skew would keep
                    // expired tokens working well past their stated lifetime.
                    ClockSkew = TimeSpan.Zero
                };

                // Emit the same ApiResponse envelope as everything else, so the
                // frontend never has to special-case auth failures.
                options.Events = new JwtBearerEvents
                {
                    OnChallenge = async context =>
                    {
                        context.HandleResponse();

                        if (context.Response.HasStarted)
                        {
                            return;
                        }

                        context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                        context.Response.ContentType = "application/json";

                        await context.Response.WriteAsync(Serialize(ApiResponse.Fail(
                            context.AuthenticateFailure is not null
                                ? "Your session is invalid or has expired."
                                : "Authentication is required to access this resource.",
                            "unauthorized",
                            traceId: context.HttpContext.TraceIdentifier)));
                    },

                    OnForbidden = async context =>
                    {
                        if (context.Response.HasStarted)
                        {
                            return;
                        }

                        context.Response.StatusCode = StatusCodes.Status403Forbidden;
                        context.Response.ContentType = "application/json";

                        await context.Response.WriteAsync(Serialize(ApiResponse.Fail(
                            "Your role does not permit this action.",
                            "forbidden",
                            traceId: context.HttpContext.TraceIdentifier)));
                    }
                };
            });

        services.AddAuthorizationBuilder()
            .AddPolicy(Policies.AdminOnly, p =>
                p.RequireRole(nameof(UserRole.Admin)))
            .AddPolicy(Policies.TeacherOnly, p =>
                p.RequireRole(nameof(UserRole.Teacher)))
            .AddPolicy(Policies.StudentOnly, p =>
                p.RequireRole(nameof(UserRole.Student)))
            .AddPolicy(Policies.AdminOrTeacher, p =>
                p.RequireRole(nameof(UserRole.Admin), nameof(UserRole.Teacher)))
            // Every endpoint requires authentication unless it opts out with
            // [AllowAnonymous] — a forgotten attribute then denies access rather
            // than silently exposing data.
            .SetFallbackPolicy(new Microsoft.AspNetCore.Authorization.AuthorizationPolicyBuilder()
                .RequireAuthenticatedUser()
                .Build());

        return services;
    }

    private static readonly JsonSerializerOptions JsonOptions =
        new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    private static string Serialize(ApiResponse response) =>
        JsonSerializer.Serialize(response, JsonOptions);
}
