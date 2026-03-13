using ChatApp.Modules.Channels.Application.Interfaces;
using ChatApp.Modules.Channels.Domain.Enums;
using ChatApp.Shared.Infrastructure.SignalR.Services;
using ChatApp.Shared.Kernel.Common;
using ChatApp.Shared.Kernel.Exceptions;
using FluentValidation;
using MediatR;
using Microsoft.Extensions.Logging;

namespace ChatApp.Modules.Channels.Application.Commands.ChannelMessages
{
    // Result<bool> — Value: true = hard delete, false = soft delete
    public record DeleteChannelMessageCommand(
        Guid MessageId,
        Guid RequestedBy
    ) : IRequest<Result<bool>>;



    public class DeleteChannelMessageCommandValidator : AbstractValidator<DeleteChannelMessageCommand>
    {
        public DeleteChannelMessageCommandValidator()
        {
            RuleFor(x => x.MessageId)
                .NotEmpty().WithMessage("Message ID is required");

            RuleFor(x => x.RequestedBy)
                .NotEmpty().WithMessage("Requester ID is required");
        }
    }



    public class DeleteChannelMessageCommandHandler : IRequestHandler<DeleteChannelMessageCommand, Result<bool>>
    {
        private readonly IUnitOfWork _unitOfWork;
        private readonly ISignalRNotificationService _signalRNotificationService;
        private readonly ILogger<DeleteChannelMessageCommandHandler> _logger;

        public DeleteChannelMessageCommandHandler(
            IUnitOfWork unitOfWork,
            ISignalRNotificationService signalRNotificationService,
            ILogger<DeleteChannelMessageCommandHandler> logger)
        {
            _unitOfWork = unitOfWork;
            _signalRNotificationService= signalRNotificationService;
            _logger = logger;
        }

        public async Task<Result<bool>> Handle(
            DeleteChannelMessageCommand request,
            CancellationToken cancellationToken)
        {
            try
            {
                _logger?.LogInformation("Deleting message {MessageId}", request.MessageId);

                var message = await _unitOfWork.ChannelMessages.GetByIdAsync(
                    request.MessageId,
                    cancellationToken);

                if (message == null)
                    throw new NotFoundException($"Message with ID {request.MessageId} not found");

                // User can delete their own message, or admin/owner can delete any message
                bool canDelete = message.SenderId == request.RequestedBy;

                if (!canDelete)
                {
                    var userRole = await _unitOfWork.ChannelMembers.GetUserRoleAsync(
                        message.ChannelId,
                        request.RequestedBy,
                        cancellationToken);

                    canDelete = userRole == MemberRole.Admin || userRole == MemberRole.Owner;
                }

                if (!canDelete)
                {
                    return Result.Failure<bool>("You don't have permission to delete this message");
                }

                var channelId = message.ChannelId;
                var senderId = message.SenderId;
                var messageId = message.Id;

                // Mesajı oxuyan varmı yoxla (heç kim oxumayıbsa hard delete)
                var readCount = await _unitOfWork.ChannelMessageReads.GetReadByCountAsync(
                    messageId, cancellationToken);

                bool isReadByAnyone = readCount > 0;

                // Channel üzvlərini al (notification üçün)
                var members = await _unitOfWork.ChannelMembers.GetChannelMembersAsync(
                    channelId,
                    cancellationToken);

                var memberUserIds = members
                    .Where(m => m.UserId != request.RequestedBy)
                    .Select(m => m.UserId)
                    .ToList();

                if (isReadByAnyone)
                {
                    // ─── SOFT DELETE — kimsə oxuyub, "This message was deleted." göstəriləcək ───
                    message.Delete();

                    await _unitOfWork.ChannelMessages.UpdateAsync(message, cancellationToken);
                    await _unitOfWork.SaveChangesAsync(cancellationToken);

                    var messageDto = new DTOs.Responses.ChannelMessageDto(
                        Id: messageId,
                        ChannelId: channelId,
                        SenderId: senderId,
                        SenderEmail: string.Empty,
                        SenderFullName: string.Empty,
                        SenderAvatarUrl: null,
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
                        IsForwarded: message.IsForwarded
                    );

                    await _signalRNotificationService.NotifyChannelMessageDeletedToMembersAsync(
                        channelId,
                        memberUserIds,
                        messageDto);

                    _logger?.LogInformation("Message {MessageId} soft deleted (read by {ReadCount} users)", messageId, readCount);
                    return Result.Success(false); // soft delete
                }
                else
                {
                    // ─── HARD DELETE — heç kim oxumayıb, bazadan tamamilə sil ───
                    await _unitOfWork.ChannelMessages.DeleteAsync(message, cancellationToken);
                    await _unitOfWork.SaveChangesAsync(cancellationToken);

                    // Əvvəlki son mesajı tap (conversation list preview üçün)
                    var prevMessages = await _unitOfWork.ChannelMessages.GetChannelMessagesAsync(
                        channelId, pageSize: 1, cancellationToken: cancellationToken);
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
                    await _signalRNotificationService.NotifyChannelMessageDeletedToMembersAsync(
                        channelId,
                        memberUserIds,
                        new
                        {
                            Id = messageId,
                            HardDeleted = true,
                            ChannelId = channelId,
                            SenderId = senderId,
                            PreviousLastMessage = prevLastMessage,
                            PreviousLastMessageAtUtc = prevMsg?.CreatedAtUtc,
                            PreviousLastMessageSenderId = prevMsg?.SenderId,
                        });

                    _logger?.LogInformation("Message {MessageId} hard deleted (unread)", messageId);
                    return Result.Success(true); // hard delete
                }
            }
            catch (Exception ex)
            {
                _logger?.LogError(ex, "Error deleting message {MessageId}", request.MessageId);
                return Result.Failure<bool>(ex.Message);
            }
        }
    }
}
