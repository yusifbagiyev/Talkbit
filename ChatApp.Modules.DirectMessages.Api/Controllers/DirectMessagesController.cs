using ChatApp.Modules.DirectMessages.Application.Commands.DirectConversations;
using ChatApp.Modules.DirectMessages.Application.Commands.DirectMessageReactions;
using ChatApp.Modules.DirectMessages.Application.Commands.DirectMessages;
using ChatApp.Modules.DirectMessages.Application.Commands.MessageConditions;
using ChatApp.Modules.DirectMessages.Application.DTOs.Request;
using ChatApp.Modules.DirectMessages.Application.DTOs.Response;
using ChatApp.Modules.DirectMessages.Application.Queries;
using ChatApp.Modules.DirectMessages.Application.Queries.GetFavoriteMessages;
using ChatApp.Modules.DirectMessages.Application.Queries.GetMessageReactions;
using ChatApp.Modules.DirectMessages.Application.Queries.GetPinnedMessages;
using ChatApp.Shared.Infrastructure.Authorization;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using BackendMentionRequest = ChatApp.Modules.DirectMessages.Application.Commands.DirectMessages.MentionRequest;

namespace ChatApp.Modules.DirectMessages.Api.Controllers
{
    /// <summary>
    /// Controller for managing direct messages within conversations
    /// </summary>
    [ApiController]
    [Route("api/conversations/{conversationId:guid}/messages")]
    [Authorize]
    public class DirectMessagesController:ControllerBase
    {
        private readonly IMediator _mediator;

        public DirectMessagesController(IMediator mediator)
        {
            _mediator = mediator;
        }


        /// <summary>
        /// Gets messages in a conversation with pagination (newest first by default)
        /// </summary>
        [HttpGet]
        [RequirePermission("Messages.Read")]
        [ProducesResponseType(typeof(List<DirectMessageDto>),StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> GetMessages(
            [FromRoute] Guid conversationId,
            [FromQuery] int pageSize=30,
            [FromQuery] DateTime? before=null,
            CancellationToken cancellationToken =default)
        {
            var userId = GetCurrentUserId();
            if (userId == Guid.Empty)
                return Unauthorized();

            // Validate pagination
            if (pageSize < 1 || pageSize > 30)
                return BadRequest(new { error = "Page size must be between 1 and 30" });

            var result = await _mediator.Send(
                new GetConversationMessagesQuery(conversationId, userId, pageSize, before),
                cancellationToken);

            if(result.IsFailure)
                return BadRequest(new {error=result.Error});

            return Ok(result.Value);
        }

        /// <summary>
        /// Gets messages around a specific message (for navigation to pinned/favorite messages)
        /// </summary>
        [HttpGet("around/{messageId:guid}")]
        [RequirePermission("Messages.Read")]
        [ProducesResponseType(typeof(List<DirectMessageDto>), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> GetMessagesAround(
            [FromRoute] Guid conversationId,
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
                new GetConversationMessagesAroundQuery(conversationId, messageId, userId, count),
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
        [ProducesResponseType(typeof(List<DirectMessageDto>), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> GetMessagesBefore(
            [FromRoute] Guid conversationId,
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
                new GetMessagesBeforeDateQuery(conversationId, date, userId, limit),
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
        [ProducesResponseType(typeof(List<DirectMessageDto>), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> GetMessagesAfter(
            [FromRoute] Guid conversationId,
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
                new GetMessagesAfterDateQuery(conversationId, date, userId, limit),
                cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            return Ok(result.Value);
        }




        /// <summary>
        /// Gets messages with files in a conversation (for Files & Media panel)
        /// </summary>
        [HttpGet("files")]
        [RequirePermission("Messages.Read")]
        [ProducesResponseType(typeof(List<DirectMessageDto>), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> GetFiles(
            [FromRoute] Guid conversationId,
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
                new GetConversationFilesQuery(conversationId, userId, pageSize, before, isMedia),
                cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            return Ok(result.Value);
        }


        /// <summary>
        /// Gets messages containing links in a conversation (for All Links panel)
        /// </summary>
        [HttpGet("links")]
        [RequirePermission("Messages.Read")]
        [ProducesResponseType(typeof(List<DirectMessageDto>), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> GetLinks(
            [FromRoute] Guid conversationId,
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
                new GetConversationLinksQuery(conversationId, userId, pageSize, before),
                cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            return Ok(result.Value);
        }


        /// <summary>
        /// Gets unread message count for the current user in this conversation
        /// </summary>
        [HttpGet("unread-count")]
        [RequirePermission("Messages.Read")]
        [ProducesResponseType(typeof(int),StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> GetUnreadCount(
            [FromRoute] Guid conversationId,
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == Guid.Empty)
                return Unauthorized();

            var result = await _mediator.Send(
                new GetUnreadCountQuery(conversationId, userId),
                cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            return Ok(new {unreadCount=result.Value});
        }




        /// <summary>
        /// Gets pinned messages in a conversation
        /// </summary>
        [HttpGet("pinned")]
        [RequirePermission("Messages.Read")]
        [ProducesResponseType(typeof(List<DirectMessageDto>), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> GetPinnedMessages(
            [FromRoute] Guid conversationId,
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == Guid.Empty)
                return Unauthorized();

            var result = await _mediator.Send(
                new GetPinnedMessagesQuery(conversationId, userId),
                cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            return Ok(result.Value);
        }

        /// <summary>
        /// Gets favorite messages in a conversation
        /// </summary>
        [HttpGet("favorites")]
        [RequirePermission("Messages.Read")]
        [ProducesResponseType(typeof(List<FavoriteDirectMessageDto>), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> GetFavoriteMessages(
            [FromRoute] Guid conversationId,
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == Guid.Empty)
                return Unauthorized();

            var result = await _mediator.Send(
                new GetFavoriteMessagesQuery(conversationId, userId),
                cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            return Ok(result.Value);
        }

        /// <summary>
        /// PERFORMANCE: Sends multiple messages in a single batch (for multi-file uploads).
        /// Reduces N API calls to 1 and wraps all messages in single transaction.
        /// </summary>
        [HttpPost("batch")]
        [RequirePermission("Messages.Send")]
        [ProducesResponseType(typeof(List<Guid>), StatusCodes.Status201Created)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> SendBatchMessages(
            [FromRoute] Guid conversationId,
            [FromBody] BatchSendMessagesRequest request,
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == Guid.Empty)
                return Unauthorized();

            // Map DTO mentions to domain mentions
            var mentions = request.Mentions?.Select(m => new BackendMentionRequest(m.UserId, m.UserFullName)).ToList();

            var command = new SendBatchDirectMessagesCommand(
                conversationId,
                userId,
                request.Messages,
                request.ReplyToMessageId,
                request.IsForwarded,
                mentions);

            var result = await _mediator.Send(command, cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            return CreatedAtAction(nameof(GetMessages), new { conversationId }, result.Value);
        }

        /// <summary>
        /// Sends a message in the conversation
        /// </summary>
        [HttpPost]
        [RequirePermission("Messages.Send")]
        [ProducesResponseType(typeof(Guid),StatusCodes.Status201Created)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> SendMessage(
            [FromRoute] Guid conversationId,
            [FromBody] SendMessageRequest request,
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == Guid.Empty)
                return Unauthorized();

            // Convert frontend MentionRequest to backend MentionRequest
            List<BackendMentionRequest>? mentions = null;
            if (request.Mentions != null && request.Mentions.Count > 0)
            {
                mentions = request.Mentions
                    .Where(m => m.UserId != Guid.Empty)
                    .Select(m => new BackendMentionRequest(m.UserId, m.UserFullName))
                    .ToList();
            }

            var result = await _mediator.Send(
                new SendDirectMessageCommand(
                    conversationId,
                    userId,
                    request.Content,
                    request.FileId,
                    request.ReplyToMessageId,
                    request.IsForwarded,
                    mentions),
                cancellationToken);

            if (result.IsFailure)
                return BadRequest(new {error=result.Error});

            return CreatedAtAction(
                nameof(GetMessages),
                new { conversationId },
                new { messageId = result.Value, message = "Message sent succesfully" });
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
            [FromRoute] Guid conversationId,
            [FromRoute] Guid messageId,
            [FromBody] EditMessageRequest request,
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if(userId==Guid.Empty)
                return Unauthorized();

            var result = await _mediator.Send(
                new EditDirectMessageCommand(messageId, request.NewContent, userId),
                cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            return Ok(new {message="Message edited succesfully"});
        }



        /// <summary>
        /// Deletes a message (only sender can delete)
        /// </summary>
        [HttpDelete("{messageId:guid}")]
        [RequirePermission("Messages.Delete")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> DeleteMessage(
            [FromRoute] Guid conversationId,
            [FromRoute] Guid messageId,
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if(userId==Guid.Empty)
                return Unauthorized();

            var result = await _mediator.Send(
                new DeleteDirectMessageCommand(messageId, userId),
                cancellationToken);

            if(result.IsFailure)
                return BadRequest(new {error=result.Error});

            return Ok(new { message = "Message deleted successfully", hardDeleted = result.Value });
        }


        /// <summary>
        /// Batch deletes multiple messages (only sender can delete their own)
        /// </summary>
        [HttpPost("batch-delete")]
        [RequirePermission("Messages.Delete")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> BatchDeleteMessages(
            [FromRoute] Guid conversationId,
            [FromBody] BatchDeleteRequest request,
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == Guid.Empty)
                return Unauthorized();

            var result = await _mediator.Send(
                new BatchDeleteDirectMessagesCommand(conversationId, request.MessageIds, userId),
                cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            return Ok(new { message = "Messages deleted successfully" });
        }


        /// <summary>
        /// Marks all unread messages in the conversation as read (bulk operation)
        /// </summary>
        [HttpPost("mark-as-read")]
        [RequirePermission("Messages.Read")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        public async Task<IActionResult> MarkAllAsRead(
            [FromRoute] Guid conversationId,
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == Guid.Empty)
                return Unauthorized();

            var result = await _mediator.Send(
                new MarkDirectMessagesAsReadCommand(conversationId, userId),
                cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            return Ok(new { message = "Messages marked as read" });
        }


        /// <summary>
        /// Marks a message as read (only receiver can mark as read)
        /// </summary>
        [HttpPost("{messageId:guid}/read")]
        [RequirePermission("Messages.Read")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> MarkAsRead(
            [FromRoute] Guid conversationId,
            [FromRoute] Guid messageId,
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if(userId== Guid.Empty)
                return Unauthorized();

            var result = await _mediator.Send(
                new MarkMessageAsReadCommand(messageId, userId),
                cancellationToken);

            if (result.IsFailure)
                return BadRequest(new {error=result.Error});

            return Ok(new { message = "Message marked as read" });
        }


        /// <summary>
        /// Batch marks multiple messages as read (viewport-based, N request → 1 request)
        /// </summary>
        [HttpPost("batch-read")]
        [RequirePermission("Messages.Read")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        public async Task<IActionResult> BatchMarkAsRead(
            [FromRoute] Guid conversationId,
            [FromBody] BatchReadRequest request,
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == Guid.Empty)
                return Unauthorized();

            var result = await _mediator.Send(
                new BatchMarkMessagesAsReadCommand(conversationId, request.MessageIds, userId),
                cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            return Ok(new { message = "Messages marked as read" });
        }


        /// <summary>
        /// Toggles a reaction on a message (add/remove/replace)
        /// </summary>
        [HttpPut("{messageId:guid}/reactions/toggle")]
        [RequirePermission("Messages.Read")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        public async Task<IActionResult> ToggleReaction(
            [FromRoute] Guid conversationId,
            [FromRoute] Guid messageId,
            [FromBody] DirectMessageToggleReactionRequest request,
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

            return Ok(result.Value);
        }


        /// <summary>
        /// Gets detailed reaction info for a message (who reacted with what)
        /// </summary>
        [HttpGet("{messageId:guid}/reactions")]
        [RequirePermission("Messages.Read")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        public async Task<IActionResult> GetReactions(
            [FromRoute] Guid conversationId,
            [FromRoute] Guid messageId,
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == Guid.Empty)
                return Unauthorized();

            var result = await _mediator.Send(
                new GetMessageReactionsQuery(messageId, conversationId, userId),
                cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            return Ok(result.Value);
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
            [FromRoute] Guid conversationId,
            [FromRoute] Guid messageId,
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == Guid.Empty)
                return Unauthorized();

            var result = await _mediator.Send(
                new ToggleMessageAsLaterCommand(conversationId, messageId, userId),
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
            [FromRoute] Guid conversationId,
            [FromRoute] Guid messageId,
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == Guid.Empty)
                return Unauthorized();

            var result = await _mediator.Send(
                new AddFavoriteCommand(conversationId, messageId, userId),
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
            [FromRoute] Guid conversationId,
            [FromRoute] Guid messageId,
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == Guid.Empty)
                return Unauthorized();

            var result = await _mediator.Send(
                new RemoveFavoriteCommand(conversationId, messageId, userId),
                cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            return Ok(new { message = "Removed from favorites" });
        }


        /// <summary>
        /// Pins a message
        /// </summary>
        [HttpPost("{messageId:guid}/pin")]
        [RequirePermission("Messages.Read")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> PinMessage(
            [FromRoute] Guid conversationId,
            [FromRoute] Guid messageId,
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == Guid.Empty)
                return Unauthorized();

            var result = await _mediator.Send(
                new PinDirectMessageCommand(messageId, userId),
                cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            return Ok(new { message = "Message pinned successfully" });
        }




        /// <summary>
        /// Unpins a message
        /// </summary>
        [HttpDelete("{messageId:guid}/pin")]
        [RequirePermission("Messages.Read")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> UnpinMessage(
            [FromRoute] Guid conversationId,
            [FromRoute] Guid messageId,
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == Guid.Empty)
                return Unauthorized();

            var result = await _mediator.Send(
                new UnpinDirectMessageCommand(messageId, userId),
                cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            return Ok(new { message = "Message unpinned successfully" });
        }



        /// <summary>
        /// Toggle pin status for a conversation
        /// </summary>
        [HttpPost("toggle-pin")]
        [RequirePermission("Messages.Read")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        public async Task<IActionResult> TogglePinConversation(
            [FromRoute] Guid conversationId,
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == Guid.Empty)
                return Unauthorized();

            var result = await _mediator.Send(
                new TogglePinConversationCommand(conversationId, userId),
                cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            return Ok(new { isPinned = result.Value });
        }



        /// <summary>
        /// Toggle mute status for a conversation
        /// </summary>
        [HttpPost("toggle-mute")]
        [RequirePermission("Messages.Read")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        public async Task<IActionResult> ToggleMuteConversation(
            [FromRoute] Guid conversationId,
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == Guid.Empty)
                return Unauthorized();

            var result = await _mediator.Send(
                new ToggleMuteConversationCommand(conversationId, userId),
                cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            return Ok(new { isMuted = result.Value });
        }



        /// <summary>
        /// Toggle hide/unhide a conversation from conversation list
        /// </summary>
        [HttpPost("hide")]
        [RequirePermission("Messages.Read")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        public async Task<IActionResult> HideConversation(
            [FromRoute] Guid conversationId,
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == Guid.Empty)
                return Unauthorized();

            var result = await _mediator.Send(
                new HideConversationCommand(conversationId, userId),
                cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            return Ok(new { isHidden = result.Value });
        }



        /// <summary>
        /// Toggle mark as read later for a conversation
        /// </summary>
        [HttpPost("toggle-read-later")]
        [RequirePermission("Messages.Read")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        public async Task<IActionResult> ToggleMarkConversationAsReadLater(
            [FromRoute] Guid conversationId,
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == Guid.Empty)
                return Unauthorized();

            var result = await _mediator.Send(
                new ToggleMarkConversationAsReadLaterCommand(conversationId, userId),
                cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            return Ok(new { isMarkedReadLater = result.Value });
        }



        /// <summary>
        /// Mark all unread messages as read in a conversation
        /// Clears LastReadLaterMessageId and IsMarkedReadLater flags
        /// </summary>
        [HttpPost("mark-all-read")]
        [RequirePermission("Messages.Read")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        public async Task<IActionResult> MarkAllMessagesAsRead(
            [FromRoute] Guid conversationId,
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == Guid.Empty)
                return Unauthorized();

            var result = await _mediator.Send(
                new MarkAllMessagesAsReadCommand(conversationId, userId),
                cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            return Ok(new { markedCount = result.Value, message = "All messages marked as read" });
        }



        /// <summary>
        /// Unmark conversation as read later (called when conversation is opened)
        /// Only clears IsMarkedReadLater flag, keeps LastReadLaterMessageId if exists
        /// </summary>
        [HttpDelete("read-later")]
        [RequirePermission("Messages.Read")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        public async Task<IActionResult> UnmarkConversationReadLater(
            [FromRoute] Guid conversationId,
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == Guid.Empty)
                return Unauthorized();

            var result = await _mediator.Send(
                new UnmarkConversationReadLaterCommand(conversationId, userId),
                cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            return Ok(new { message = "Conversation unmarked as read later" });
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