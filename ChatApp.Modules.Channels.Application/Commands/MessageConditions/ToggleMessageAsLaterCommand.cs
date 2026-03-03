using ChatApp.Modules.Channels.Application.Interfaces;
using ChatApp.Shared.Kernel.Common;
using ChatApp.Shared.Kernel.Exceptions;
using FluentValidation;
using MediatR;
using Microsoft.Extensions.Logging;

namespace ChatApp.Modules.Channels.Application.Commands.MessageConditions
{
    public record ToggleMessageAsLaterCommand(
        Guid ChannelId,
        Guid MessageId,
        Guid RequestedBy
    ) : IRequest<Result>;

    public class ToggleMessageAsLaterCommandValidator : AbstractValidator<ToggleMessageAsLaterCommand>
    {
        public ToggleMessageAsLaterCommandValidator()
        {
            RuleFor(x => x.ChannelId)
                .NotEmpty().WithMessage("Channel ID is required");

            RuleFor(x => x.MessageId)
                .NotEmpty().WithMessage("Message ID is required");

            RuleFor(x => x.RequestedBy)
                .NotEmpty().WithMessage("Requester ID is required");
        }
    }

    public class ToggleMessageAsLaterCommandHandler : IRequestHandler<ToggleMessageAsLaterCommand, Result>
    {
        private readonly IUnitOfWork _unitOfWork;
        private readonly ILogger<ToggleMessageAsLaterCommandHandler> _logger;

        public ToggleMessageAsLaterCommandHandler(
            IUnitOfWork unitOfWork,
            ILogger<ToggleMessageAsLaterCommandHandler> logger)
        {
            _unitOfWork = unitOfWork;
            _logger = logger;
        }

        public async Task<Result> Handle(
            ToggleMessageAsLaterCommand request,
            CancellationToken cancellationToken)
        {
            try
            {
                _logger?.LogInformation(
                    "Toggling message {MessageId} as later for user {UserId} in channel {ChannelId}",
                    request.MessageId,
                    request.RequestedBy,
                    request.ChannelId);

                // Verify message exists and belongs to the channel
                var message = await _unitOfWork.ChannelMessages.GetByIdAsync(
                    request.MessageId,
                    cancellationToken);

                if (message == null)
                    throw new NotFoundException($"Message with ID {request.MessageId} not found");

                if (message.ChannelId != request.ChannelId)
                    return Result.Failure("Message does not belong to the specified channel");

                if (message.IsDeleted)
                    return Result.Failure("Cannot mark deleted messages as later");

                // Verify user is a member of the channel
                var channelMember = await _unitOfWork.ChannelMembers.GetMemberAsync(
                    request.ChannelId,
                    request.RequestedBy,
                    cancellationToken);

                if (channelMember == null)
                    return Result.Failure("User is not a member of this channel");

                // Toggle logic:
                // If clicking on already marked message -> unmark it (toggle off)
                // If clicking on different message -> mark new one (auto-switches, previous mark is cleared)
                // If no mark exists -> mark this message
                if (channelMember.LastReadLaterMessageId.HasValue &&
                    channelMember.LastReadLaterMessageId.Value == request.MessageId)
                {
                    // Toggle OFF: Unmark the message
                    channelMember.UnmarkMessageAsLater();
                    _logger?.LogInformation(
                        "Message {MessageId} unmarked as later for user {UserId}",
                        request.MessageId,
                        request.RequestedBy);
                }
                else
                {
                    // Toggle ON or SWITCH: Mark message as later (clears previous mark automatically)
                    channelMember.MarkMessageAsLater(request.MessageId);
                    _logger?.LogInformation(
                        "Message {MessageId} marked as later for user {UserId}",
                        request.MessageId,
                        request.RequestedBy);
                }

                await _unitOfWork.SaveChangesAsync(cancellationToken);

                return Result.Success();
            }
            catch (Exception ex)
            {
                _logger?.LogError(
                    ex,
                    "Error toggling message {MessageId} as later for user {UserId}",
                    request.MessageId,
                    request.RequestedBy);
                return Result.Failure(ex.Message);
            }
        }
    }
}
