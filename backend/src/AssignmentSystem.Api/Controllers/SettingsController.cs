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
/// Not under the admin controller base, because the public subset is readable by
/// any signed-in user — the UI needs the institution name and academic year to
/// render its header.
/// </summary>
[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/settings")]
[Produces("application/json")]
[Authorize]
public sealed class SettingsController(ISettingService settings) : ControllerBase
{
    /// <summary>Returns settings marked public. Any signed-in user.</summary>
    [HttpGet("public")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<SettingDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListPublic(CancellationToken ct)
        => Ok(ApiResponse<IReadOnlyList<SettingDto>>.Ok(await settings.ListPublicAsync(ct)));

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
