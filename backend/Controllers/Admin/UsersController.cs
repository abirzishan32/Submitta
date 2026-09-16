using AssignmentSystem.Application.Common.Models;
using AssignmentSystem.Application.Features.Admin.Users;
using Microsoft.AspNetCore.Mvc;

namespace AssignmentSystem.Api.Controllers.Admin;

/// <summary>Admin management of user accounts.</summary>
[Route("api/v{version:apiVersion}/admin/users")]
public sealed class UsersController(IUserService users) : AdminControllerBase
{
    /// <summary>Lists users, with paging, search and filtering.</summary>
    /// <remarks>Search matches full name or email. Sort by fullName, email, role, createdAt or lastLoginAt.</remarks>
    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<PagedResult<UserDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> List([FromQuery] UserListQuery query, CancellationToken ct)
        => Ok(ApiResponse<PagedResult<UserDto>>.Ok(await users.ListAsync(query, ct)));

    /// <summary>Returns one user, with the classes they teach or are enrolled in.</summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(ApiResponse<UserDetailDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Get(Guid id, CancellationToken ct)
        => Ok(ApiResponse<UserDetailDto>.Ok(await users.GetAsync(id, ct)));

    /// <summary>Creates a user account.</summary>
    /// <response code="201">Created.</response>
    /// <response code="409">The email is already registered.</response>
    [HttpPost]
    [ProducesResponseType(typeof(ApiResponse<UserDto>), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Create(CreateUserRequest request, CancellationToken ct)
    {
        var created = await users.CreateAsync(request, ct);

        return CreatedAtAction(nameof(Get), new { id = created.Id, version = "1.0" },
            ApiResponse<UserDto>.Ok(created, "User created."));
    }

    /// <summary>Updates a user's name, email or role.</summary>
    /// <remarks>
    /// Changing role is rejected while the user still has enrolments or teaching
    /// assignments, which belong to the old role.
    /// </remarks>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(ApiResponse<UserDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Update(Guid id, UpdateUserRequest request, CancellationToken ct)
        => Ok(ApiResponse<UserDto>.Ok(await users.UpdateAsync(id, request, ct), "User updated."));

    /// <summary>Activates or deactivates an account.</summary>
    /// <remarks>
    /// Deactivating revokes the user's sessions immediately. You cannot
    /// deactivate your own account or the last active administrator.
    /// </remarks>
    [HttpPatch("{id:guid}/status")]
    [ProducesResponseType(typeof(ApiResponse<UserDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> SetStatus(
        Guid id, SetUserStatusRequest request, CancellationToken ct)
        => Ok(ApiResponse<UserDto>.Ok(await users.SetStatusAsync(id, request, ct),
            request.IsActive ? "Account activated." : "Account deactivated."));

    /// <summary>Sets a new password for a user and ends their sessions.</summary>
    [HttpPost("{id:guid}/reset-password")]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> ResetPassword(
        Guid id, ResetPasswordRequest request, CancellationToken ct)
    {
        await users.ResetPasswordAsync(id, request, ct);
        return Ok(ApiResponse.Ok("Password reset. The user must sign in again."));
    }

    /// <summary>Soft-deletes a user account.</summary>
    /// <remarks>
    /// Refused when the account has authored assignments or submitted work —
    /// deactivate it instead, so that history stays attributable.
    /// </remarks>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await users.DeleteAsync(id, ct);
        return Ok(ApiResponse.Ok("User deleted."));
    }
}
