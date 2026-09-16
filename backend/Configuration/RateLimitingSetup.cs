using System.Threading.RateLimiting;
using System.Text.Json;
using AssignmentSystem.Application.Common.Models;
using Microsoft.AspNetCore.RateLimiting;

namespace AssignmentSystem.Api.Configuration;

/// <summary>
/// Rate limits. Login is the one endpoint an attacker can hammer without
/// credentials, so it gets a tight per-IP budget; everything else gets a loose
/// ceiling that only a runaway client would reach.
/// </summary>
public static class RateLimitingSetup
{
    public const string AuthPolicy = "auth";

    public static IServiceCollection AddApiRateLimiting(this IServiceCollection services)
    {
        services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

            // Ten sign-in attempts per minute per IP. Generous for a person
            // mistyping a password, useless for guessing one.
            options.AddPolicy(AuthPolicy, context =>
                RateLimitPartition.GetFixedWindowLimiter(
                    partitionKey: ClientKey(context),
                    factory: _ => new FixedWindowRateLimiterOptions
                    {
                        PermitLimit = 10,
                        Window = TimeSpan.FromMinutes(1),
                        QueueLimit = 0
                    }));

            options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
                RateLimitPartition.GetFixedWindowLimiter(
                    partitionKey: ClientKey(context),
                    factory: _ => new FixedWindowRateLimiterOptions
                    {
                        PermitLimit = 300,
                        Window = TimeSpan.FromMinutes(1),
                        QueueLimit = 0
                    }));

            // Answer in the same envelope as every other failure.
            options.OnRejected = async (context, ct) =>
            {
                if (context.HttpContext.Response.HasStarted)
                {
                    return;
                }

                if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
                {
                    context.HttpContext.Response.Headers.RetryAfter =
                        ((int)retryAfter.TotalSeconds).ToString();
                }

                context.HttpContext.Response.ContentType = "application/json";

                await context.HttpContext.Response.WriteAsync(
                    JsonSerializer.Serialize(
                        ApiResponse.Fail(
                            "Too many requests. Please wait a moment and try again.",
                            "rate_limited",
                            traceId: context.HttpContext.TraceIdentifier),
                        new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase }),
                    ct);
            };
        });

        return services;
    }

    /// <summary>
    /// Partition by authenticated user where possible, falling back to client IP.
    /// Behind a proxy the socket address is the proxy's, so the forwarded header
    /// is preferred.
    /// </summary>
    private static string ClientKey(HttpContext context)
    {
        if (context.User.Identity?.IsAuthenticated == true)
        {
            return $"user:{context.User.Identity.Name ?? "unknown"}";
        }

        var forwarded = context.Request.Headers["X-Forwarded-For"].ToString();

        var ip = !string.IsNullOrWhiteSpace(forwarded)
            ? forwarded.Split(',')[0].Trim()
            : context.Connection.RemoteIpAddress?.ToString() ?? "unknown";

        return $"ip:{ip}";
    }
}
