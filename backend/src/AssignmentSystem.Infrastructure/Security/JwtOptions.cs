using System.ComponentModel.DataAnnotations;

namespace AssignmentSystem.Infrastructure.Security;

/// <summary>
/// JWT signing and lifetime settings, bound from the "Jwt" configuration section
/// and validated at startup so a misconfigured key fails immediately rather than
/// on the first login attempt.
/// </summary>
public sealed class JwtOptions
{
    public const string SectionName = "Jwt";

    /// <summary>
    /// HMAC-SHA256 signing key. Must be at least 32 bytes: a shorter key weakens
    /// the signature below the hash size, and the .NET handler rejects it anyway.
    /// </summary>
    [Required(AllowEmptyStrings = false)]
    [MinLength(32, ErrorMessage = "Jwt:Key must be at least 32 characters (256 bits).")]
    public string Key { get; init; } = string.Empty;

    [Required(AllowEmptyStrings = false)]
    public string Issuer { get; init; } = "AssignmentSystem.Api";

    [Required(AllowEmptyStrings = false)]
    public string Audience { get; init; } = "AssignmentSystem.Client";

    /// <summary>
    /// Access token lifetime. Deliberately short: an access token cannot be
    /// revoked once signed, so a compromised one should expire quickly. The
    /// refresh token covers the longer session.
    /// </summary>
    [Range(1, 1440)]
    public int AccessTokenMinutes { get; init; } = 15;

    [Range(1, 90)]
    public int RefreshTokenDays { get; init; } = 7;
}
