using ChatApp.Modules.Channels.Application.Interfaces;
using ChatApp.Modules.Channels.Domain.Entities;
using ChatApp.Shared.Infrastructure.SignalR.Services;
using ChatApp.Shared.Kernel.Common;
using FluentValidation;
using MediatR;
using Microsoft.Extensions.Logging;

namespace ChatApp.Modules.Channels.Application.Commands.ChannelMembers
{
    public record MarkAllChannelMessagesAsReadCommand(
        Guid ChannelId,
        Guid UserId
    ) : IRequest<Result<int>>; // Returns count of messages marked as read

    public class MarkAllChannelMessagesAsReadCommandValidator : AbstractValidator<MarkAllChannelMessagesAsReadCommand>
    {
        public MarkAllChannelMessagesAsReadCommandValidator()
        {
            RuleFor(x => x.ChannelId)
                .NotEmpty().WithMessage("Channel ID is required");

            RuleFor(x => x.UserId)
                .NotEmpty().WithMessage("User ID is required");
        }
    }

    public class MarkAllChannelMessagesAsReadCommandHandler : IRequestHandler<MarkAllChannelMessagesAsReadCommand, Result<int>>
    {
        private readonly IUnitOfWork _unitOfWork;
        private readonly ISignalRNotificationService _signalRNotificationService;
        private readonly ILogger<MarkAllChannelMessagesAsReadCommandHandler> _logger;

        public MarkAllChannelMessagesAsReadCommandHandler(
            IUnitOfWork unitOfWork,
            ISignalRNotificationService signalRNotificationService,
            ILogger<MarkAllChannelMessagesAsReadCommandHandler> logger)
        {
            _unitOfWork = unitOfWork;
            _signalRNotificationService = signalRNotificationService;
            _logger = logger;
        }

        public async Task<Result<int>> Handle(
            MarkAllChannelMessagesAsReadCommand request,
            CancellationToken cancellationToken)
        {
            try
            {
                // Verify user is a member of the channel
                var member = await _unitOfWork.ChannelMembers.GetMemberAsync(
                    request.ChannelId,
                    request.UserId,
                    cancellationToken);

                if (member == null)
                    return Result.Failure<int>("User is not a member of this channel");

                // Unread mesaj ID-ləri — öz mesajları xaric edilir, tək DB sorğusu
                var filteredMessageIds = await _unitOfWork.ChannelMessageReads
                    .GetUnreadMessageIdsAsync(request.ChannelId, request.UserId, cancellationToken, excludeSenderId: request.UserId);

                var markedCount = 0;

                if (filteredMessageIds.Count != 0)
                {
                    // Create ChannelMessageRead records for all unread messages
                    var readRecords = filteredMessageIds
                        .Select(messageId => new ChannelMessageRead(messageId, request.UserId))
                        .ToList();

                    // Bulk insert read records
                    await _unitOfWork.ChannelMessageReads.BulkInsertAsync(readRecords, cancellationToken);
                    markedCount = filteredMessageIds.Count;
                }

                // Clear ALL read later flags (both conversation-level and message-level)
                member.UnmarkMessageAsLater();          // LastReadLaterMessageId = null
                member.UnmarkConversationAsReadLater(); // IsMarkedReadLater = false

                await _unitOfWork.SaveChangesAsync(cancellationToken);

                // Send SignalR notifications if any messages were marked
                if (filteredMessageIds.Count != 0)
                {
                    // Get current read counts for all messages in a single query (bulk operation)
                    var messageReadCounts = await _unitOfWork.ChannelMessageReads
                        .GetReadByCountsAsync(filteredMessageIds, cancellationToken);

                    // Get all active channel members for hybrid notification
                    var members = await _unitOfWork.ChannelMembers.GetChannelMembersAsync(
                        request.ChannelId,
                        cancellationToken);

                    var memberUserIds = members
                        .Select(m => m.UserId)
                        .ToList();

                    // Broadcast read status update to all channel members with HYBRID pattern
                    await _signalRNotificationService.NotifyChannelMessagesReadToMembersAsync(
                        request.ChannelId,
                        memberUserIds,
                        request.UserId,
                        messageReadCounts);
                }

                _logger?.LogInformation(
                    "Marked {MarkedCount} messages as read and cleared read later flags for channel {ChannelId} and user {UserId}",
                    markedCount,
                    request.ChannelId,
                    request.UserId);

                return Result.Success(markedCount);
            }
            catch (Exception ex)
            {
                _logger?.LogError(
                    ex,
                    "Error marking all messages as read for channel {ChannelId} and user {UserId}",
                    request.ChannelId,
                    request.UserId);
                return Result.Failure<int>(ex.Message);
            }
        }
    }
}