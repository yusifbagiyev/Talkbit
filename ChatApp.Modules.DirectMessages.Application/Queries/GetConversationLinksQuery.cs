using ChatApp.Modules.DirectMessages.Application.DTOs.Response;
using ChatApp.Modules.DirectMessages.Application.Interfaces;
using ChatApp.Shared.Kernel.Common;
using MediatR;
using Microsoft.Extensions.Logging;

namespace ChatApp.Modules.DirectMessages.Application.Queries
{
    /// <summary>
    /// Conversation-dakı link olan mesajları qaytarır (All Links panel üçün)
    /// </summary>
    public record GetConversationLinksQuery(
        Guid ConversationId,
        Guid RequestedBy,
        int PageSize = 30,
        DateTime? BeforeUtc = null
    ) : IRequest<Result<List<DirectMessageDto>>>;

    public class GetConversationLinksQueryHandler : IRequestHandler<GetConversationLinksQuery, Result<List<DirectMessageDto>>>
    {
        private readonly IUnitOfWork _unitOfWork;
        private readonly ILogger<GetConversationLinksQueryHandler> _logger;

        public GetConversationLinksQueryHandler(
            IUnitOfWork unitOfWork,
            ILogger<GetConversationLinksQueryHandler> logger)
        {
            _unitOfWork = unitOfWork;
            _logger = logger;
        }

        public async Task<Result<List<DirectMessageDto>>> Handle(
            GetConversationLinksQuery request,
            CancellationToken cancellationToken = default)
        {
            try
            {
                var conversation = await _unitOfWork.Conversations.GetByIdAsync(
                    request.ConversationId,
                    cancellationToken);

                if (conversation == null)
                    return Result.Failure<List<DirectMessageDto>>("You are not a participant in this conversation");

                var links = await _unitOfWork.Messages.GetConversationLinksAsync(
                    request.ConversationId,
                    request.PageSize,
                    request.BeforeUtc,
                    cancellationToken);

                return Result.Success(links);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving links for conversation {ConversationId}", request.ConversationId);
                return Result.Failure<List<DirectMessageDto>>("An error occurred while retrieving links");
            }
        }
    }
}
