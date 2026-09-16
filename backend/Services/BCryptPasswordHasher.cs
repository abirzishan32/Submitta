using AssignmentSystem.Application.Common.Interfaces;

namespace AssignmentSystem.Infrastructure.Security;

/// <summary>
/// BCrypt password hashing.
///
/// BCrypt is deliberately slow and salts every hash individually, which is what
/// makes a leaked table impractical to attack with rainbow tables or bulk GPU
/// guessing. The salt and work factor are embedded in the output, so raising the
/// work factor later still verifies existing hashes.
/// </summary>
public sealed class BCryptPasswordHasher : IPasswordHasher
{
    /// <summary>
    /// 2^12 iterations — roughly 250 ms on current hardware. Slow enough to make
    /// online guessing futile, fast enough not to be its own denial of service.
    /// </summary>
    private const int WorkFactor = 12;

    public string Hash(string password)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(password);
        return BCrypt.Net.BCrypt.HashPassword(password, WorkFactor);
    }

    public bool Verify(string password, string hash)
    {
        if (string.IsNullOrWhiteSpace(password) || string.IsNullOrWhiteSpace(hash))
        {
            return false;
        }

        try
        {
            return BCrypt.Net.BCrypt.Verify(password, hash);
        }
        catch (BCrypt.Net.SaltParseException)
        {
            // A malformed stored hash means that account cannot log in — but it
            // must not take the endpoint down with a 500.
            return false;
        }
    }
}
