using ChatApp.Modules.Channels.Application.DTOs.Responses;
using ChatApp.Modules.Channels.Application.Interfaces;
using ChatApp.Shared.Kernel.Common;
using MediatR;
using Microsoft.Extensions.Logging;

namespace ChatApp.Modules.Channels.Application.Queries.GetMessagesAfterDate
{
    public record GetMessagesAfterDateQuery(
        Guid ChannelId,
        DateTime AfterUtc,
        Guid RequestedBy,
        int Limit = 100
    ) : IRequest<Result<List<ChannelMessageDto>>>;


    public class GetMessagesAfterDateQueryHandler : IRequestHandler<GetMessagesAfterDateQuery, Result<List<ChannelMessageDto>>>
    {
        private readonly IUnitOfWork _unitOfWork;
        private readonly ILogger<GetMessagesAfterDateQueryHandler> _logger;

        public GetMessagesAfterDateQueryHandler(
            IUnitOfWork unitOfWork,
            ILogger<GetMessagesAfterDateQueryHandler> logger)
        {
            _unitOfWork = unitOfWork;
            _logger = logger;
        }

        public async Task<Result<List<ChannelMessageDto>>> Handle(
            GetMessagesAfterDateQuery request,
            CancellationToken cancellationToken = default)
        {
            try
            {
                // Verify channel exists
                var channel = await _unitOfWork.Channels.GetByIdAsync(
                    request.ChannelId,
                    cancellationToken);

                if (channel == null)
                {
                    return Result.Failure<List<ChannelMessageDto>>("Channel not found");
                }

                // Üzv yoxlaması — yalnız üzvlər mesajları görə bilər
                var member = await _unitOfWork.ChannelMembers.GetMemberAsync(
                    request.ChannelId, request.RequestedBy, cancellationToken);
                if (member == null)
                    return Result.Failure<List<ChannelMessageDto>>("You are not a member of this channel");

                DateTime? visibleFromUtc = !member.CanViewHistory ? member.JoinedAtUtc : null;

                // Get messages after date
                var messages = await _unitOfWork.ChannelMessages.GetMessagesAfterDateAsync(
                    request.ChannelId,
                    request.AfterUtc,
                    request.Limit,
                    visibleFromUtc,
                    cancellationToken);

                return Result.Success(messages);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving messages after date for channel {ChannelId}", request.ChannelId);
                return Result.Failure<List<ChannelMessageDto>>("An error occurred while retrieving messages");
            }
        }
    }
}
