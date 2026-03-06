using ChatApp.Modules.DirectMessages.Application.Interfaces;
using ChatApp.Modules.DirectMessages.Domain.Entities;
using ChatApp.Modules.DirectMessages.Domain.Events;
using ChatApp.Shared.Infrastructure.SignalR.Services;
using ChatApp.Shared.Kernel.Common;
using ChatApp.Shared.Kernel.Exceptions;
using ChatApp.Shared.Kernel.Interfaces;
using FluentValidation;
using MediatR;
using Microsoft.Extensions.Logging;

namespace ChatApp.Modules.DirectMessages.Application.Commands.DirectMessages
{
    public record SendDirectMessageCommand(
        Guid ConversationId,
        Guid SenderId,
        string Content,
        string? FileId = null,
        Guid? ReplyToMessageId = null,
        bool IsForwarded = false,
        List<MentionRequest>? Mentions = null
    ):IRequest<Result<Guid>>;

    public record MentionRequest(Guid UserId, string UserFullName);



    public class SendDirectMessageCommandValidator : AbstractValidator<SendDirectMessageCommand>
    {
        public SendDirectMessageCommandValidator()
        {
            RuleFor(x => x.ConversationId)
                .NotEmpty().WithMessage("Conversation ID is required");

            RuleFor(x => x.SenderId)
                .NotEmpty().WithMessage("Sender ID is required");

            RuleFor(x => x.Content)
                .MaximumLength(10000).WithMessage("Message content cannot exceed 10000 characters");

            RuleFor(x => x)
                .Must(x => !string.IsNullOrWhiteSpace(x.Content) || !string.IsNullOrWhiteSpace(x.FileId))
                .WithMessage("Message must have content or file attachment");
        }
    }


    public class SendDirectMessageCommandHandler : IRequestHandler<SendDirectMessageCommand, Result<Guid>>
    {
        private readonly IUnitOfWork _unitOfWork;
        private readonly IEventBus _eventBus;
        private readonly ISignalRNotificationService _signalRNotificationService;
        private readonly ILogger<SendDirectMessageCommandHandler> _logger;

        public SendDirectMessageCommandHandler(
            IUnitOfWork unitOfWork,
            IEventBus eventBus,
            ISignalRNotificationService signalRNotificationService,
            ILogger<SendDirectMessageCommandHandler> logger)
        {
            _unitOfWork = unitOfWork;
            _eventBus = eventBus;
            _signalRNotificationService= signalRNotificationService;
            _logger = logger;
        }


        public async Task<Result<Guid>> Handle(
            SendDirectMessageCommand request,
            CancellationToken cancellationToken = default)
        {
            try
            {
                _logger?.LogInformation(
                    "Sending message in conversation {ConversationId}",
                    request.ConversationId);

                // Get conversation
                var conversation = await _unitOfWork.Conversations.GetByIdAsync(
                    request.ConversationId,
                    cancellationToken) 
                    ?? throw new NotFoundException($"Conversation with ID {request.ConversationId} not found");

                // Verify sender is participant
                if (!conversation.IsParticipant(request.SenderId))
                {
                    return Result.Failure<Guid>("You are not a participant in this conversation");
                }

                // Get receiver ID
                var receiverId = conversation.GetOtherUserId(request.SenderId);

                // Auto-unhide: When new message arrives, unhide conversation for both sender and receiver
                var conversationMembers =await _unitOfWork.ConversationMembers.GetConversationMembers(
                    request.ConversationId,
                    cancellationToken);
                var hiddenMembers=conversationMembers.Where(m=>m.IsActive && m.IsHidden).ToList();
                foreach (var member in hiddenMembers)
                {
                    member.Unhide();
                }
                if (hiddenMembers.Count != 0)
                {
                    await _unitOfWork.SaveChangesAsync(cancellationToken);
                }

                // Create message
                var message = new DirectMessage(
                    request.ConversationId,
                    request.SenderId,
                    receiverId,
                    request.Content,
                    request.FileId,
                    request.ReplyToMessageId,
                    request.IsForwarded);

                // Notes conversation: Mark message as read immediately (self-conversation)
                if (conversation.IsNotes)
                {
                    message.MarkAsRead();
                }

                await _unitOfWork.Messages.AddAsync(message, cancellationToken);

                // Add mentions if provided
                if (request.Mentions != null && request.Mentions.Count > 0)
                {
                    foreach (var mentionReq in request.Mentions)
                    {
                        var mention = new DirectMessageMention(
                            message.Id,
                            mentionReq.UserId,
                            mentionReq.UserFullName);

                        message.Mentions.Add(mention);
                    }
                }

                // Update conversation last message time and mark as having messages
                conversation.UpdateLastMessageTime();
                if (!conversation.HasMessages)
                {
                    conversation.MarkAsHasMessages();
                }
                await _unitOfWork.Conversations.UpdateAsync(conversation, cancellationToken);

                await _unitOfWork.SaveChangesAsync(cancellationToken);

                // Get the specific message DTO by ID for real-time broadcast
                // This ensures we send the exact message we just created, not another message from the conversation
                var messageDto = await _unitOfWork.Messages.GetByIdAsDtoAsync(message.Id, cancellationToken);

                if (messageDto != null)
                {
                    // Send real-time notification to receiver
                    await _signalRNotificationService.NotifyDirectMessageAsync(
                        request.ConversationId,
                        receiverId,
                        messageDto);
                }


                // Publish domain event for internal backend processing (email notifications, etc.)
                await _eventBus.PublishAsync(
                    new MessageSentEvent(
                        message.Id,
                        request.ConversationId,
                        request.SenderId,
                        receiverId,
                        request.Content,
                        message.CreatedAtUtc),
                    cancellationToken);

                _logger?.LogInformation("Message {MessageId} sent succesfully", message.Id);

                return Result.Success(message.Id);
            }
            catch (Exception ex)
            {
                _logger?.LogError(ex, "Error sending message");
                return Result.Failure<Guid>("An error occurred while sending message");
            }
        }
    }
}