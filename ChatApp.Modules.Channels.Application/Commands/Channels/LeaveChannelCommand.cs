using ChatApp.Modules.Channels.Application.Interfaces;
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
    public record LeaveChannelCommand(
        Guid ChannelId,
        Guid UserId
    ) : IRequest<Result>;



    public class LeaveChannelCommandValidator : AbstractValidator<LeaveChannelCommand>
    {
        public LeaveChannelCommandValidator()
        {
            RuleFor(x => x.ChannelId)
                .NotEmpty().WithMessage("Channel ID is required");

            RuleFor(x => x.UserId)
                .NotEmpty().WithMessage("User ID is required");
        }
    }



    public class LeaveChannelCommandHandler : IRequestHandler<LeaveChannelCommand, Result>
    {
        private readonly IUnitOfWork _unitOfWork;
        private readonly IEventBus _eventBus;
        private readonly ILogger<LeaveChannelCommandHandler> _logger;

        public LeaveChannelCommandHandler(
            IUnitOfWork unitOfWork,
            IEventBus eventBus,
            ILogger<LeaveChannelCommandHandler> logger)
        {
            _unitOfWork = unitOfWork;
            _eventBus = eventBus;
            _logger = logger;
        }

        public async Task<Result> Handle(
            LeaveChannelCommand request,
            CancellationToken cancellationToken)
        {
            try
            {
                _logger?.LogInformation(
                    "User {UserId} leaving channel {ChannelId}",
                    request.UserId,
                    request.ChannelId);

                var channel = await _unitOfWork.Channels.GetByIdAsync(
                    request.ChannelId,
                    cancellationToken);

                if (channel == null)
                    throw new NotFoundException($"Channel with ID {request.ChannelId} not found");

                var member = await _unitOfWork.ChannelMembers.GetMemberAsync(
                    request.ChannelId,
                    request.UserId,
                    cancellationToken);

                if (member == null)
                {
                    return Result.Failure("You are not a member of this channel");
                }

                // Owner cannot leave without transferring ownership
                if (member.Role == MemberRole.Owner)
                {
                    return Result.Failure("Owner cannot leave channel. Transfer ownership first or delete the channel.");
                }

                // Hard-delete: sətri DB-dən sil (mesajlar ayrı cədvəldədir, toxunulmur)
                await _unitOfWork.ChannelMembers.DeleteAsync(member, cancellationToken);
                await _unitOfWork.SaveChangesAsync(cancellationToken);

                // Publish event
                await _eventBus.PublishAsync(
                    new MemberRemovedEvent(request.ChannelId, request.UserId, request.UserId),
                    cancellationToken);

                _logger?.LogInformation(
                    "User {UserId} left channel {ChannelId} successfully",
                    request.UserId,
                    request.ChannelId);

                return Result.Success();
            }
            catch (Exception ex)
            {
                _logger?.LogError(
                    ex,
                    "Error while user {UserId} leaving channel {ChannelId}",
                    request.UserId,
                    request.ChannelId);
                return Result.Failure(ex.Message);
            }
        }
    }
}