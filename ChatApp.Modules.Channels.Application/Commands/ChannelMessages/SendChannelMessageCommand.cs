using ChatApp.Modules.Channels.Application.Interfaces;
using ChatApp.Modules.Channels.Domain.Entities;
using ChatApp.Modules.Channels.Domain.Events;
using ChatApp.Shared.Infrastructure.SignalR.Services;
using ChatApp.Shared.Kernel.Common;
using ChatApp.Shared.Kernel.Exceptions;
using ChatApp.Shared.Kernel.Interfaces;
using FluentValidation;
using MediatR;
using Microsoft.Extensions.Logging;

namespace ChatApp.Modules.Channels.Application.Commands.ChannelMessages
{
    public record SendChannelMessageCommand(
        Guid ChannelId,
        Guid SenderId,
        string Content,
        string? FileId = null,
        Guid? ReplyToMessageId = null,
        bool IsForwarded = false,
        List<ChannelMentionRequest>? Mentions = null
    ) : IRequest<Result<Guid>>;

    public record ChannelMentionRequest(Guid? UserId, string UserName, bool IsAllMention);



    public class SendChannelMessageCommandValidator : AbstractValidator<SendChannelMessageCommand>
    {
        public SendChannelMessageCommandValidator()
        {
            RuleFor(x => x.ChannelId)
                .NotEmpty().WithMessage("Channel ID is required");

            RuleFor(x => x.SenderId)
                .NotEmpty().WithMessage("Sender ID is required");

            RuleFor(x => x.Content)
                .MaximumLength(4000).WithMessage("Message content cannot exceed 4000 characters");

            RuleFor(x => x)
                .Must(x => !string.IsNullOrWhiteSpace(x.Content) || !string.IsNullOrWhiteSpace(x.FileId))
                .WithMessage("Message must have content or file attachment");
        }
    }



    public class SendChannelMessageCommandHandler : IRequestHandler<SendChannelMessageCommand, Result<Guid>>
    {
        private readonly IUnitOfWork _unitOfWork;
        private readonly IEventBus _eventBus;
        private readonly ISignalRNotificationService _signalRNotificationService;
        private readonly IChannelMemberCache _channelMemberCache;
        private readonly ILogger<SendChannelMessageCommandHandler> _logger;

        public SendChannelMessageCommandHandler(
            IUnitOfWork unitOfWork,
            IEventBus eventBus,
            ISignalRNotificationService signalRNotificationService,
            IChannelMemberCache channelMemberCache,
            ILogger<SendChannelMessageCommandHandler> logger)
        {
            _unitOfWork = unitOfWork;
            _eventBus = eventBus;
            _signalRNotificationService = signalRNotificationService;
            _channelMemberCache = channelMemberCache;
            _logger = logger;
        }

        public async Task<Result<Guid>> Handle(
            SendChannelMessageCommand request,
            CancellationToken cancellationToken)
        {
            try
            {
                _logger?.LogInformation(
                    "Sending message to channel {ChannelId} from user {SenderId}",
                    request.ChannelId,
                    request.SenderId);

                // Verify channel exists
                var channel = await _unitOfWork.Channels.GetByIdAsync(
                    request.ChannelId,
                    cancellationToken) 
                    ?? throw new NotFoundException($"Channel with ID {request.ChannelId} not found");
                // Verify user is a member
                var isMember = await _unitOfWork.Channels.IsUserMemberAsync(
                    request.ChannelId,
                    request.SenderId,
                    cancellationToken);

                if (!isMember)
                {
                    return Result.Failure<Guid>("You must be a member to send messages to this channel");
                }

                // Create message
                var message = new ChannelMessage(
                    request.ChannelId,
                    request.SenderId,
                    request.Content,
                    request.FileId,
                    request.ReplyToMessageId,
                    request.IsForwarded);

                await _unitOfWork.ChannelMessages.AddAsync(message, cancellationToken);

                // Add mentions if provided
                if (request.Mentions != null && request.Mentions.Count > 0)
                {
                    foreach (var mentionReq in request.Mentions)
                    {
                        var mention = new ChannelMessageMention(
                            message.Id,
                            mentionReq.UserId,
                            mentionReq.UserName,
                            mentionReq.IsAllMention);

                        message.AddMention(mention);
                    }
                }

                await _unitOfWork.SaveChangesAsync(cancellationToken);

                // Get the message DTO using GetByIdAsDtoAsync instead of GetChannelMessagesAsync
                // Brand new messages should have ReadBy=empty and ReadByCount=0 (not yet read by anyone)
                // GetByIdAsDtoAsync returns the message with correct initial read status
                var messageDto = await _unitOfWork.ChannelMessages.GetByIdAsDtoAsync(
                    message.Id,
                    cancellationToken);

                if(messageDto != null)
                {
                    // Get all active members to calculate TotalMemberCount
                    var members = await _unitOfWork.ChannelMembers.GetChannelMembersAsync(
                        request.ChannelId,
                        cancellationToken);

                    // Auto-unhide: When new message arrives, unhide channel for all hidden members (including sender)
                    var hiddenMembers = members.Where(m => m.IsHidden).ToList();
                    foreach (var hiddenMember in hiddenMembers)
                    {
                        hiddenMember.Unhide();
                    }
                    if (hiddenMembers.Count != 0)
                    {
                        await _unitOfWork.SaveChangesAsync(cancellationToken);
                    }

                    // Count active members except the sender (sender is not in ReadBy list)
                    var adjustedMemberCount = members.Count(m => m.UserId != request.SenderId);

                    // Create a new DTO with proper TotalMemberCount and empty ReadBy list
                    // This ensures the new message starts with ReadByCount=0, ReadBy=[], TotalMemberCount=correct value
                    var broadcastDto = messageDto with
                    {
                        ReadByCount = 0,
                        ReadBy = new List<Guid>(),
                        TotalMemberCount = adjustedMemberCount
                    };

                    _logger?.LogInformation(
                        "Broadcasting message {MessageId}: ReadByCount={ReadByCount}, TotalMemberCount={TotalMemberCount}",
                        broadcastDto.Id,
                        broadcastDto.ReadByCount,
                        broadcastDto.TotalMemberCount);

                    // Get all member user IDs (excluding the sender)
                    var memberUserIds = members
                        .Where(m => m.UserId != request.SenderId)
                        .Select(m => m.UserId)
                        .ToList();

                    // Update channel member cache for typing indicators
                    // Cache includes ALL members (including sender) for typing broadcast
                    var allMemberIds = members
                        .Select(m => m.UserId)
                        .ToList();
                    await _channelMemberCache.UpdateChannelMembersAsync(request.ChannelId, allMemberIds);

                    // Send real-time notification to channel group AND each member's connections
                    // This hybrid approach supports both:
                    // 1. Active viewers (already in channel group) - instant delivery
                    // 2. Lazy loading (not in group yet) - notification via direct connections
                    await _signalRNotificationService.NotifyChannelMessageToMembersAsync(
                        request.ChannelId,
                        memberUserIds,
                        broadcastDto);
                }

                // Publish domain event (for other modules/event handlers)
                await _eventBus.PublishAsync(
                    new ChannelMessageSentEvent(
                        message.Id,
                        request.ChannelId,
                        request.SenderId,
                        request.Content),
                    cancellationToken);

                _logger?.LogInformation(
                    "Message {MessageId} sent to channel {ChannelId} successfully",
                    message.Id,
                    request.ChannelId);

                return Result.Success(message.Id);
            }
            catch (Exception ex)
            {
                _logger?.LogError(
                    ex,
                    "Error sending message to channel {ChannelId}",
                    request.ChannelId);
                return Result.Failure<Guid>("An error occurred while sending the message");
            }
        }
    }
}