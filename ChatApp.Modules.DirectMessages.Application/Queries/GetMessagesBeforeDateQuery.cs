using ChatApp.Modules.DirectMessages.Application.DTOs.Response;
using ChatApp.Modules.DirectMessages.Application.Interfaces;
using ChatApp.Shared.Kernel.Common;
using MediatR;
using Microsoft.Extensions.Logging;

namespace ChatApp.Modules.DirectMessages.Application.Queries
{
    public record GetMessagesBeforeDateQuery(
        Guid ConversationId,
        DateTime BeforeUtc,
        Guid RequestedBy,
        int Limit = 100
    ) : IRequest<Result<List<DirectMessageDto>>>;


    public class GetMessagesBeforeDateQueryHandler : IRequestHandler<GetMessagesBeforeDateQuery, Result<List<DirectMessageDto>>>
    {
        private readonly IUnitOfWork _unitOfWork;
        private readonly ILogger<GetMessagesBeforeDateQueryHandler> _logger;

        public GetMessagesBeforeDateQueryHandler(
            IUnitOfWork unitOfWork,
            ILogger<GetMessagesBeforeDateQueryHandler> logger)
        {
            _unitOfWork = unitOfWork;
            _logger = logger;
        }

        public async Task<Result<List<DirectMessageDto>>> Handle(
            GetMessagesBeforeDateQuery request,
            CancellationToken cancellationToken = default)
        {
            try
            {
                // Verify conversation exists
                var conversation = await _unitOfWork.Conversations.GetByIdAsync(
                    request.ConversationId,
                    cancellationToken);

                if (conversation == null)
                {
                    return Result.Failure<List<DirectMessageDto>>("Conversation not found");
                }

                // İstifadəçinin conversation-da iştirakçı olduğunu yoxla
                if (conversation.User1Id != request.RequestedBy && conversation.User2Id != request.RequestedBy)
                    return Result.Failure<List<DirectMessageDto>>("Access denied — you are not a participant of this conversation");

                // Get messages before date
                var messages = await _unitOfWork.Messages.GetMessagesBeforeDateAsync(
                    request.ConversationId,
                    request.BeforeUtc,
                    request.Limit,
                    cancellationToken);

                return Result.Success(messages);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving messages before date for conversation {ConversationId}", request.ConversationId);
                return Result.Failure<List<DirectMessageDto>>("An error occurred while retrieving messages");
            }
        }
    }
}
