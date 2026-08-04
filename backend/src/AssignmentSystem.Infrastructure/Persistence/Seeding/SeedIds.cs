using System.Security.Cryptography;
using System.Text;

namespace AssignmentSystem.Infrastructure.Persistence.Seeding;

/// <summary>
/// Derives stable GUIDs from readable names.
///
/// Seed rows need fixed ids so the seeder is idempotent and so relationships can
/// be written directly instead of round-tripping through lookups. Deriving them
/// from a string keeps the data readable — <c>SeedIds.For("user:admin")</c>
/// says more at the call site than a literal GUID.
/// </summary>
internal static class SeedIds
{
    public static Guid For(string name)
    {
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes($"assignment-system:{name}"));
        return new Guid(hash.AsSpan(0, 16));
    }
}
