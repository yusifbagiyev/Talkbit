using ChatApp.Modules.Channels.Application.DTOs.Responses;
using ChatApp.Modules.Channels.Application.Interfaces;
using ChatApp.Shared.Kernel.Common;
using MediatR;
using Microsoft.Extensions.Logging;

namespace ChatApp.Modules.Channels.Application.Queries.GetMessagesBeforeDate
{
    public record GetMessagesBeforeDateQuery(
        Guid ChannelId,
        DateTime BeforeUtc,
        Guid RequestedBy,
        int Limit = 100
    ) : IRequest<Result<List<ChannelMessageDto>>>;


    public class GetMessagesBeforeDateQueryHandler : IRequestHandler<GetMessagesBeforeDateQuery, Result<List<ChannelMessageDto>>>
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

        public async Task<Result<List<ChannelMessageDto>>> Handle(
            GetMessagesBeforeDateQuery request,
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

                // Get messages before date
                var messages = await _unitOfWork.ChannelMessages.GetMessagesBeforeDateAsync(
                    request.ChannelId,
                    request.BeforeUtc,
                    request.Limit,
                    visibleFromUtc,
                    cancellationToken);

                return Result.Success(messages);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving messages before date for channel {ChannelId}", request.ChannelId);
                return Result.Failure<List<ChannelMessageDto>>("An error occurred while retrieving messages");
            }
        }
    }
}