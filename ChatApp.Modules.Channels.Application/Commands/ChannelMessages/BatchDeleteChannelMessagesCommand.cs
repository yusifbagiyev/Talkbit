using ChatApp.Modules.Channels.Application.Interfaces;
using ChatApp.Modules.Channels.Domain.Enums;
using ChatApp.Shared.Infrastructure.SignalR.Services;
using ChatApp.Shared.Kernel.Common;
using FluentValidation;
using MediatR;
using Microsoft.Extensions.Logging;

namespace ChatApp.Modules.Channels.Application.Commands.ChannelMessages
{
    public record BatchDeleteChannelMessagesCommand(
        Guid ChannelId,
        List<Guid> MessageIds,
        Guid RequestedBy
    ) : IRequest<Result>;


    public class BatchDeleteChannelMessagesCommandValidator : AbstractValidator<BatchDeleteChannelMessagesCommand>
    {
        public BatchDeleteChannelMessagesCommandValidator()
        {
            RuleFor(x => x.ChannelId)
                .NotEmpty().WithMessage("Channel ID is required");
            RuleFor(x => x.MessageIds)
                .NotEmpty().WithMessage("At least one message ID is required");
            RuleFor(x => x.RequestedBy)
                .NotEmpty().WithMessage("Requester ID is required");
        }
    }


    public class BatchDeleteChannelMessagesCommandHandler : IRequestHandler<BatchDeleteChannelMessagesCommand, Result>
    {
        private readonly IUnitOfWork _unitOfWork;
        private readonly ISignalRNotificationService _signalRNotificationService;
        private readonly ILogger<BatchDeleteChannelMessagesCommandHandler> _logger;

        public BatchDeleteChannelMessagesCommandHandler(
            IUnitOfWork unitOfWork,
            ISignalRNotificationService signalRNotificationService,
            ILogger<BatchDeleteChannelMessagesCommandHandler> logger)
        {
            _unitOfWork = unitOfWork;
            _signalRNotificationService = signalRNotificationService;
            _logger = logger;
        }

        public async Task<Result> Handle(
            BatchDeleteChannelMessagesCommand request,
            CancellationToken cancellationToken)
        {
            try
            {
                _logger.LogInformation("Batch deleting {Count} messages in channel {ChannelId}",
                    request.MessageIds.Count, request.ChannelId);

                var messages = await _unitOfWork.ChannelMessages.GetByIdsAsync(
                    request.MessageIds, cancellationToken);

                if (messages.Count == 0)
                    return Result.Failure("No messages found");

                // Verify all messages belong to the specified channel
                var wrongChannelMessages = messages.Where(m => m.ChannelId != request.ChannelId).ToList();
                if (wrongChannelMessages.Count > 0)
                    return Result.Failure("Some messages don't belong to the specified channel");

                // Check permissions: sender can delete own, admin/owner can delete any
                var userRole = await _unitOfWork.ChannelMembers.GetUserRoleAsync(
                    request.ChannelId, request.RequestedBy, cancellationToken);

                bool isAdminOrOwner = userRole == MemberRole.Admin || userRole == MemberRole.Owner;

                if (!isAdminOrOwner)
                {
                    var unauthorizedMessages = messages.Where(m => m.SenderId != request.RequestedBy).ToList();
                    if (unauthorizedMessages.Count > 0)
                        return Result.Failure("You don't have permission to delete these messages");
                }

                // Soft delete all messages
                foreach (var message in messages)
                {
                    message.Delete();
                    await _unitOfWork.ChannelMessages.UpdateAsync(message, cancellationToken);
                }

                await _unitOfWork.SaveChangesAsync(cancellationToken);

                // Get channel members for notification
                var members = await _unitOfWork.ChannelMembers.GetChannelMembersAsync(
                    request.ChannelId, cancellationToken);

                var memberUserIds = members
                    .Where(m => m.UserId != request.RequestedBy)
                    .Select(m => m.UserId)
                    .ToList();

                // Send SignalR notifications for each deleted message
                foreach (var message in messages)
                {
                    var messageDto = new ChatApp.Modules.Channels.Application.DTOs.Responses.ChannelMessageDto(
                        Id: message.Id,
                        ChannelId: message.ChannelId,
                        SenderId: message.SenderId,
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
                        request.ChannelId,
                        memberUserIds,
                        messageDto);
                }

                _logger.LogInformation("Batch deleted {Count} messages successfully", messages.Count);
                return Result.Success();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error batch deleting messages in channel {ChannelId}", request.ChannelId);
                return Result.Failure(ex.Message);
            }
        }
    }
}
