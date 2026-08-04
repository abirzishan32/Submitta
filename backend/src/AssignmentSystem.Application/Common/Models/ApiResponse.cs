using System.Text.Json.Serialization;

namespace AssignmentSystem.Application.Common.Models;

/// <summary>
/// Uniform envelope for every API response, success or failure, so the frontend
/// only ever has to parse one shape.
///
/// The failure-only fields are omitted when null, which keeps a successful
/// response free of four empty properties. Payload DTOs do the opposite and
/// always write their nulls — see the JSON options in Program.cs.
/// </summary>
public class ApiResponse
{
    public bool Success { get; init; }

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Message { get; init; }

    /// <summary>Stable error code (see <c>DomainException.ErrorCode</c>). Null on success.</summary>
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? ErrorCode { get; init; }

    /// <summary>Field-level validation failures, keyed by property name.</summary>
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public IDictionary<string, string[]>? Errors { get; init; }

    /// <summary>Correlates a response with its log entry when something goes wrong.</summary>
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? TraceId { get; init; }

    public static ApiResponse Ok(string? message = null) =>
        new() { Success = true, Message = message };

    public static ApiResponse Fail(
        string message,
        string? errorCode = null,
        IDictionary<string, string[]>? errors = null,
        string? traceId = null) =>
        new()
        {
            Success = false,
            Message = message,
            ErrorCode = errorCode,
            Errors = errors,
            TraceId = traceId
        };
}

/// <inheritdoc cref="ApiResponse"/>
public sealed class ApiResponse<T> : ApiResponse
{
    public T? Data { get; init; }

    public static ApiResponse<T> Ok(T data, string? message = null) =>
        new() { Success = true, Data = data, Message = message };

    public static new ApiResponse<T> Fail(
        string message,
        string? errorCode = null,
        IDictionary<string, string[]>? errors = null,
        string? traceId = null) =>
        new()
        {
            Success = false,
            Message = message,
            ErrorCode = errorCode,
            Errors = errors,
            TraceId = traceId
        };
}
