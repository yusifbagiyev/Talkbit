using ChatApp.Modules.DirectMessages.Application.DTOs.Response;
using ChatApp.Modules.DirectMessages.Application.Interfaces;
using ChatApp.Shared.Kernel.Common;
using MediatR;
using Microsoft.Extensions.Logging;

namespace ChatApp.Modules.DirectMessages.Application.Queries
{
    /// <summary>
    /// Conversation-dakı fayl olan mesajları qaytarır (Files & Media panel üçün)
    /// isMedia: true=şəkillər, false=sənədlər, null=hamısı
    /// </summary>
    public record GetConversationFilesQuery(
        Guid ConversationId,
        Guid RequestedBy,
        int PageSize = 30,
        DateTime? BeforeUtc = null,
        bool? IsMedia = null
    ) : IRequest<Result<List<DirectMessageDto>>>;

    public class GetConversationFilesQueryHandler : IRequestHandler<GetConversationFilesQuery, Result<List<DirectMessageDto>>>
    {
        private readonly IUnitOfWork _unitOfWork;
        private readonly ILogger<GetConversationFilesQueryHandler> _logger;

        public GetConversationFilesQueryHandler(
            IUnitOfWork unitOfWork,
            ILogger<GetConversationFilesQueryHandler> logger)
        {
            _unitOfWork = unitOfWork;
            _logger = logger;
        }

        public async Task<Result<List<DirectMessageDto>>> Handle(
            GetConversationFilesQuery request,
            CancellationToken cancellationToken = default)
        {
            try
            {
                // Conversation mövcudluğunu və istifadəçi hüquqlarını yoxla
                var conversation = await _unitOfWork.Conversations.GetByIdAsync(
                    request.ConversationId,
                    cancellationToken);

                if (conversation == null)
                    return Result.Failure<List<DirectMessageDto>>("You are not a participant in this conversation");

                // İstifadəçinin conversation-da iştirakçı olduğunu yoxla
                if (conversation.User1Id != request.RequestedBy && conversation.User2Id != request.RequestedBy)
                    return Result.Failure<List<DirectMessageDto>>("Access denied — you are not a participant of this conversation");

                var files = await _unitOfWork.Messages.GetConversationFilesAsync(
                    request.ConversationId,
                    request.PageSize,
                    request.BeforeUtc,
                    request.IsMedia,
                    cancellationToken);

                return Result.Success(files);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving files for conversation {ConversationId}", request.ConversationId);
                return Result.Failure<List<DirectMessageDto>>("An error occurred while retrieving files");
            }
        }
    }
}
