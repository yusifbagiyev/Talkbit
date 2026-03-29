using ChatApp.Modules.Channels.Application.Commands.ChannelMembers;
using ChatApp.Modules.Channels.Application.Commands.Channels;
using ChatApp.Modules.Channels.Application.DTOs.Requests;
using ChatApp.Modules.Channels.Application.DTOs.Responses;
using ChatApp.Modules.Channels.Application.Queries.GetChannelMembers;
using ChatApp.Modules.Identity.Application.Queries.GetUser;
using ChatApp.Shared.Infrastructure.Authorization;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace ChatApp.Modules.Channels.Api.Controllers
{
    /// <summary>
    /// Controller for managing channel members
    /// </summary>
    [ApiController]
    [Route("api/channels/{channelId:guid}/members")]
    [Authorize]
    public class ChannelMembersController(
        IMediator mediator) : ControllerBase
    {
        private readonly IMediator _mediator = mediator;

        /// <summary>
        /// Gets all members of a channel
        /// </summary>
        [HttpGet]
        [RequirePermission("Channels.Read")]
        [ProducesResponseType(typeof(List<ChannelMemberDto>), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<IActionResult> GetMembers(
            [FromRoute] Guid channelId,
            [FromQuery] int skip = 0,
            [FromQuery] int take = 30,
            CancellationToken cancellationToken = default)
        {
            var userId = GetCurrentUserId();
            if (userId == Guid.Empty)
                return Unauthorized();

            var result = await _mediator.Send(
                new GetChannelMembersQuery(channelId, userId, skip, take),
                cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            return Ok(result.Value);
        }



        /// <summary>
        /// Adds a member to the channel
        /// </summary>
        [HttpPost]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> AddMember(
            [FromRoute] Guid channelId,
            [FromBody] AddMemberRequest request,
            CancellationToken cancellationToken)
        {
            var currentUserId = GetCurrentUserId();
            if (currentUserId == Guid.Empty)
                return Unauthorized();

            // Əlavə olunacaq istifadəçinin şirkətini yoxla
            var userResult = await _mediator.Send(new GetUserQuery(request.UserId), cancellationToken);
            if (userResult.IsFailure || userResult.Value is null)
                return NotFound(new { error = "User not found" });

            var userCompanyId = userResult.Value.CompanyId ?? Guid.Empty;

            var result = await _mediator.Send(
                new AddMemberCommand(channelId, request.UserId, currentUserId, userCompanyId, request.ShowChatHistory),
                cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            return Ok(new { message = "Member added successfully" });
        }



        /// <summary>
        /// Removes a member from the channel
        /// </summary>
        [HttpDelete("{userId:guid}")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> RemoveMember(
            [FromRoute] Guid channelId,
            [FromRoute] Guid userId,
            CancellationToken cancellationToken)
        {
            var currentUserId = GetCurrentUserId();
            if (currentUserId == Guid.Empty)
                return Unauthorized();

            var result = await _mediator.Send(
                new RemoveMemberCommand(channelId, userId, currentUserId),
                cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            return Ok(new { message = "Member removed successfully" });
        }



        /// <summary>
        /// Updates a member's role (Owner only)
        /// </summary>
        [HttpPut("{userId:guid}/role")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> UpdateMemberRole(
            [FromRoute] Guid channelId,
            [FromRoute] Guid userId,
            [FromBody] UpdateMemberRoleRequest request,
            CancellationToken cancellationToken)
        {
            var currentUserId = GetCurrentUserId();
            if (currentUserId == Guid.Empty)
                return Unauthorized();

            var result = await _mediator.Send(
                new UpdateMemberRoleCommand(channelId, userId, request.NewRole, currentUserId),
                cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            return Ok(new { message = "Member role updated successfully" });
        }



        /// <summary>
        /// Join a public channel (self-join)
        /// </summary>
        [HttpPost("join")]
        [RequirePermission("Channels.Read")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        public async Task<IActionResult> JoinChannel(
            [FromRoute] Guid channelId,
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == Guid.Empty)
                return Unauthorized();

            var (companyId, isSuperAdmin) = GetCompanyClaims();
            var result = await _mediator.Send(
                new JoinChannelCommand(channelId, userId, companyId, isSuperAdmin),
                cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            return Ok(new { message = "You have joined the channel successfully" });
        }



        /// <summary>
        /// Leave a channel (for user)
        /// </summary>
        [HttpPost("leave")]
        [RequirePermission("Channels.Read")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        public async Task<IActionResult> LeaveChannel(
            [FromRoute] Guid channelId,
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == Guid.Empty)
                return Unauthorized();

            var result = await _mediator.Send(
                new LeaveChannelCommand(channelId, userId),
                cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            return Ok(new { message = "You have left the channel successfully" });
        }



        private Guid GetCurrentUserId()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

            if (string.IsNullOrEmpty(userIdClaim) || !Guid.TryParse(userIdClaim, out var userId))
            {
                return Guid.Empty;
            }

            return userId;
        }

        private (Guid? companyId, bool isSuperAdmin) GetCompanyClaims()
        {
            var companyId = Guid.TryParse(User.FindFirst("companyId")?.Value, out var cid) ? cid : (Guid?)null;
            var isSuperAdmin = User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value == "SuperAdmin";
            return (companyId, isSuperAdmin);
        }
    }
}