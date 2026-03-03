using ChatApp.Modules.Channels.Application.Commands.Channels;
using ChatApp.Modules.Channels.Application.Commands.ChannelMembers;
using ChatApp.Modules.Channels.Application.DTOs.Requests;
using ChatApp.Modules.Channels.Application.DTOs.Responses;
using ChatApp.Modules.Channels.Application.Queries.GetChannel;
using ChatApp.Modules.Channels.Application.Queries.GetPublicChannels;
using ChatApp.Modules.Channels.Application.Queries.GetUserChannels;
using ChatApp.Modules.Channels.Application.Queries.CheckChannelName;
using ChatApp.Modules.Channels.Application.Queries.SearchChannels;
using ChatApp.Modules.Channels.Application.Queries.GetSharedChannels;
using ChatApp.Shared.Infrastructure.Authorization;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace ChatApp.Modules.Channels.Api.Controllers
{
    /// <summary>
    /// Controller for managing channels (create, update, delete, query)
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class ChannelsController : ControllerBase
    {
        private readonly IMediator _mediator;

        public ChannelsController(
            IMediator mediator)
        {
            _mediator = mediator;
        }



        /// <summary>
        /// Creates a new channel with optional initial members
        /// </summary>
        [HttpPost]
        [RequirePermission("Channels.Create")]
        [ProducesResponseType(StatusCodes.Status201Created)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> CreateChannel(
            [FromBody] CreateChannelCommand command,
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == Guid.Empty)
                return Unauthorized();

            var commandWithUser = command with { CreatedBy = userId };

            var result = await _mediator.Send(commandWithUser, cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            return StatusCode(StatusCodes.Status201Created, result.Value);
        }



        /// <summary>
        /// Gets a specific channel by ID with full details
        /// </summary>
        [HttpGet("{channelId:guid}")]
        [RequirePermission("Channels.Read")]
        [ProducesResponseType(typeof(ChannelDetailsDto), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> GetChannel(
            [FromRoute] Guid channelId,
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == Guid.Empty)
                return Unauthorized();

            var result = await _mediator.Send(
                new GetChannelQuery(channelId, userId),
                cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            if (result.Value == null)
                return NotFound(new { error = $"Channel with ID {channelId} not found" });

            return Ok(result.Value);
        }



        /// <summary>
        /// Gets paginated channels the current user is a member of
        /// </summary>
        [HttpGet("my-channels")]
        [RequirePermission("Channels.Read")]
        [ProducesResponseType(typeof(ChatApp.Shared.Kernel.Common.PagedResult<ChannelDto>), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> GetMyChannelsPaged(
            [FromQuery] int pageNumber = 1,
            [FromQuery] int pageSize = 20,
            CancellationToken cancellationToken = default)
        {
            var userId = GetCurrentUserId();
            if (userId == Guid.Empty)
                return Unauthorized();

            var result = await _mediator.Send(
                new GetUserChannelsPagedQuery(userId, pageNumber, pageSize),
                cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            return Ok(result.Value);
        }

        /// <summary>
        /// Gets all public channels
        /// </summary>
        [HttpGet("public")]
        [RequirePermission("Channels.Read")]
        [ProducesResponseType(typeof(List<ChannelDto>), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> GetPublicChannels(CancellationToken cancellationToken)
        {
            var result = await _mediator.Send(new GetPublicChannelsQuery(), cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            return Ok(result.Value);
        }



        /// <summary>
        /// Searches channels by name or description
        /// </summary>
        [HttpGet("search")]
        [RequirePermission("Channels.Read")]
        [ProducesResponseType(typeof(List<ChannelDto>), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> SearchChannels(
            [FromQuery] string query,
            CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(query))
                return BadRequest(new { error = "Search query cannot be empty" });

            var userId = GetCurrentUserId();
            if (userId == Guid.Empty)
                return Unauthorized();

            var result = await _mediator.Send(
                new SearchChannelsQuery(query, userId),
                cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            return Ok(result.Value);
        }



        /// <summary>
        /// Checks if a channel name is available (valid and unique)
        /// </summary>
        [HttpGet("check-name")]
        [RequirePermission("Channels.Read")]
        [ProducesResponseType(typeof(CheckChannelNameResult), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        public async Task<IActionResult> CheckChannelName(
            [FromQuery] string name,
            CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(name))
                return Ok(new CheckChannelNameResult(false, "Channel name cannot be empty"));

            var result = await _mediator.Send(
                new CheckChannelNameQuery(name),
                cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            return Ok(result.Value);
        }



        /// <summary>
        /// Updates channel information (name, description, type)
        /// </summary>
        [HttpPut("{channelId:guid}")]
        [RequirePermission("Channels.Manage")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<IActionResult> UpdateChannel(
            [FromRoute] Guid channelId,
            [FromBody] UpdateChannelRequest request,
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == Guid.Empty)
                return Unauthorized();

            var command = new UpdateChannelCommand(
                channelId,
                request.Name,
                request.Description,
                request.Type,
                request.AvatarUrl,
                userId);

            var result = await _mediator.Send(command, cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            return Ok(new { message = "Channel updated successfully" });
        }



        /// <summary>
        /// Toggle pin status for a channel
        /// </summary>
        [HttpPost("{channelId:guid}/toggle-pin")]
        [RequirePermission("Channels.Read")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        public async Task<IActionResult> TogglePinChannel(
            [FromRoute] Guid channelId,
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == Guid.Empty)
                return Unauthorized();

            var result = await _mediator.Send(
                new TogglePinChannelCommand(channelId, userId),
                cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            return Ok(new { isPinned = result.Value });
        }



        /// <summary>
        /// Toggle mute status for a channel
        /// </summary>
        [HttpPost("{channelId:guid}/toggle-mute")]
        [RequirePermission("Channels.Read")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        public async Task<IActionResult> ToggleMuteChannel(
            [FromRoute] Guid channelId,
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == Guid.Empty)
                return Unauthorized();

            var result = await _mediator.Send(
                new ToggleMuteChannelCommand(channelId, userId),
                cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            return Ok(new { isMuted = result.Value });
        }



        /// <summary>
        /// Hide a channel from conversation list
        /// </summary>
        [HttpPost("{channelId:guid}/hide")]
        [RequirePermission("Channels.Read")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        public async Task<IActionResult> HideChannel(
            [FromRoute] Guid channelId,
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == Guid.Empty)
                return Unauthorized();

            var result = await _mediator.Send(
                new HideChannelCommand(channelId, userId),
                cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            return Ok();
        }



        /// <summary>
        /// Toggle mark as read later for a channel
        /// </summary>
        [HttpPost("{channelId:guid}/toggle-read-later")]
        [RequirePermission("Channels.Read")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        public async Task<IActionResult> ToggleMarkChannelAsReadLater(
            [FromRoute] Guid channelId,
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == Guid.Empty)
                return Unauthorized();

            var result = await _mediator.Send(
                new ToggleMarkChannelAsReadLaterCommand(channelId, userId),
                cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            return Ok(new { isMarkedReadLater = result.Value });
        }


        /// <summary>
        /// Unmark channel as read later (clears both conversation-level and message-level marks)
        /// </summary>
        [HttpDelete("{channelId:guid}/read-later")]
        [RequirePermission("Channels.Read")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        public async Task<IActionResult> UnmarkChannelAsReadLater(
            [FromRoute] Guid channelId,
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == Guid.Empty)
                return Unauthorized();

            var result = await _mediator.Send(
                new UnmarkChannelReadLaterCommand(channelId, userId),
                cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            return Ok();
        }


        /// <summary>
        /// Mark all unread channel messages as read and clear all read later flags
        /// </summary>
        [HttpPost("{channelId:guid}/messages/mark-all-read")]
        [RequirePermission("Channels.Read")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        public async Task<IActionResult> MarkAllChannelMessagesAsRead(
            [FromRoute] Guid channelId,
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == Guid.Empty)
                return Unauthorized();

            var result = await _mediator.Send(
                new MarkAllChannelMessagesAsReadCommand(channelId, userId),
                cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            return Ok(new { markedCount = result.Value, message = "All messages marked as read" });
        }


        /// <summary>
        /// Gets channels shared between current user and another user
        /// </summary>
        [HttpGet("shared/{otherUserId:guid}")]
        [RequirePermission("Channels.Read")]
        [ProducesResponseType(typeof(List<SharedChannelDto>), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        public async Task<IActionResult> GetSharedChannels(
            [FromRoute] Guid otherUserId,
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == Guid.Empty)
                return Unauthorized();

            var result = await _mediator.Send(
                new GetSharedChannelsQuery(userId, otherUserId),
                cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            return Ok(result.Value);
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
    }
}