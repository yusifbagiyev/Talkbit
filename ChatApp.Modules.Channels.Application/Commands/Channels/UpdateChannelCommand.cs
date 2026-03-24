using ChatApp.Modules.Channels.Application.Interfaces;
using ChatApp.Modules.Channels.Domain.Enums;
using ChatApp.Modules.Channels.Domain.Events;
using ChatApp.Modules.Channels.Domain.ValueObjects;
using ChatApp.Shared.Kernel.Common;
using ChatApp.Shared.Kernel.Exceptions;
using ChatApp.Shared.Kernel.Interfaces;
using FluentValidation;
using MediatR;
using Microsoft.Extensions.Logging;

namespace ChatApp.Modules.Channels.Application.Commands.Channels
{
    public record UpdateChannelCommand(
        Guid ChannelId,
        string? Name,
        string? Description,
        ChannelType? Type,
        string? AvatarUrl,
        Guid RequestedBy
    ) : IRequest<Result>;



    public class UpdateChannelCommandValidator : AbstractValidator<UpdateChannelCommand>
    {
        public UpdateChannelCommandValidator()
        {
            RuleFor(x => x.ChannelId)
                .NotEmpty().WithMessage("Channel ID is required");

            When(x => !string.IsNullOrWhiteSpace(x.Name), () =>
            {
                RuleFor(x => x.Name)
                    .MaximumLength(100).WithMessage("Channel name must not exceed 100 characters");
            });

            When(x => !string.IsNullOrWhiteSpace(x.Description), () =>
            {
                RuleFor(x => x.Description)
                    .MaximumLength(500).WithMessage("Description must not exceed 500 characters");
            });

            When(x => x.Type.HasValue, () =>
            {
                RuleFor(x => x.Type)
                    .IsInEnum().WithMessage("Invalid channel type");
            });

            RuleFor(x => x.RequestedBy)
                .NotEmpty().WithMessage("Requester ID is required");
        }
    }



    public class UpdateChannelCommandHandler : IRequestHandler<UpdateChannelCommand, Result>
    {
        private readonly IUnitOfWork _unitOfWork;
        private readonly IEventBus _eventBus;
        private readonly ILogger<UpdateChannelCommandHandler> _logger;

        public UpdateChannelCommandHandler(
            IUnitOfWork unitOfWork,
            IEventBus eventBus,
            ILogger<UpdateChannelCommandHandler> logger)
        {
            _unitOfWork = unitOfWork;
            _eventBus = eventBus;
            _logger = logger;
        }

        public async Task<Result> Handle(
            UpdateChannelCommand request,
            CancellationToken cancellationToken)
        {
            try
            {
                _logger?.LogInformation("Updating channel: {ChannelId}", request.ChannelId);

                var channel = await _unitOfWork.Channels.GetByIdWithMembersAsync(
                    request.ChannelId,
                    cancellationToken);

                if (channel == null)
                    throw new NotFoundException($"Channel with ID {request.ChannelId} not found");

                // Check if user has permission (Admin or Owner)
                var userRole = await _unitOfWork.ChannelMembers.GetUserRoleAsync(
                    request.ChannelId,
                    request.RequestedBy,
                    cancellationToken);

                if (userRole == null || (userRole != MemberRole.Admin && userRole != MemberRole.Owner))
                {
                    return Result.Failure("You don't have permission to update this channel");
                }

                // Update fields
                if (!string.IsNullOrWhiteSpace(request.Name))
                {
                    var newChannelName=ChannelName.Create(request.Name);

                    // Check name uniqueness
                    var existingChannel = await _unitOfWork.Channels.GetByNameAsync(
                        newChannelName,
                        cancellationToken);

                    if (existingChannel != null && existingChannel.Id != request.ChannelId)
                    {
                        return Result.Failure("A channel with this name already exists");
                    }

                    channel.UpdateName(newChannelName);
                }

                if (request.Description != null)
                {
                    channel.UpdateDescription(request.Description);
                }

                if (request.Type.HasValue)
                {
                    channel.ChangeType(request.Type.Value);
                }

                if (request.AvatarUrl != null)
                {
                    channel.UpdateAvatarUrl(request.AvatarUrl);
                }

                await _unitOfWork.Channels.UpdateAsync(channel, cancellationToken);
                await _unitOfWork.SaveChangesAsync(cancellationToken);

                await _eventBus.PublishAsync(
                    new ChannelUpdatedEvent(request.ChannelId, channel.Name, channel.AvatarUrl),
                    cancellationToken);

                _logger?.LogInformation("Channel {ChannelId} updated successfully", request.ChannelId);

                return Result.Success();
            }
            catch (Exception ex)
            {
                _logger?.LogError(ex, "Error updating channel {ChannelId}", request.ChannelId);
                return Result.Failure(ex.Message);
            }
        }
    }
}