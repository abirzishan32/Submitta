using System.Net;
using System.Text.Json;
using AssignmentSystem.Application.Common.Interfaces;
using AssignmentSystem.Application.Common.Models;
using AssignmentSystem.Domain.Exceptions;
using FluentValidation;

namespace AssignmentSystem.Api.Middleware;

/// <summary>
/// Single place where exceptions become HTTP responses. Controllers and services
/// throw meaningful exceptions; this translates them, so no controller needs a
/// try/catch and no service needs to know about status codes.
/// </summary>
public sealed class ExceptionHandlingMiddleware(
    RequestDelegate next,
    ILogger<ExceptionHandlingMiddleware> logger,
    IHostEnvironment environment,
    IDatabaseErrorTranslator databaseErrors)
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (Exception ex)
        {
            await HandleAsync(context, ex);
        }
    }

    private async Task HandleAsync(HttpContext context, Exception originalException)
    {
        var traceId = context.TraceIdentifier;

        // A constraint violation is an expected outcome that happened to be
        // caught by the database rather than by the service check in front of
        // it — a lost race, not a fault. Translating it here means it flows
        // through the same mapping as if the service had rejected it, so the
        // caller sees one consistent answer regardless of which layer noticed.
        //
        // The original is kept for logging: the translated exception explains
        // what the client should be told, while the raw driver error is what a
        // developer needs when the cause is not a race after all.
        var exception = databaseErrors.Translate(originalException) ?? originalException;

        var (status, response) = exception switch
        {
            // FluentValidation failures carry per-field detail, so surface it.
            ValidationException validation => (
                HttpStatusCode.BadRequest,
                ApiResponse.Fail(
                    "One or more validation errors occurred.",
                    "validation_failed",
                    validation.Errors
                        .GroupBy(e => e.PropertyName)
                        .ToDictionary(g => g.Key, g => g.Select(e => e.ErrorMessage).ToArray()),
                    traceId)),

            NotFoundException e      => (HttpStatusCode.NotFound, Fail(e, traceId)),
            ForbiddenException e     => (HttpStatusCode.Forbidden, Fail(e, traceId)),
            ConflictException e      => (HttpStatusCode.Conflict, Fail(e, traceId)),
            UnauthorizedException e  => (HttpStatusCode.Unauthorized, Fail(e, traceId)),
            BusinessRuleException e  => (HttpStatusCode.UnprocessableEntity, Fail(e, traceId)),

            OperationCanceledException => (HttpStatusCode.RequestTimeout,
                ApiResponse.Fail("The request was cancelled.", "request_cancelled", traceId: traceId)),

            // Anything unanticipated: log the detail, return a generic message.
            _ => (HttpStatusCode.InternalServerError, ApiResponse.Fail(
                environment.IsDevelopment()
                    ? exception.Message
                    : "An unexpected error occurred. Please try again.",
                "internal_error",
                traceId: traceId))
        };

        if (status == HttpStatusCode.InternalServerError)
        {
            logger.LogError(originalException,
                "Unhandled exception on {Method} {Path} (trace {TraceId})",
                context.Request.Method, context.Request.Path, traceId);
        }
        else if (!ReferenceEquals(exception, originalException))
        {
            // Translated from a database error. Logged at warning with the
            // original attached: the request was answered correctly, but a
            // constraint firing repeatedly points at a check that is racing
            // more often than it should.
            logger.LogWarning(originalException,
                "Database constraint translated to {ErrorType} on {Method} {Path} (trace {TraceId})",
                exception.GetType().Name, context.Request.Method, context.Request.Path, traceId);
        }
        else
        {
            // Expected outcomes — a student missing a deadline is not an error.
            logger.LogInformation(
                "Request rejected on {Method} {Path}: {ErrorType} — {Message} (trace {TraceId})",
                context.Request.Method, context.Request.Path,
                exception.GetType().Name, exception.Message, traceId);
        }

        // If the response has already started we cannot rewrite it.
        if (context.Response.HasStarted)
        {
            logger.LogWarning("Response already started; cannot write error body for trace {TraceId}", traceId);
            return;
        }

        context.Response.Clear();
        context.Response.StatusCode = (int)status;
        context.Response.ContentType = "application/json";
        await context.Response.WriteAsync(JsonSerializer.Serialize(response, JsonOptions));
    }

    private static ApiResponse Fail(DomainException e, string traceId) =>
        ApiResponse.Fail(e.Message, e.ErrorCode, traceId: traceId);
}
