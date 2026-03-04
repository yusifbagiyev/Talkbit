using ChatApp.Modules.Channels.Application.Interfaces;
using ChatApp.Shared.Kernel.Common;
using FluentValidation;
using MediatR;
using Microsoft.Extensions.Logging;

namespace ChatApp.Modules.Channels.Application.Commands.ChannelMembers
{
    public record TogglePinChannelCommand(
        Guid ChannelId,
        Guid UserId
    ) : IRequest<Result<bool>>; // Returns true if pinned, false if unpinned

    public class TogglePinChannelCommandValidator : AbstractValidator<TogglePinChannelCommand>
    {
        public TogglePinChannelCommandValidator()
        {
            RuleFor(x => x.ChannelId)
                .NotEmpty().WithMessage("Channel ID is required");

            RuleFor(x => x.UserId)
                .NotEmpty().WithMessage("User ID is required");
        }
    }

    public class TogglePinChannelCommandHandler : IRequestHandler<TogglePinChannelCommand, Result<bool>>
    {
        private readonly IUnitOfWork _unitOfWork;
        private readonly ILogger<TogglePinChannelCommandHandler> _logger;

        public TogglePinChannelCommandHandler(
            IUnitOfWork unitOfWork,
            ILogger<TogglePinChannelCommandHandler> logger)
        {
            _unitOfWork = unitOfWork;
            _logger = logger;
        }

        public async Task<Result<bool>> Handle(
            TogglePinChannelCommand request,
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
                    return Result.Failure<bool>("User is not a member of this channel");

                member.TogglePin();

                // Pin edildikdə hidden olan channel-ı avtomatik unhide et
                if (member.IsPinned && member.IsHidden)
                    member.Unhide();

                await _unitOfWork.SaveChangesAsync(cancellationToken);

                _logger?.LogInformation(
                    "Channel {ChannelId} pin toggled to {IsPinned} for user {UserId}",
                    request.ChannelId,
                    member.IsPinned,
                    request.UserId);

                return Result.Success(member.IsPinned);
            }
            catch (Exception ex)
            {
                _logger?.LogError(
                    ex,
                    "Error toggling pin for channel {ChannelId} by user {UserId}",
                    request.ChannelId,
                    request.UserId);
                return Result.Failure<bool>(ex.Message);
            }
        }
    }
}