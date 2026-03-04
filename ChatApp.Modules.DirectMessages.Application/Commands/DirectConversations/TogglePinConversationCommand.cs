using ChatApp.Modules.DirectMessages.Application.Interfaces;
using ChatApp.Shared.Kernel.Common;
using FluentValidation;
using MediatR;
using Microsoft.Extensions.Logging;

namespace ChatApp.Modules.DirectMessages.Application.Commands.DirectConversations
{
    public record TogglePinConversationCommand(
        Guid ConversationId,
        Guid UserId
    ) : IRequest<Result<bool>>; // Returns true if pinned, false if unpinned

    public class TogglePinConversationCommandValidator : AbstractValidator<TogglePinConversationCommand>
    {
        public TogglePinConversationCommandValidator()
        {
            RuleFor(x => x.ConversationId)
                .NotEmpty().WithMessage("Conversation ID is required");

            RuleFor(x => x.UserId)
                .NotEmpty().WithMessage("User ID is required");
        }
    }

    public class TogglePinConversationCommandHandler : IRequestHandler<TogglePinConversationCommand, Result<bool>>
    {
        private readonly IUnitOfWork _unitOfWork;
        private readonly ILogger<TogglePinConversationCommandHandler> _logger;

        public TogglePinConversationCommandHandler(
            IUnitOfWork unitOfWork,
            ILogger<TogglePinConversationCommandHandler> logger)
        {
            _unitOfWork = unitOfWork;
            _logger = logger;
        }

        public async Task<Result<bool>> Handle(
            TogglePinConversationCommand request,
            CancellationToken cancellationToken)
        {
            try
            {
                var conversation = await _unitOfWork.Conversations.GetByIdAsync(
                    request.ConversationId,
                    cancellationToken);

                if (conversation == null)
                    return Result.Failure<bool>("Conversation not found");

                if (!conversation.IsParticipant(request.UserId))
                    return Result.Failure<bool>("User is not a participant in this conversation");

                var member = await _unitOfWork.ConversationMembers.GetByConversationAndUserAsync(
                    request.ConversationId,
                    request.UserId,
                    cancellationToken);

                if (member == null)
                    return Result.Failure<bool>("Conversation member not found");

                member.TogglePin();

                // Pin edildikdə hidden olan conversation-ı avtomatik unhide et
                if (member.IsPinned && member.IsHidden)
                    member.Unhide();

                await _unitOfWork.SaveChangesAsync(cancellationToken);

                _logger?.LogInformation(
                    "Conversation {ConversationId} pin toggled to {IsPinned} for user {UserId}",
                    request.ConversationId,
                    member.IsPinned,
                    request.UserId);

                return Result.Success(member.IsPinned);
            }
            catch (Exception ex)
            {
                _logger?.LogError(
                    ex,
                    "Error toggling pin for conversation {ConversationId} by user {UserId}",
                    request.ConversationId,
                    request.UserId);
                return Result.Failure<bool>(ex.Message);
            }
        }
    }
}
