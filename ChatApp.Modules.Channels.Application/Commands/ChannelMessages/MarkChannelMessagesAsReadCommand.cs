using ChatApp.Modules.Channels.Application.Interfaces;
using ChatApp.Modules.Channels.Domain.Entities;
using ChatApp.Shared.Infrastructure.SignalR.Services;
using ChatApp.Shared.Kernel.Common;
using FluentValidation;
using MediatR;
using Microsoft.Extensions.Logging;

namespace ChatApp.Modules.Channels.Application.Commands.ChannelMessages
{
    public record MarkChannelMessagesAsReadCommand(
        Guid ChannelId,
        Guid UserId
    ) : IRequest<Result>;


    public class MarkChannelMessagesAsReadCommandValidator : AbstractValidator<MarkChannelMessagesAsReadCommand>
    {
        public MarkChannelMessagesAsReadCommandValidator()
        {
            RuleFor(x => x.ChannelId)
                .NotEmpty().WithMessage("Channel ID is required");

            RuleFor(x => x.UserId)
                .NotEmpty().WithMessage("User ID is required");
        }
    }


    public class MarkChannelMessagesAsReadCommandHandler : IRequestHandler<MarkChannelMessagesAsReadCommand, Result>
    {
        private readonly IUnitOfWork _unitOfWork;
        private readonly ISignalRNotificationService _signalRNotificationService;
        private readonly ILogger<MarkChannelMessagesAsReadCommandHandler> _logger;

        public MarkChannelMessagesAsReadCommandHandler(
            IUnitOfWork unitOfWork,
            ISignalRNotificationService signalRNotificationService,
            ILogger<MarkChannelMessagesAsReadCommandHandler> logger)
        {
            _unitOfWork = unitOfWork;
            _signalRNotificationService = signalRNotificationService;
            _logger = logger;
        }

        public async Task<Result> Handle(
            MarkChannelMessagesAsReadCommand request,
            CancellationToken cancellationToken)
        {
            try
            {
                // Get member
                var member = await _unitOfWork.ChannelMembers.GetMemberAsync(
                    request.ChannelId,
                    request.UserId,
                    cancellationToken);

                if (member == null)
                {
                    return Result.Failure("User is not a member of this channel");
                }

                // Unread mesaj ID-ləri — öz mesajları xaric edilir, tək DB sorğusu
                var filteredMessageIds = await _unitOfWork.ChannelMessageReads
                    .GetUnreadMessageIdsAsync(request.ChannelId, request.UserId, cancellationToken, excludeSenderId: request.UserId);

                if (filteredMessageIds.Count != 0)
                {
                    // Create ChannelMessageRead records for all unread messages
                    var readRecords = filteredMessageIds
                        .Select(messageId => new ChannelMessageRead(messageId, request.UserId))
                        .ToList();

                    // Bulk insert read records
                    await _unitOfWork.ChannelMessageReads.BulkInsertAsync(readRecords, cancellationToken);
                    await _unitOfWork.SaveChangesAsync(cancellationToken);

                    // Get current read counts for all messages in a single query (bulk operation)
                    var messageReadCounts = await _unitOfWork.ChannelMessageReads
                        .GetReadByCountsAsync(filteredMessageIds, cancellationToken);

                    // Get all active channel members for hybrid notification (lazy loading support)
                    var members = await _unitOfWork.ChannelMembers.GetChannelMembersAsync(
                        request.ChannelId,
                        cancellationToken);

                    var memberUserIds = members
                        .Select(m => m.UserId)
                        .ToList();

                    // Broadcast read status update to all channel members with HYBRID pattern
                    // Sends to both channel group AND each member's direct connections (for lazy loading)
                    await _signalRNotificationService.NotifyChannelMessagesReadToMembersAsync(
                        request.ChannelId,
                        memberUserIds,
                        request.UserId,
                        messageReadCounts);
                }

                _logger?.LogDebug(
                    "Marked {Count} messages as read for user {UserId} in channel {ChannelId}",
                    filteredMessageIds.Count,
                    request.UserId,
                    request.ChannelId);

                return Result.Success();
            }
            catch (Exception ex)
            {
                _logger?.LogError(
                    ex,
                    "Error marking messages as read for user {UserId} in channel {ChannelId}",
                    request.UserId,
                    request.ChannelId);
                return Result.Failure(ex.Message);
            }
        }
    }
}