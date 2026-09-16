namespace AssignmentSystem.Application.Common.Interfaces;

/// <summary>
/// Password hashing, abstracted so the algorithm can be replaced without
/// touching authentication logic, and so tests can substitute a fast fake
/// instead of paying BCrypt's deliberate cost on every fixture.
/// </summary>
public interface IPasswordHasher
{
    /// <summary>Hashes a plaintext password. The salt is generated per call and embedded in the result.</summary>
    string Hash(string password);

    /// <summary>
    /// Verifies a password against a stored hash. Returns false rather than
    /// throwing on a malformed hash, so a corrupted row cannot 500 the login.
    /// </summary>
    bool Verify(string password, string hash);
}
