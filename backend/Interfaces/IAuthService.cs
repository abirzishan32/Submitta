namespace AssignmentSystem.Application.Features.Auth;

public interface IAuthService
{
    /// <summary>Creates an account for the person filling in the form.</summary>
    Task<RegisterResponse> RegisterAsync(
        RegisterRequest request, string? ipAddress, CancellationToken ct = default);

    /// <summary>What the sign-up form needs before it can be shown.</summary>
    Task<RegistrationOptions> GetRegistrationOptionsAsync(CancellationToken ct = default);

    Task<AuthResponse> LoginAsync(LoginRequest request, string? ipAddress, CancellationToken ct = default);

    Task<AuthResponse> RefreshAsync(RefreshRequest request, string? ipAddress, CancellationToken ct = default);

    Task LogoutAsync(LogoutRequest request, CancellationToken ct = default);

    /// <summary>Ends every session for the current user, on every device.</summary>
    Task LogoutAllAsync(CancellationToken ct = default);

    Task<UserProfile> GetCurrentUserAsync(CancellationToken ct = default);

    Task ChangePasswordAsync(ChangePasswordRequest request, CancellationToken ct = default);
}
