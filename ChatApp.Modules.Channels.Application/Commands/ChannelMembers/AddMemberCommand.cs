using ChatApp.Modules.Channels.Application.Interfaces;
using ChatApp.Modules.Channels.Domain.Entities;
using ChatApp.Modules.Channels.Domain.Enums;
using ChatApp.Modules.Channels.Domain.Events;
using ChatApp.Shared.Infrastructure.SignalR.Services;
using ChatApp.Shared.Kernel.Common;
using ChatApp.Shared.Kernel.Exceptions;
using ChatApp.Shared.Kernel.Interfaces;
using FluentValidation;
using MediatR;
using Microsoft.Extensions.Logging;

namespace ChatApp.Modules.Channels.Application.Commands.ChannelMembers
{
    public record AddMemberCommand(
        Guid ChannelId,
        Guid UserId,
        Guid AddedBy,
        bool ShowChatHistory = true
    ) : IRequest<Result>;



    public class AddMemberCommandValidator : AbstractValidator<AddMemberCommand>
    {
        public AddMemberCommandValidator()
        {
            RuleFor(x => x.ChannelId)
                .NotEmpty().WithMessage("Channel ID is required");

            RuleFor(x => x.UserId)
                .NotEmpty().WithMessage("User ID is required");

            RuleFor(x => x.AddedBy)
                .NotEmpty().WithMessage("Added by user ID is required");
        }
    }



    public class AddMemberCommandHandler(
        IUnitOfWork unitOfWork,
        IEventBus eventBus,
        ISignalRNotificationService notificationService,
        ILogger<AddMemberCommandHandler> logger) : IRequestHandler<AddMemberCommand, Result>
    {
        private readonly IUnitOfWork _unitOfWork = unitOfWork;
        private readonly IEventBus _eventBus = eventBus;
        private readonly ISignalRNotificationService _notificationService = notificationService;
        private readonly ILogger<AddMemberCommandHandler> _logger = logger;

        public async Task<Result> Handle(
            AddMemberCommand request,
            CancellationToken cancellationToken)
        {
            try
            {
                var channel = await _unitOfWork.Channels.GetByIdWithMembersAsync(
                    request.ChannelId,
                    cancellationToken)
                    ?? throw new NotFoundException($"Channel with ID {request.ChannelId} not found");

                // Domain yalnız qaydaları yoxlayır (duplicate, icazə və s.)
                channel.ValidateAddMember(request.UserId, request.AddedBy);

                // Yeni üzv yarat (hard-delete sayəsində duplicate olmayacaq)
                var newMember = new ChannelMember(request.ChannelId, request.UserId, MemberRole.Member, request.ShowChatHistory);
                await _unitOfWork.ChannelMembers.AddAsync(newMember, cancellationToken);
                await _unitOfWork.SaveChangesAsync(cancellationToken);

                // Publish event
                await _eventBus.PublishAsync(
                    new MemberAddedEvent(request.ChannelId, request.UserId, request.AddedBy),
                    cancellationToken);

                // Notify added user via SignalR so channel appears in their list
                var channelDto = new
                {
                    Id = channel.Id,
                    Name = channel.Name,
                    Description = channel.Description,
                    Type = (int)channel.Type,
                    CreatedBy = channel.CreatedBy,
                    MemberCount = (channel.Members?.Count ?? 0) + 1,
                    CreatedAtUtc = channel.CreatedAtUtc,
                    AvatarUrl = channel.AvatarUrl,
                    LastMessageContent = (string?)null,
                    LastMessageAtUtc = (DateTime?)null,
                    UnreadCount = 0,
                    HasUnreadMentions = false,
                    LastReadLaterMessageId = (Guid?)null,
                    LastMessageId = (Guid?)null,
                    LastMessageSenderId = (Guid?)null,
                    LastMessageStatus = (string?)null,
                    LastMessageSenderAvatarUrl = (string?)null,
                    FirstUnreadMessageId = (Guid?)null,
                    IsPinned = false,
                    IsMuted = false,
                    IsMarkedReadLater = false
                };
                await _notificationService.NotifyMemberAddedToChannelAsync(request.UserId, channelDto);

                _logger?.LogInformation(
                    "User {UserId} added to channel {ChannelId} successfully",
                    request.UserId,
                    request.ChannelId);

                return Result.Success();
            }
            catch (Exception ex)
            {
                _logger?.LogError(
                    ex,
                    "Error adding user {UserId} to channel {ChannelId}",
                    request.UserId,
                    request.ChannelId);
                return Result.Failure(ex.Message);
            }
        }
    }
}