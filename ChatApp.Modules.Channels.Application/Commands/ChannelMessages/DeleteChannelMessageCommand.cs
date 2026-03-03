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
    public record DeleteChannelMessageCommand(
        Guid MessageId,
        Guid RequestedBy
    ) : IRequest<Result>;



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



    public class DeleteChannelMessageCommandHandler : IRequestHandler<DeleteChannelMessageCommand, Result>
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

        public async Task<Result> Handle(
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
                    return Result.Failure("You don't have permission to delete this message");
                }

                var channelId = message.ChannelId;
                var senderId = message.SenderId;

                // Delete the message (soft delete)
                message.Delete();

                await _unitOfWork.ChannelMessages.UpdateAsync(message, cancellationToken);
                await _unitOfWork.SaveChangesAsync(cancellationToken);

                // Create deleted message DTO manually (showing deleted state)
                var messageDto = new ChatApp.Modules.Channels.Application.DTOs.Responses.ChannelMessageDto(
                    Id: message.Id,
                    ChannelId: message.ChannelId,
                    SenderId: senderId,
                    SenderEmail: string.Empty, // Will be populated by frontend from user cache
                    SenderFullName: string.Empty, // Will be populated by frontend from user cache
                    SenderAvatarUrl: null, // Will be populated by frontend from user cache
                    Content: message.Content, // Content preserved in backend but shown as "deleted" in frontend
                    FileId: message.FileId,
                    FileName: null,
                    FileContentType: null,
                    FileSizeInBytes: null,
                    FileUrl: null,
                    ThumbnailUrl: null,
                    IsEdited: message.IsEdited,
                    IsDeleted: true, // Mark as deleted
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

                // Get all active channel members for notification
                var members = await _unitOfWork.ChannelMembers.GetChannelMembersAsync(
                    channelId,
                    cancellationToken);

                var memberUserIds = members
                    .Where(m => m.UserId != request.RequestedBy)
                    .Select(m => m.UserId)
                    .ToList();

                // Send real-time notification with deleted message DTO (hybrid: group + direct connections)
                await _signalRNotificationService.NotifyChannelMessageDeletedToMembersAsync(
                    channelId,
                    memberUserIds,
                    messageDto);

                _logger?.LogInformation("Message {MessageId} deleted successfully", request.MessageId);

                return Result.Success();
            }
            catch (Exception ex)
            {
                _logger?.LogError(ex, "Error deleting message {MessageId}", request.MessageId);
                return Result.Failure(ex.Message);
            }
        }
    }
}