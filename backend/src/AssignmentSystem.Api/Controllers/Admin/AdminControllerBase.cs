using Asp.Versioning;
using AssignmentSystem.Api.Configuration;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AssignmentSystem.Api.Controllers.Admin;

/// <summary>
/// Base for every admin endpoint. Applying the policy here rather than on each
/// controller means a new admin controller is protected by construction — it
/// cannot be added without the role check.
/// </summary>
[ApiController]
[ApiVersion("1.0")]
[Authorize(Policy = Policies.AdminOnly)]
[Route("api/v{version:apiVersion}/admin")]
[Produces("application/json")]
public abstract class AdminControllerBase : ControllerBase;
