using Asp.Versioning;
using AssignmentSystem.Application.Common.Models;
using AssignmentSystem.Application.Features.Auth;
using AssignmentSystem.Api.Configuration;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace AssignmentSystem.Api.Controllers;

/// <summary>
/// Authentication: sign in, refresh, sign out and password change.
/// </summary>
[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/auth")]
[Produces("application/json")]
// Login and refresh are reachable without credentials, so they are the endpoints
// worth rate limiting — ten attempts per minute per IP.
[EnableRateLimiting(RateLimitingSetup.AuthPolicy)]
public sealed class AuthController(IAuthService authService) : ControllerBase
{
    /// <summary>Creates an account.</summary>
    /// <remarks>
    /// Open to students and teachers; administrator accounts are only ever
    /// created by another administrator.
    ///
    /// A student is signed in straight away and the response carries their
    /// tokens. A teacher account is created deactivated and an administrator has
    /// to approve it before it can sign in, because being a teacher grants
    /// access to other people's work.
    ///
    /// Whether registration is open at all, and on what terms, is controlled by
    /// the <c>auth.*</c> application settings.
    /// </remarks>
    /// <response code="200">Account created.</response>
    /// <response code="400">The request body failed validation.</response>
    /// <response code="409">An account already exists for that email.</response>
    /// <response code="422">Registration is closed, or that role cannot self-register.</response>
    [AllowAnonymous]
    [HttpPost("register")]
    [ProducesResponseType(typeof(ApiResponse<RegisterResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status409Conflict)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> Register(RegisterRequest request, CancellationToken ct)
    {
        var result = await authService.RegisterAsync(request, GetIpAddress(), ct);

        return Ok(ApiResponse<RegisterResponse>.Ok(
            result,
            result.RequiresApproval
                ? "Account created. An administrator will approve it shortly."
                : "Welcome — your account is ready."));
    }

    /// <summary>What the sign-up form needs before it can be shown.</summary>
    /// <remarks>
    /// Reports whether registration is open, whether teachers may register, and
    /// the classes a student can join. The class list is only returned when
    /// registration is open, so a closed instance does not publish it.
    /// </remarks>
    [AllowAnonymous]
    [HttpGet("registration-options")]
    [ProducesResponseType(typeof(ApiResponse<RegistrationOptions>), StatusCodes.Status200OK)]
    public async Task<IActionResult> RegistrationOptions(CancellationToken ct)
        => Ok(ApiResponse<RegistrationOptions>.Ok(
            await authService.GetRegistrationOptionsAsync(ct)));

    /// <summary>Signs in with email and password.</summary>
    /// <remarks>
    /// Returns a short-lived access token plus a refresh token. Send the access
    /// token as <c>Authorization: Bearer &lt;token&gt;</c> on subsequent calls.
    ///
    /// Demo accounts are listed in the README; all use the same password.
    /// </remarks>
    /// <response code="200">Signed in.</response>
    /// <response code="400">The request body failed validation.</response>
    /// <response code="401">Email or password incorrect, or the account is inactive.</response>
    [AllowAnonymous]
    [HttpPost("login")]
    [ProducesResponseType(typeof(ApiResponse<AuthResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Login(LoginRequest request, CancellationToken ct)
    {
        var result = await authService.LoginAsync(request, GetIpAddress(), ct);
        return Ok(ApiResponse<AuthResponse>.Ok(result, "Signed in successfully."));
    }

    /// <summary>Exchanges a refresh token for a new token pair.</summary>
    /// <remarks>
    /// The presented refresh token is rotated — it stops working immediately.
    /// Presenting an already-rotated token is treated as a replay and revokes
    /// every session for that user.
    /// </remarks>
    /// <response code="200">New tokens issued.</response>
    /// <response code="401">The refresh token is unknown, expired or revoked.</response>
    [AllowAnonymous]
    [HttpPost("refresh")]
    [ProducesResponseType(typeof(ApiResponse<AuthResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Refresh(RefreshRequest request, CancellationToken ct)
    {
        var result = await authService.RefreshAsync(request, GetIpAddress(), ct);
        return Ok(ApiResponse<AuthResponse>.Ok(result));
    }

    /// <summary>Signs out by revoking a refresh token.</summary>
    /// <remarks>
    /// Succeeds even if the token is already unknown or revoked, since the
    /// caller's intent is satisfied either way. The access token remains valid
    /// until it expires — that is inherent to stateless JWTs, and why the access
    /// token lifetime is short.
    /// </remarks>
    /// <response code="200">Signed out.</response>
    [AllowAnonymous]
    [HttpPost("logout")]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> Logout(LogoutRequest request, CancellationToken ct)
    {
        await authService.LogoutAsync(request, ct);
        return Ok(ApiResponse.Ok("Signed out successfully."));
    }

    /// <summary>Signs out of every device by revoking all refresh tokens.</summary>
    /// <response code="200">All sessions ended.</response>
    /// <response code="401">Not authenticated.</response>
    [Authorize]
    [HttpPost("logout-all")]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> LogoutAll(CancellationToken ct)
    {
        await authService.LogoutAllAsync(ct);
        return Ok(ApiResponse.Ok("All sessions have been ended."));
    }

    /// <summary>Returns the currently authenticated user.</summary>
    /// <remarks>
    /// Read from the validated token, so it reflects the server's view of the
    /// caller rather than anything the client claims about itself.
    /// </remarks>
    /// <response code="200">The current user.</response>
    /// <response code="401">Not authenticated.</response>
    [Authorize]
    [HttpGet("me")]
    [ProducesResponseType(typeof(ApiResponse<UserProfile>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Me(CancellationToken ct)
    {
        var profile = await authService.GetCurrentUserAsync(ct);
        return Ok(ApiResponse<UserProfile>.Ok(profile));
    }

    /// <summary>Changes the current user's password.</summary>
    /// <remarks>All existing sessions are revoked, since the old password established them.</remarks>
    /// <response code="200">Password changed.</response>
    /// <response code="400">The new password failed validation.</response>
    /// <response code="401">The current password is incorrect.</response>
    [Authorize]
    [HttpPost("change-password")]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> ChangePassword(ChangePasswordRequest request, CancellationToken ct)
    {
        await authService.ChangePasswordAsync(request, ct);
        return Ok(ApiResponse.Ok("Password changed. Please sign in again."));
    }

    /// <summary>
    /// Client IP for the refresh-token audit trail. Prefers X-Forwarded-For,
    /// since the API sits behind a proxy in any real deployment.
    /// </summary>
    private string? GetIpAddress() =>
        Request.Headers.TryGetValue("X-Forwarded-For", out var forwarded)
            ? forwarded.ToString().Split(',')[0].Trim()
            : HttpContext.Connection.RemoteIpAddress?.ToString();
}
