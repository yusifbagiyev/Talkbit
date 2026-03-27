using ChatApp.Modules.Identity.Application.Queries.Organization;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace ChatApp.Modules.Identity.Api.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/identity/organization")]
    public class OrganizationController(IMediator mediator) : ControllerBase
    {
        /// <summary>
        /// Get organization hierarchy — company scoped.
        /// SuperAdmin bütün şirkətləri və ya spesifik şirkəti görür.
        /// Admin/User yalnız öz şirkətini görür.
        /// </summary>
        [HttpGet("hierarchy")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        public async Task<IActionResult> GetOrganizationHierarchy(
            [FromQuery] Guid? companyId = null,
            CancellationToken cancellationToken = default)
        {
            var isSuperAdmin = User.FindFirst(ClaimTypes.Role)?.Value == "SuperAdmin";
            var userCompanyId = Guid.TryParse(User.FindFirst("companyId")?.Value, out var cid) ? cid : (Guid?)null;
            var userId = Guid.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var uid) ? uid : (Guid?)null;

            var effectiveCompanyId = isSuperAdmin ? companyId : userCompanyId;

            var query = new GetOrganizationHierarchyQuery(effectiveCompanyId, isSuperAdmin, userId);
            var result = await mediator.Send(query, cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            return Ok(result.Value);
        }
    }
}
