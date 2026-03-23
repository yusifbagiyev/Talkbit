using ChatApp.Modules.Channels.Application.Commands.ChannelMessages;
using ChatApp.Modules.Channels.Application.Commands.ChannelReactions;
using ChatApp.Modules.Channels.Application.Commands.MessageConditions;
using ChatApp.Modules.Channels.Application.DTOs.Requests;
using ChatApp.Modules.Channels.Application.DTOs.Responses;
using ChatApp.Modules.Channels.Application.Queries.GetChannelMessages;
using ChatApp.Modules.Channels.Application.Queries.GetChannelMessagesAround;
using ChatApp.Modules.Channels.Application.Queries.GetMessageReactions;
using ChatApp.Modules.Channels.Application.Queries.GetMessagesBeforeDate;
using ChatApp.Modules.Channels.Application.Queries.GetMessagesAfterDate;
using ChatApp.Modules.Channels.Application.Queries.GetFavoriteMessages;
using ChatApp.Modules.Channels.Application.Queries.GetPinnedMessages;
using ChatApp.Modules.Channels.Application.Queries.GetUnreadCount;
using ChatApp.Modules.Channels.Application.Queries.GetChannelFiles;
using ChatApp.Modules.Channels.Application.Queries.GetChannelLinks;
using ChatApp.Shared.Infrastructure.Authorization;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using System.Security.Claims;
using BackendChannelMentionRequest = ChatApp.Modules.Channels.Application.Commands.ChannelMessages.ChannelMentionRequest;

namespace ChatApp.Modules.Channels.Api.Controllers
{
    /// <summary>
    /// Controller for managing channel messages
    /// </summary>
    [ApiController]
    [Route("api/channels/{channelId:guid}/messages")]
    [Authorize]
    public class ChannelMessagesController : ControllerBase
    {
        private readonly IMediator _mediator;
        private readonly ILogger<ChannelMessagesController> _logger;

        public ChannelMessagesController(
            IMediator mediator,
            ILogger<ChannelMessagesController> logger)
        {
            _mediator = mediator;
            _logger = logger;
        }
        


        /// <summary>
        /// Gets messages in a channel with pagination (newest first by default)
        /// </summary>
        [HttpGet]
        [RequirePermission("Messages.Read")]
        [ProducesResponseType(typeof(List<ChannelMessageDto>), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> GetMessages(
            [FromRoute] Guid channelId,
            [FromQuery] int pageSize = 30,
            [FromQuery] DateTime? before = null,
            CancellationToken cancellationToken = default)
        {
            var userId = GetCurrentUserId();
            if (userId == Guid.Empty)
                return Unauthorized();

            // Validate pagination
            if (pageSize < 1 || pageSize > 30)
                return BadRequest(new { error = "Page size must be between 1 and 30" });

            var result = await _mediator.Send(
                new GetChannelMessagesQuery(channelId, userId, pageSize, before),
                cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            return Ok(result.Value);
        }

        /// <summary>
        /// Gets messages around a specific message (for navigation to pinned/favorite messages)
        /// </summary>
        [HttpGet("around/{messageId:guid}")]
        [RequirePermission("Messages.Read")]
        [ProducesResponseType(typeof(List<ChannelMessageDto>), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> GetMessagesAround(
            [FromRoute] Guid channelId,
            [FromRoute] Guid messageId,
            [FromQuery] int count = 50,
            CancellationToken cancellationToken = default)
        {
            var userId = GetCurrentUserId();
            if (userId == Guid.Empty)
                return Unauthorized();

            if (count < 1 || count > 100)
                return BadRequest(new { error = "Count must be between 1 and 100" });

            var result = await _mediator.Send(
                new GetChannelMessagesAroundQuery(channelId, messageId, userId, count),
                cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            return Ok(result.Value);
        }

        /// <summary>
        /// Gets messages before a specific date (for bi-directional loading)
        /// </summary>
        [HttpGet("before")]
        [RequirePermission("Messages.Read")]
        [ProducesResponseType(typeof(List<ChannelMessageDto>), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> GetMessagesBefore(
            [FromRoute] Guid channelId,
            [FromQuery] DateTime date,
            [FromQuery] int limit = 100,
            CancellationToken cancellationToken = default)
        {
            var userId = GetCurrentUserId();
            if (userId == Guid.Empty)
                return Unauthorized();

            if (limit < 1 || limit > 100)
                return BadRequest(new { error = "Limit must be between 1 and 100" });

            var result = await _mediator.Send(
                new GetMessagesBeforeDateQuery(channelId, date, userId, limit),
                cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            return Ok(result.Value);
        }

        /// <summary>
        /// Gets messages after a specific date (for bi-directional loading)
        /// </summary>
        [HttpGet("after")]
        [RequirePermission("Messages.Read")]
        [ProducesResponseType(typeof(List<ChannelMessageDto>), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> GetMessagesAfter(
            [FromRoute] Guid channelId,
            [FromQuery] DateTime date,
            [FromQuery] int limit = 100,
            CancellationToken cancellationToken = default)
        {
            var userId = GetCurrentUserId();
            if (userId == Guid.Empty)
                return Unauthorized();

            if (limit < 1 || limit > 100)
                return BadRequest(new { error = "Limit must be between 1 and 100" });

            var result = await _mediator.Send(
                new GetMessagesAfterDateQuery(channelId, date, userId, limit),
                cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            return Ok(result.Value);
        }




        /// <summary>
        /// Gets pinned messages in a channel
        /// </summary>
        [HttpGet("pinned")]
        [RequirePermission("Messages.Read")]
        [ProducesResponseType(typeof(List<ChannelMessageDto>), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> GetPinnedMessages(
            [FromRoute] Guid channelId,
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == Guid.Empty)
                return Unauthorized();

            var result = await _mediator.Send(
                new GetPinnedMessagesQuery(channelId, userId),
                cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            return Ok(result.Value);
        }

        /// <summary>
        /// Gets favorite messages in a channel
        /// </summary>
        [HttpGet("favorites")]
        [RequirePermission("Messages.Read")]
        [ProducesResponseType(typeof(List<FavoriteChannelMessageDto>), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> GetFavoriteMessages(
            [FromRoute] Guid channelId,
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == Guid.Empty)
                return Unauthorized();

            var result = await _mediator.Send(
                new GetFavoriteMessagesQuery(channelId, userId),
                cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            return Ok(result.Value);
        }

        /// <summary>
        /// Gets messages with files in a channel (for Files & Media panel)
        /// </summary>
        [HttpGet("files")]
        [RequirePermission("Messages.Read")]
        [ProducesResponseType(typeof(List<ChannelMessageDto>), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> GetFiles(
            [FromRoute] Guid channelId,
            [FromQuery] int pageSize = 30,
            [FromQuery] DateTime? before = null,
            [FromQuery] bool? isMedia = null,
            CancellationToken cancellationToken = default)
        {
            var userId = GetCurrentUserId();
            if (userId == Guid.Empty)
                return Unauthorized();

            if (pageSize < 1 || pageSize > 50)
                return BadRequest(new { error = "Page size must be between 1 and 50" });

            var result = await _mediator.Send(
                new GetChannelFilesQuery(channelId, userId, pageSize, before, isMedia),
                cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            return Ok(result.Value);
        }


        /// <summary>
        /// Gets messages containing links in a channel (for All Links panel)
        /// </summary>
        [HttpGet("links")]
        [RequirePermission("Messages.Read")]
        [ProducesResponseType(typeof(List<ChannelMessageDto>), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> GetLinks(
            [FromRoute] Guid channelId,
            [FromQuery] int pageSize = 30,
            [FromQuery] DateTime? before = null,
            CancellationToken cancellationToken = default)
        {
            var userId = GetCurrentUserId();
            if (userId == Guid.Empty)
                return Unauthorized();

            if (pageSize < 1 || pageSize > 50)
                return BadRequest(new { error = "Page size must be between 1 and 50" });

            var result = await _mediator.Send(
                new GetChannelLinksQuery(channelId, userId, pageSize, before),
                cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            return Ok(result.Value);
        }


        /// <summary>
        /// Gets unread message count for the current user in this channel
        /// </summary>
        [HttpGet("unread-count")]
        [RequirePermission("Messages.Read")]
        [ProducesResponseType(typeof(int), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        public async Task<IActionResult> GetUnreadCount(
            [FromRoute] Guid channelId,
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == Guid.Empty)
                return Unauthorized();

            var result = await _mediator.Send(
                new GetUnreadCountQuery(channelId, userId),
                cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            return Ok(new { unreadCount = result.Value });
        }


        /// <summary>
        /// Marks all unread messages in the channel as read for the current user (bulk operation)
        /// </summary>
        [HttpPost("mark-as-read")]
        [RequirePermission("Messages.Read")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        public async Task<IActionResult> MarkAsRead(
            [FromRoute] Guid channelId,
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == Guid.Empty)
                return Unauthorized();

            var result = await _mediator.Send(
                new MarkChannelMessagesAsReadCommand(channelId, userId),
                cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            return Ok(new { message = "Messages marked as read" });
        }


        /// <summary>
        /// Marks a single message as read for the current user
        /// </summary>
        [HttpPost("{messageId:guid}/mark-as-read")]
        [RequirePermission("Messages.Read")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        public async Task<IActionResult> MarkSingleMessageAsRead(
            [FromRoute] Guid channelId,
            [FromRoute] Guid messageId,
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == Guid.Empty)
                return Unauthorized();

            var result = await _mediator.Send(
                new MarkChannelMessageAsReadCommand(messageId, channelId, userId),
                cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            return Ok(new { message = "Messages marked as read" });
        }


        /// <summary>
        /// Batch marks multiple channel messages as read (viewport-based, N request → 1 request)
        /// </summary>
        [HttpPost("batch-read")]
        [RequirePermission("Messages.Read")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        public async Task<IActionResult> BatchMarkAsRead(
            [FromRoute] Guid channelId,
            [FromBody] BatchReadRequest request,
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == Guid.Empty)
                return Unauthorized();

            var result = await _mediator.Send(
                new BatchMarkChannelMessagesAsReadCommand(channelId, request.MessageIds, userId),
                cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            return Ok(new { message = "Messages marked as read" });
        }


        /// <summary>
        /// Sends a message to the channel
        /// </summary>
        [HttpPost]
        [RequirePermission("Messages.Send")]
        [ProducesResponseType(typeof(Guid), StatusCodes.Status201Created)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> SendMessage(
            [FromRoute] Guid channelId,
            [FromBody] SendMessageRequestToChannel request,
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == Guid.Empty)
                return Unauthorized();

            // Convert frontend MentionRequest to backend ChannelMentionRequest
            List<BackendChannelMentionRequest>? mentions = null;
            if (request.Mentions != null && request.Mentions.Count > 0)
            {
                mentions = request.Mentions
                    .Select(m => new BackendChannelMentionRequest(m.UserId, m.UserFullName, m.IsAllMention))
                    .ToList();
            }

            var result = await _mediator.Send(
                new SendChannelMessageCommand(
                    channelId,
                    userId,
                    request.Content,
                    request.FileId,
                    request.ReplyToMessageId,
                    request.IsForwarded,
                    mentions),
                cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            return CreatedAtAction(
                nameof(GetMessages),
                new { channelId },
                new { messageId = result.Value, message = "Message sent successfully" });
        }



        /// <summary>
        /// Edits a message (only sender can edit)
        /// </summary>
        [HttpPut("{messageId:guid}")]
        [RequirePermission("Messages.Edit")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> EditMessage(
            [FromRoute] Guid channelId,
            [FromRoute] Guid messageId,
            [FromBody] EditMessageRequestToChannel request,
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == Guid.Empty)
                return Unauthorized();

            var result = await _mediator.Send(
                new EditChannelMessageCommand(messageId, request.NewContent, userId),
                cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            return Ok(new { message = "Message edited successfully" });
        }



        /// <summary>
        /// Deletes a message (sender, admin, or owner can delete)
        /// </summary>
        [HttpDelete("{messageId:guid}")]
        [RequirePermission("Messages.Delete")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> DeleteMessage(
            [FromRoute] Guid channelId,
            [FromRoute] Guid messageId,
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == Guid.Empty)
                return Unauthorized();

            var result = await _mediator.Send(
                new DeleteChannelMessageCommand(messageId, userId),
                cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            return Ok(new { message = "Message deleted successfully", hardDeleted = result.Value });
        }


        /// <summary>
        /// Batch deletes multiple messages (sender, admin, or owner can delete)
        /// </summary>
        [HttpPost("batch-delete")]
        [RequirePermission("Messages.Delete")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> BatchDeleteMessages(
            [FromRoute] Guid channelId,
            [FromBody] BatchDeleteRequest request,
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == Guid.Empty)
                return Unauthorized();

            var result = await _mediator.Send(
                new BatchDeleteChannelMessagesCommand(channelId, request.MessageIds, userId),
                cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            return Ok(new { message = "Messages deleted successfully" });
        }


        /// <summary>
        /// Pins a message (admin/owner only)
        /// </summary>
        [HttpPost("{messageId:guid}/pin")]
        [RequirePermission("Messages.Send")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> PinMessage(
            [FromRoute] Guid channelId,
            [FromRoute] Guid messageId,
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == Guid.Empty)
                return Unauthorized();

            var result = await _mediator.Send(
                new PinMessageCommand(messageId, userId),
                cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            return Ok(new { message = "Message pinned successfully" });
        }



        /// <summary>
        /// Unpins a message (admin/owner only)
        /// </summary>
        [HttpDelete("{messageId:guid}/pin")]
        [RequirePermission("Messages.Send")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> UnpinMessage(
            [FromRoute] Guid channelId,
            [FromRoute] Guid messageId,
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == Guid.Empty)
                return Unauthorized();

            var result = await _mediator.Send(
                new UnpinMessageCommand(messageId, userId),
                cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            return Ok(new { message = "Message unpinned successfully" });
        }



        /// <summary>
        /// Toggles a message as "Read Later" for the current user
        /// If same message clicked -> unmark (toggle off)
        /// If different message clicked -> mark new one (auto-switches)
        /// </summary>
        [HttpPost("{messageId:guid}/mark-later/toggle")]
        [RequirePermission("Messages.Read")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        public async Task<IActionResult> ToggleMessageAsLater(
            [FromRoute] Guid channelId,
            [FromRoute] Guid messageId,
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == Guid.Empty)
                return Unauthorized();

            var result = await _mediator.Send(
                new ToggleMessageAsLaterCommand(channelId, messageId, userId),
                cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            return Ok(new { message = "Read later toggled successfully" });
        }


        /// <summary>
        /// Adds a message to favorites for the current user
        /// </summary>
        [HttpPost("{messageId:guid}/favorite")]
        [RequirePermission("Messages.Read")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        public async Task<IActionResult> AddFavorite(
            [FromRoute] Guid channelId,
            [FromRoute] Guid messageId,
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == Guid.Empty)
                return Unauthorized();

            var result = await _mediator.Send(
                new AddFavoriteCommand(channelId, messageId, userId),
                cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            return Ok(new { message = "Added to favorites" });
        }

        /// <summary>
        /// Removes a message from favorites for the current user
        /// </summary>
        [HttpDelete("{messageId:guid}/favorite")]
        [RequirePermission("Messages.Read")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        public async Task<IActionResult> RemoveFavorite(
            [FromRoute] Guid channelId,
            [FromRoute] Guid messageId,
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == Guid.Empty)
                return Unauthorized();

            var result = await _mediator.Send(
                new RemoveFavoriteCommand(channelId, messageId, userId),
                cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            return Ok(new { message = "Removed from favorites" });
        }


        /// <summary>
        /// Toggles a reaction on a message (add if not exists, remove if exists)
        /// </summary>
        [HttpPost("{messageId:guid}/reactions/toggle")]
        [RequirePermission("Messages.Read")]
        [ProducesResponseType(typeof(List<ChannelMessageReactionDto>), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> ToggleReaction(
            [FromRoute] Guid channelId,
            [FromRoute] Guid messageId,
            [FromBody] ChannelToggleReactionRequest request,
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == Guid.Empty)
                return Unauthorized();

            var result = await _mediator.Send(
                new ToggleReactionCommand(messageId, userId, request.Reaction),
                cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            return Ok(new { reactions = result.Value, message = "Reaction toggled successfully" });
        }


        /// <summary>
        /// Gets detailed reaction info for a message (who reacted with what)
        /// </summary>
        [HttpGet("{messageId:guid}/reactions")]
        [RequirePermission("Messages.Read")]
        [ProducesResponseType(typeof(List<ChannelMessageReactionDto>), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        public async Task<IActionResult> GetReactions(
            [FromRoute] Guid channelId,
            [FromRoute] Guid messageId,
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == Guid.Empty)
                return Unauthorized();

            var result = await _mediator.Send(
                new GetMessageReactionsQuery(messageId, channelId, userId),
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