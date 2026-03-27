using ChatApp.Modules.Identity.Application.DTOs.Responses;
using ChatApp.Modules.Identity.Application.Queries.Organization;
using ChatApp.Shared.Infrastructure.SignalR.Services;
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
    public class OrganizationController(IMediator mediator, IPresenceService presenceService) : ControllerBase
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

            // User node-larının online statusunu al
            var userIds = CollectUserIds(result.Value);
            if (userIds.Count > 0)
            {
                var onlineMap = await presenceService.GetUsersOnlineStatusAsync(userIds);
                result = ChatApp.Shared.Kernel.Common.Result.Success(
                    ApplyOnlineStatus(result.Value, onlineMap));
            }

            return Ok(result.Value);
        }

        // Bütün User node-larının Id-lərini rekursiv yığ
        private static List<Guid> CollectUserIds(List<OrganizationHierarchyNodeDto> nodes)
        {
            var ids = new List<Guid>();
            foreach (var node in nodes)
            {
                if (node.Type == NodeType.User) ids.Add(node.Id);
                if (node.Children?.Count > 0) ids.AddRange(CollectUserIds(node.Children));
            }
            return ids;
        }

        // Tree-ni gəzib hər User node-una IsOnline mənimsət
        private static List<OrganizationHierarchyNodeDto> ApplyOnlineStatus(
            List<OrganizationHierarchyNodeDto> nodes,
            Dictionary<Guid, bool> onlineMap)
        {
            return nodes.Select(node =>
            {
                if (node.Type == NodeType.User)
                    return node with { IsOnline = onlineMap.GetValueOrDefault(node.Id, false) };

                if (node.Children?.Count > 0)
                    return node with { Children = ApplyOnlineStatus(node.Children, onlineMap) };

                return node;
            }).ToList();
        }
    }
}
