using ChatApp.Modules.Channels.Application.Interfaces;
using ChatApp.Shared.Infrastructure.SignalR.Services;
using ChatApp.Shared.Kernel.Common;
using ChatApp.Shared.Kernel.Exceptions;
using FluentValidation;
using MediatR;
using Microsoft.Extensions.Logging;

namespace ChatApp.Modules.Channels.Application.Commands.ChannelMessages
{
    public record EditChannelMessageCommand(
        Guid MessageId,
        string NewContent,
        Guid RequestedBy
    ) : IRequest<Result>;


    public class EditChannelMessageCommandValidator : AbstractValidator<EditChannelMessageCommand>
    {
        public EditChannelMessageCommandValidator()
        {
            RuleFor(x => x.MessageId)
                .NotEmpty().WithMessage("Message ID is required");

            RuleFor(x => x.NewContent)
                .NotEmpty().WithMessage("Message content cannot be empty")
                .MaximumLength(4000).WithMessage("Message content cannot exceed 4000 characters");

            RuleFor(x => x.RequestedBy)
                .NotEmpty().WithMessage("Requester ID is required");
        }
    }


    public class EditChannelMessageCommandHandler : IRequestHandler<EditChannelMessageCommand, Result>
    {
        private readonly IUnitOfWork _unitOfWork;
        private readonly ISignalRNotificationService _signalRNotificationService;
        private readonly ILogger<EditChannelMessageCommandHandler> _logger;

        public EditChannelMessageCommandHandler(
            IUnitOfWork unitOfWork,
            ISignalRNotificationService signalRNotificationService,
            ILogger<EditChannelMessageCommandHandler> logger)
        {
            _unitOfWork = unitOfWork;
            _signalRNotificationService= signalRNotificationService;
            _logger = logger;
        }

        public async Task<Result> Handle(
            EditChannelMessageCommand request,
            CancellationToken cancellationToken)
        {
            try
            {
                _logger?.LogInformation("Editing message {MessageId}", request.MessageId);

                var message = await _unitOfWork.ChannelMessages.GetByIdAsync(
                    request.MessageId,
                    cancellationToken);

                if (message == null)
                    throw new NotFoundException($"Message with ID {request.MessageId} not found");

                // Only sender can edit their own message
                if (message.SenderId != request.RequestedBy)
                {
                    return Result.Failure("You can only edit your own messages");
                }

                if (message.IsDeleted)
                {
                    return Result.Failure("Cannot edit deleted message");
                }

                var channelId=message.ChannelId;

                // Edit the message
                message.Edit(request.NewContent);

                await _unitOfWork.ChannelMessages.UpdateAsync(message, cancellationToken);
                await _unitOfWork.SaveChangesAsync(cancellationToken);

                // Get the full message DTO including reply info
                var messageDto = await _unitOfWork.ChannelMessages.GetByIdAsDtoAsync(message.Id, cancellationToken);

                if (messageDto != null)
                {
                    // Get all active channel members for notification
                    var members = await _unitOfWork.ChannelMembers.GetChannelMembersAsync(
                        channelId,
                        cancellationToken);

                    var memberUserIds = members
                        .Where(m => m.UserId != request.RequestedBy)
                        .Select(m => m.UserId)
                        .ToList();

                    // Send real-time notification with edited message (hybrid: group + direct connections)
                    await _signalRNotificationService.NotifyChannelMessageEditedToMembersAsync(
                        channelId,
                        memberUserIds,
                        messageDto);
                }

                _logger?.LogInformation("Message {MessageId} edited successfully", request.MessageId);

                return Result.Success();
            }
            catch (Exception ex)
            {
                _logger?.LogError(ex, "Error editing message {MessageId}", request.MessageId);
                return Result.Failure(ex.Message);
            }
        }
    }
}