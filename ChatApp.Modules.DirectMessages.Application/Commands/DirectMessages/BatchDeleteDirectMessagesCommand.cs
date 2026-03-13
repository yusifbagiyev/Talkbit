using ChatApp.Modules.DirectMessages.Application.DTOs.Response;
using ChatApp.Modules.DirectMessages.Application.Interfaces;
using ChatApp.Shared.Infrastructure.SignalR.Services;
using ChatApp.Shared.Kernel.Common;
using FluentValidation;
using MediatR;
using Microsoft.Extensions.Logging;

namespace ChatApp.Modules.DirectMessages.Application.Commands.DirectMessages
{
    public record BatchDeleteDirectMessagesCommand(
        Guid ConversationId,
        List<Guid> MessageIds,
        Guid RequestedBy
    ) : IRequest<Result>;


    public class BatchDeleteDirectMessagesCommandValidator : AbstractValidator<BatchDeleteDirectMessagesCommand>
    {
        public BatchDeleteDirectMessagesCommandValidator()
        {
            RuleFor(x => x.ConversationId)
                .NotEmpty().WithMessage("Conversation ID is required");
            RuleFor(x => x.MessageIds)
                .NotEmpty().WithMessage("At least one message ID is required");
            RuleFor(x => x.RequestedBy)
                .NotEmpty().WithMessage("Requester ID is required");
        }
    }


    public class BatchDeleteDirectMessagesCommandHandler : IRequestHandler<BatchDeleteDirectMessagesCommand, Result>
    {
        private readonly IUnitOfWork _unitOfWork;
        private readonly ISignalRNotificationService _signalRNotificationService;
        private readonly ILogger<BatchDeleteDirectMessagesCommandHandler> _logger;

        public BatchDeleteDirectMessagesCommandHandler(
            IUnitOfWork unitOfWork,
            ISignalRNotificationService signalRNotificationService,
            ILogger<BatchDeleteDirectMessagesCommandHandler> logger)
        {
            _unitOfWork = unitOfWork;
            _signalRNotificationService = signalRNotificationService;
            _logger = logger;
        }

        public async Task<Result> Handle(
            BatchDeleteDirectMessagesCommand request,
            CancellationToken cancellationToken = default)
        {
            try
            {
                _logger.LogInformation("Batch deleting {Count} messages in conversation {ConversationId}",
                    request.MessageIds.Count, request.ConversationId);

                var messages = await _unitOfWork.Messages.GetByIdsAsync(
                    request.MessageIds, cancellationToken);

                if (messages.Count == 0)
                    return Result.Failure("No messages found");

                // Verify all messages belong to the specified conversation
                var wrongConversationMessages = messages.Where(m => m.ConversationId != request.ConversationId).ToList();
                if (wrongConversationMessages.Count > 0)
                    return Result.Failure("Some messages don't belong to the specified conversation");

                // Only sender can delete their own messages
                var unauthorizedMessages = messages.Where(m => m.SenderId != request.RequestedBy).ToList();
                if (unauthorizedMessages.Count > 0)
                    return Result.Failure("You can only delete your own messages");

                // Soft delete all messages
                foreach (var message in messages)
                {
                    message.Delete();
                }

                await _unitOfWork.SaveChangesAsync(cancellationToken);

                // Send SignalR notifications for each deleted message
                foreach (var message in messages)
                {
                    var messageDto = new DirectMessageDto(
                        Id: message.Id,
                        ConversationId: message.ConversationId,
                        SenderId: message.SenderId,
                        SenderEmail: string.Empty,
                        SenderFullName: string.Empty,
                        SenderAvatarUrl: null,
                        ReceiverId: message.ReceiverId,
                        Content: message.Content,
                        FileId: message.FileId,
                        FileName: null,
                        FileContentType: null,
                        FileSizeInBytes: null,
                        FileUrl: null,
                        ThumbnailUrl: null,
                        FileWidth: null,
                        FileHeight: null,
                        IsEdited: message.IsEdited,
                        IsDeleted: true,
                        IsRead: message.IsRead,
                        ReadAtUtc: message.ReadAtUtc,
                        IsPinned: message.IsPinned,
                        ReactionCount: 0,
                        CreatedAtUtc: message.CreatedAtUtc,
                        EditedAtUtc: message.EditedAtUtc,
                        PinnedAtUtc: message.PinnedAtUtc,
                        ReplyToMessageId: message.ReplyToMessageId,
                        ReplyToContent: null,
                        ReplyToSenderName: null,
                        ReplyToFileId: null,
                        ReplyToFileName: null,
                        ReplyToFileContentType: null,
                        ReplyToFileUrl: null,
                        ReplyToThumbnailUrl: null,
                        IsForwarded: message.IsForwarded,
                        Reactions: new List<DirectMessageReactionDto>()
                    );

                    await _signalRNotificationService.NotifyDirectMessageDeletedAsync(
                        message.ConversationId,
                        message.ReceiverId,
                        messageDto);
                }

                _logger.LogInformation("Batch deleted {Count} messages successfully", messages.Count);
                return Result.Success();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error batch deleting messages");
                return Result.Failure(ex.Message);
            }
        }
    }
}
