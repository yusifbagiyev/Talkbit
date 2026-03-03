using ChatApp.Modules.Channels.Application.Interfaces;
using ChatApp.Modules.Channels.Domain.Entities;
using ChatApp.Shared.Infrastructure.SignalR.Services;
using ChatApp.Shared.Kernel.Common;
using FluentValidation;
using MediatR;
using Microsoft.Extensions.Logging;

namespace ChatApp.Modules.Channels.Application.Commands.ChannelMessages
{
    public record MarkChannelMessageAsReadCommand(
        Guid MessageId,
        Guid ChannelId,
        Guid UserId
    ) : IRequest<Result>;


    public class MarkChannelMessageAsReadCommandValidator : AbstractValidator<MarkChannelMessageAsReadCommand>
    {
        public MarkChannelMessageAsReadCommandValidator()
        {
            RuleFor(x => x.MessageId)
                .NotEmpty().WithMessage("Message ID is required");

            RuleFor(x => x.ChannelId)
                .NotEmpty().WithMessage("Channel ID is required");

            RuleFor(x => x.UserId)
                .NotEmpty().WithMessage("User ID is required");
        }
    }


    public class MarkChannelMessageAsReadCommandHandler : IRequestHandler<MarkChannelMessageAsReadCommand, Result>
    {
        private readonly IUnitOfWork _unitOfWork;
        private readonly ISignalRNotificationService _signalRNotificationService;
        private readonly ILogger<MarkChannelMessageAsReadCommandHandler> _logger;

        public MarkChannelMessageAsReadCommandHandler(
            IUnitOfWork unitOfWork,
            ISignalRNotificationService signalRNotificationService,
            ILogger<MarkChannelMessageAsReadCommandHandler> logger)
        {
            _unitOfWork = unitOfWork;
            _signalRNotificationService = signalRNotificationService;
            _logger = logger;
        }

        public async Task<Result> Handle(
            MarkChannelMessageAsReadCommand request,
            CancellationToken cancellationToken)
        {
            try
            {
                // Get member to verify they're in the channel
                var member = await _unitOfWork.ChannelMembers.GetMemberAsync(
                    request.ChannelId,
                    request.UserId,
                    cancellationToken);

                if (member == null)
                {
                    return Result.Failure("User is not a member of this channel");
                }

                // Get the message to verify it exists and user is not the sender
                var message = await _unitOfWork.ChannelMessages.GetByIdAsync(request.MessageId, cancellationToken);
                if (message == null)
                {
                    return Result.Failure("Message not found");
                }

                // Don't mark user's own messages as read
                if (message.SenderId == request.UserId)
                {
                    return Result.Success();
                }

                // Check if already marked as read
                var alreadyRead = await _unitOfWork.ChannelMessageReads
                    .ExistsAsync(request.MessageId, request.UserId, cancellationToken);

                if (alreadyRead)
                {
                    return Result.Success(); // Already marked, nothing to do
                }

                // Create and add the read record
                var readRecord = new ChannelMessageRead(request.MessageId, request.UserId);
                await _unitOfWork.ChannelMessageReads.AddAsync(readRecord, cancellationToken);
                await _unitOfWork.SaveChangesAsync(cancellationToken);

                // Get current read count for this message
                var readCount = await _unitOfWork.ChannelMessageReads
                    .GetReadByCountAsync(request.MessageId, cancellationToken);

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
                    new Dictionary<Guid, int> { { request.MessageId, readCount } });

                _logger?.LogDebug(
                    "Message {MessageId} marked as read for user {UserId} in channel {ChannelId}",
                    request.MessageId,
                    request.UserId,
                    request.ChannelId);

                return Result.Success();
            }
            catch (Exception ex)
            {
                _logger?.LogError(
                    ex,
                    "Error marking message {MessageId} as read for user {UserId} in channel {ChannelId}",
                    request.MessageId,
                    request.UserId,
                    request.ChannelId);
                return Result.Failure(ex.Message);
            }
        }
    }
}