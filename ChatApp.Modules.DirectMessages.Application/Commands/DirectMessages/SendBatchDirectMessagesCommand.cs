using ChatApp.Modules.DirectMessages.Application.DTOs.Request;
using ChatApp.Modules.DirectMessages.Application.Interfaces;
using ChatApp.Modules.DirectMessages.Domain.Entities;
using ChatApp.Modules.DirectMessages.Domain.Events;
using ChatApp.Shared.Infrastructure.SignalR.Services;
using ChatApp.Shared.Kernel.Common;
using ChatApp.Shared.Kernel.Interfaces;
using FluentValidation;
using MediatR;
using Microsoft.Extensions.Logging;

namespace ChatApp.Modules.DirectMessages.Application.Commands.DirectMessages;

/// <summary>
/// PERFORMANCE: Batch message sending - reduces N API calls to 1.
/// Wraps multiple messages in single database transaction.
/// </summary>
public record SendBatchDirectMessagesCommand(
    Guid ConversationId,
    Guid SenderId,
    List<BatchMessageItem> Messages,
    Guid? ReplyToMessageId = null,
    bool IsForwarded = false,
    List<MentionRequest>? Mentions = null
) : IRequest<Result<List<Guid>>>;

public class SendBatchDirectMessagesCommandValidator : AbstractValidator<SendBatchDirectMessagesCommand>
{
    public SendBatchDirectMessagesCommandValidator()
    {
        RuleFor(x => x.ConversationId)
            .NotEmpty().WithMessage("Conversation ID is required");

        RuleFor(x => x.SenderId)
            .NotEmpty().WithMessage("Sender ID is required");

        RuleFor(x => x.Messages)
            .NotEmpty().WithMessage("At least one message required")
            .Must(m => m.Count <= 20).WithMessage("Maximum 20 messages per batch");

        RuleForEach(x => x.Messages).ChildRules(message =>
        {
            message.RuleFor(m => m.Content)
                .MaximumLength(10000).WithMessage("Message content cannot exceed 10000 characters");

            message.RuleFor(m => m)
                .Must(m => !string.IsNullOrWhiteSpace(m.Content) || !string.IsNullOrWhiteSpace(m.FileId))
                .WithMessage("Each message must have content or file attachment");
        });
    }
}

public class SendBatchDirectMessagesCommandHandler : IRequestHandler<SendBatchDirectMessagesCommand, Result<List<Guid>>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IEventBus _eventBus;
    private readonly ISignalRNotificationService _signalRNotificationService;
    private readonly ILogger<SendBatchDirectMessagesCommandHandler> _logger;

    public SendBatchDirectMessagesCommandHandler(
        IUnitOfWork unitOfWork,
        IEventBus eventBus,
        ISignalRNotificationService signalRNotificationService,
        ILogger<SendBatchDirectMessagesCommandHandler> logger)
    {
        _unitOfWork = unitOfWork;
        _eventBus = eventBus;
        _signalRNotificationService = signalRNotificationService;
        _logger = logger;
    }

    public async Task<Result<List<Guid>>> Handle(
        SendBatchDirectMessagesCommand request,
        CancellationToken cancellationToken = default)
    {
        try
        {
            _logger.LogInformation(
                "Sending batch of {Count} messages in conversation {ConversationId}",
                request.Messages.Count,
                request.ConversationId);

            // Get conversation
            var conversation = await _unitOfWork.Conversations.GetByIdAsync(
                request.ConversationId,
                cancellationToken);

            if (conversation == null)
            {
                return Result.Failure<List<Guid>>("Conversation not found");
            }

            // Validate participant
            if (conversation.User1Id != request.SenderId && conversation.User2Id != request.SenderId)
            {
                return Result.Failure<List<Guid>>("User is not a participant in this conversation");
            }

            // Get receiver ID
            var receiverId = conversation.GetOtherUserId(request.SenderId);

            // PERFORMANCE: Single transaction for all messages
            var messageIds = new List<Guid>();
            var createdMessages = new List<DirectMessage>();

            // Process first message with mentions and reply
            var firstItem = request.Messages[0];
            var firstMessage = await CreateMessage(
                request.ConversationId,
                request.SenderId,
                receiverId,
                firstItem.Content,
                firstItem.FileId,
                request.ReplyToMessageId,
                request.IsForwarded,
                request.Mentions,
                cancellationToken);

            // Notes conversation: Mark first message as read immediately
            if (conversation.IsNotes)
            {
                firstMessage.MarkAsRead();
            }

            createdMessages.Add(firstMessage);
            messageIds.Add(firstMessage.Id);

            // Process remaining messages (no mentions/reply)
            for (int i = 1; i < request.Messages.Count; i++)
            {
                var item = request.Messages[i];
                var message = await CreateMessage(
                    request.ConversationId,
                    request.SenderId,
                    receiverId,
                    item.Content,
                    item.FileId,
                    null, // No reply for subsequent messages
                    request.IsForwarded,
                    null, // No mentions for subsequent messages
                    cancellationToken);

                // Notes conversation: Mark all as read
                if (conversation.IsNotes)
                {
                    message.MarkAsRead();
                }

                createdMessages.Add(message);
                messageIds.Add(message.Id);
            }

            // Update conversation last message time
            conversation.UpdateLastMessageTime();
            if (!conversation.HasMessages)
            {
                conversation.MarkAsHasMessages();
            }
            await _unitOfWork.Conversations.UpdateAsync(conversation, cancellationToken);

            // Save all messages in single transaction
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            // Send SignalR notifications for each message
            foreach (var message in createdMessages)
            {
                var messageDto = await _unitOfWork.Messages.GetByIdAsDtoAsync(message.Id, cancellationToken);
                if (messageDto != null)
                {
                    await _signalRNotificationService.NotifyDirectMessageAsync(
                        request.ConversationId,
                        receiverId,
                        messageDto);
                }

                // Publish domain event for internal backend processing
                await _eventBus.PublishAsync(
                    new MessageSentEvent(
                        message.Id,
                        message.ConversationId,
                        message.SenderId,
                        receiverId,
                        message.Content,
                        message.CreatedAtUtc),
                    cancellationToken);
            }

            _logger.LogInformation(
                "Successfully sent batch of {Count} messages",
                createdMessages.Count);

            return Result.Success(messageIds);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error sending batch messages");
            return Result.Failure<List<Guid>>($"Failed to send batch messages: {ex.Message}");
        }
    }

    private async Task<DirectMessage> CreateMessage(
        Guid conversationId,
        Guid senderId,
        Guid receiverId,
        string content,
        string? fileId,
        Guid? replyToMessageId,
        bool isForwarded,
        List<MentionRequest>? mentions,
        CancellationToken cancellationToken)
    {
        // Create message using constructor (same pattern as SendDirectMessageCommand)
        var message = new DirectMessage(
            conversationId,
            senderId,
            receiverId,
            content,
            fileId,
            replyToMessageId,
            isForwarded);

        await _unitOfWork.Messages.AddAsync(message, cancellationToken);

        // Add mentions if provided
        if (mentions != null && mentions.Count > 0)
        {
            foreach (var mention in mentions)
            {
                var directMessageMention = new DirectMessageMention(
                    message.Id,
                    mention.UserId,
                    mention.UserFullName);
                message.Mentions.Add(directMessageMention);
            }
        }

        return message;
    }
}
