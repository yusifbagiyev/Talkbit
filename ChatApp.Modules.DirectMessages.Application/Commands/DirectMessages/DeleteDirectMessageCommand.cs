using ChatApp.Modules.DirectMessages.Application.DTOs.Response;
using ChatApp.Modules.DirectMessages.Application.Interfaces;
using ChatApp.Shared.Infrastructure.SignalR.Services;
using ChatApp.Shared.Kernel.Common;
using ChatApp.Shared.Kernel.Exceptions;
using FluentValidation;
using MediatR;
using Microsoft.Extensions.Logging;

namespace ChatApp.Modules.DirectMessages.Application.Commands.DirectMessages
{
    // Result<bool> — Value: true = hard delete, false = soft delete
    public record DeleteDirectMessageCommand(
        Guid MessageId,
        Guid RequestedBy
    ):IRequest<Result<bool>>;


    public class DeleteDirectMessageCommandValidator : AbstractValidator<DeleteDirectMessageCommand>
    {
        public DeleteDirectMessageCommandValidator()
        {
            RuleFor(x => x.MessageId)
                .NotEmpty().WithMessage("Message ID is required");
            RuleFor(x => x.RequestedBy)
                .NotEmpty().WithMessage("Requester ID is required");
        }
    }


    public class DeleteDirectMessageCommandHandler : IRequestHandler<DeleteDirectMessageCommand, Result<bool>>
    {
        private readonly IUnitOfWork _unitOfWork;
        private readonly ISignalRNotificationService _signalRNotificationService;
        private readonly ILogger<DeleteDirectMessageCommandHandler> _logger;

        public DeleteDirectMessageCommandHandler(
            IUnitOfWork unitOfWork,
            ISignalRNotificationService signalRNotificationService,
            ILogger<DeleteDirectMessageCommandHandler> logger)
        {
            _unitOfWork = unitOfWork;
            _signalRNotificationService= signalRNotificationService;
            _logger = logger;
        }


        public async Task<Result<bool>> Handle(
            DeleteDirectMessageCommand request,
            CancellationToken cancellationToken = default)
        {
            try
            {
                _logger.LogInformation("Deleting message {MessageId}", request.MessageId);

                var message = await _unitOfWork.Messages.GetByIdAsync(
                    request.MessageId,
                    cancellationToken);

                if (message == null)
                    throw new NotFoundException($"Message with ID {request.MessageId} not found");

                // Only sender can delete their own message
                if(message.SenderId != request.RequestedBy)
                {
                    return Result.Failure<bool>("You can delete your own messages");
                }

                var conversationId = message.ConversationId;
                var receiverId = message.ReceiverId;
                var senderId = message.SenderId;
                var messageId = message.Id;

                if (message.IsRead)
                {
                    // ─── SOFT DELETE — qarşı tərəf oxuyub, "This message was deleted." göstəriləcək ───
                    message.Delete();

                    await _unitOfWork.SaveChangesAsync(cancellationToken);

                    var messageDto = new DirectMessageDto(
                        Id: messageId,
                        ConversationId: conversationId,
                        SenderId: senderId,
                        SenderEmail: string.Empty,
                        SenderFullName: string.Empty,
                        SenderAvatarUrl: null,
                        ReceiverId: receiverId,
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
                        conversationId,
                        receiverId,
                        messageDto);

                    _logger.LogInformation("Message {MessageId} soft deleted (was read)", messageId);
                    return Result.Success(false); // soft delete
                }
                else
                {
                    // ─── HARD DELETE — qarşı tərəf oxumayıb, bazadan tamamilə sil ───
                    await _unitOfWork.Messages.DeleteAsync(message, cancellationToken);
                    await _unitOfWork.SaveChangesAsync(cancellationToken);

                    // Əvvəlki son mesajı tap (conversation list preview üçün)
                    var prevMessages = await _unitOfWork.Messages.GetConversationMessagesAsync(
                        conversationId, pageSize: 1, cancellationToken: cancellationToken);
                    var prevMsg = prevMessages.FirstOrDefault();

                    // Preview mətni — fayl mesajları üçün [Image]/[File] formatı
                    string? prevLastMessage = prevMsg == null ? null :
                        prevMsg.IsDeleted ? "This message was deleted" :
                        prevMsg.FileId != null ?
                            (prevMsg.FileContentType != null && prevMsg.FileContentType.StartsWith("image/") ?
                                (string.IsNullOrWhiteSpace(prevMsg.Content) ? "[Image]" : "[Image] " + prevMsg.Content) :
                                (string.IsNullOrWhiteSpace(prevMsg.Content) ? "[File]" : "[File] " + prevMsg.Content)) :
                            prevMsg.Content;

                    // SignalR — hardDeleted + əvvəlki mesaj məlumatı (conversation list update üçün)
                    await _signalRNotificationService.NotifyDirectMessageDeletedAsync(
                        conversationId,
                        receiverId,
                        new
                        {
                            Id = messageId,
                            HardDeleted = true,
                            ConversationId = conversationId,
                            SenderId = senderId,
                            PreviousLastMessage = prevLastMessage,
                            PreviousLastMessageAtUtc = prevMsg?.CreatedAtUtc,
                            PreviousLastMessageSenderId = prevMsg?.SenderId,
                        });

                    _logger.LogInformation("Message {MessageId} hard deleted (unread)", messageId);
                    return Result.Success(true); // hard delete
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting message {MessageId}", request.MessageId);
                return Result.Failure<bool>(ex.Message);
            }
        }
    }
}
