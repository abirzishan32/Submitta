using Asp.Versioning;
using AssignmentSystem.Api.Configuration;
using AssignmentSystem.Application.Common.Models;
using AssignmentSystem.Application.Features.Admin.Settings;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AssignmentSystem.Api.Controllers;

/// <summary>
/// Application-level settings.
///
/// Not under the admin controller base, because one route is open to any
/// signed-in user while the rest are administrative.
///
/// Every route here requires authentication. The subset marked
/// <see cref="Domain.Entities.ApplicationSetting.IsPublic"/> is "shared" in the
/// sense of being readable by any role rather than admins alone — it is not
/// anonymous, and the route is named accordingly so the distinction cannot be
/// misread. Settings a signed-out visitor genuinely needs, such as whether
/// registration is open, are served by
/// <c>GET /auth/registration-options</c>, which is explicitly
/// <c>[AllowAnonymous]</c> and returns only those flags.
/// </summary>
[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/settings")]
[Produces("application/json")]
[Authorize]
public sealed class SettingsController(ISettingService settings) : ControllerBase
{
    /// <summary>Returns the settings every role may read. Any signed-in user.</summary>
    /// <response code="401">No valid session; this route is not anonymous.</response>
    [HttpGet("shared")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<SettingDto>>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> ListShared(CancellationToken ct)
        => Ok(ApiResponse<IReadOnlyList<SettingDto>>.Ok(await settings.ListSharedAsync(ct)));

    /// <summary>Returns every setting. Admin only.</summary>
    [HttpGet]
    [Authorize(Policy = Policies.AdminOnly)]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<SettingDto>>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> List(CancellationToken ct)
        => Ok(ApiResponse<IReadOnlyList<SettingDto>>.Ok(await settings.ListAsync(ct)));

    /// <summary>Updates a setting's value. Admin only.</summary>
    /// <remarks>
    /// The value must parse as the setting's declared data type, so a bad value
    /// fails here rather than later, wherever the setting is read.
    /// </remarks>
    /// <response code="422">The value does not match the setting's data type.</response>
    [HttpPut("{key}")]
    [Authorize(Policy = Policies.AdminOnly)]
    [ProducesResponseType(typeof(ApiResponse<SettingDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> Update(
        string key, UpdateSettingRequest request, CancellationToken ct)
        => Ok(ApiResponse<SettingDto>.Ok(
            await settings.UpdateAsync(key, request, ct), "Setting updated."));
}
