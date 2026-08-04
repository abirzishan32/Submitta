using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using AssignmentSystem.Application.Common.Interfaces;
using AssignmentSystem.Domain.Entities;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace AssignmentSystem.Infrastructure.Security;

/// <summary>
/// Issues HMAC-SHA256 signed access tokens and random refresh tokens.
/// </summary>
public sealed class JwtTokenService(
    IOptions<JwtOptions> options,
    IDateTimeProvider dateTime) : ITokenService
{
    private readonly JwtOptions _options = options.Value;

    public AccessToken CreateAccessToken(User user)
    {
        var now = dateTime.UtcNow;
        var expiresAt = now.AddMinutes(_options.AccessTokenMinutes);

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.Email, user.Email),
            new(ClaimTypes.Name, user.FullName),

            // The role the whole authorization system trusts. It is safe to
            // trust only because the signature below makes it unforgeable.
            new(ClaimTypes.Role, user.Role.ToString()),

            // Unique token id, so an individual token could be denylisted.
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            new(JwtRegisteredClaimNames.Iat,
                now.ToUnixTimeSeconds().ToString(),
                ClaimValueTypes.Integer64)
        };

        var credentials = new SigningCredentials(
            new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_options.Key)),
            SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: _options.Issuer,
            audience: _options.Audience,
            claims: claims,
            notBefore: now.UtcDateTime,
            expires: expiresAt.UtcDateTime,
            signingCredentials: credentials);

        return new AccessToken(new JwtSecurityTokenHandler().WriteToken(token), expiresAt);
    }

    public RefreshTokenPair CreateRefreshToken()
    {
        // 256 bits from a cryptographic RNG — not guessable, and not derived from
        // anything about the user.
        var raw = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));

        return new RefreshTokenPair(
            raw,
            HashRefreshToken(raw),
            dateTime.UtcNow.AddDays(_options.RefreshTokenDays));
    }

    /// <summary>
    /// Plain SHA-256, deliberately: unlike a password, a refresh token is
    /// already 256 bits of entropy, so there is nothing to brute-force and a slow
    /// KDF would only add latency to every refresh.
    /// </summary>
    public string HashRefreshToken(string rawToken) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(rawToken)));
}
