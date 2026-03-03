using ChatApp.Modules.Channels.Application.Interfaces;
using ChatApp.Modules.Channels.Domain.Entities;
using ChatApp.Modules.Channels.Domain.Enums;
using ChatApp.Modules.Channels.Domain.Events;
using ChatApp.Shared.Kernel.Common;
using ChatApp.Shared.Kernel.Exceptions;
using ChatApp.Shared.Kernel.Interfaces;
using FluentValidation;
using MediatR;
using Microsoft.Extensions.Logging;

namespace ChatApp.Modules.Channels.Application.Commands.Channels
{
    /// <summary>
    /// Command for joining a public channel.
    /// Users can self-join public channels without admin approval.
    /// </summary>
    public record JoinChannelCommand(
        Guid ChannelId,
        Guid UserId
    ) : IRequest<Result>;



    public class JoinChannelCommandValidator : AbstractValidator<JoinChannelCommand>
    {
        public JoinChannelCommandValidator()
        {
            RuleFor(x => x.ChannelId)
                .NotEmpty().WithMessage("Channel ID is required");

            RuleFor(x => x.UserId)
                .NotEmpty().WithMessage("User ID is required");
        }
    }



    public class JoinChannelCommandHandler : IRequestHandler<JoinChannelCommand, Result>
    {
        private readonly IUnitOfWork _unitOfWork;
        private readonly IEventBus _eventBus;
        private readonly ILogger<JoinChannelCommandHandler> _logger;

        public JoinChannelCommandHandler(
            IUnitOfWork unitOfWork,
            IEventBus eventBus,
            ILogger<JoinChannelCommandHandler> logger)
        {
            _unitOfWork = unitOfWork;
            _eventBus = eventBus;
            _logger = logger;
        }

        public async Task<Result> Handle(
            JoinChannelCommand request,
            CancellationToken cancellationToken)
        {
            try
            {
                _logger?.LogInformation(
                    "User {UserId} joining channel {ChannelId}",
                    request.UserId,
                    request.ChannelId);

                var channel = await _unitOfWork.Channels.GetByIdAsync(
                    request.ChannelId,
                    cancellationToken);

                if (channel == null)
                    throw new NotFoundException($"Channel with ID {request.ChannelId} not found");

                // Only public channels can be self-joined
                if (channel.Type != ChannelType.Public)
                {
                    return Result.Failure("Only public channels can be joined. Private channels require an invitation.");
                }

                // Check if already a member
                var existingMember = await _unitOfWork.ChannelMembers.GetMemberAsync(
                    request.ChannelId,
                    request.UserId,
                    cancellationToken);

                if (existingMember != null)
                {
                    return Result.Failure("You are already a member of this channel");
                }

                // Yeni üzvlük yarat
                var newMember = new ChannelMember(
                    request.ChannelId,
                    request.UserId,
                    MemberRole.Member);

                await _unitOfWork.ChannelMembers.AddAsync(newMember, cancellationToken);

                await _unitOfWork.SaveChangesAsync(cancellationToken);

                // Publish event
                await _eventBus.PublishAsync(
                    new MemberAddedEvent(request.ChannelId, request.UserId, request.UserId),
                    cancellationToken);

                _logger?.LogInformation(
                    "User {UserId} joined channel {ChannelId} successfully",
                    request.UserId,
                    request.ChannelId);

                return Result.Success();
            }
            catch (Exception ex)
            {
                _logger?.LogError(
                    ex,
                    "Error while user {UserId} joining channel {ChannelId}",
                    request.UserId,
                    request.ChannelId);
                return Result.Failure(ex.Message);
            }
        }
    }
}