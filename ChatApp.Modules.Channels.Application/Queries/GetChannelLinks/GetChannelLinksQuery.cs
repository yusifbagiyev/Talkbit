using ChatApp.Modules.Channels.Application.DTOs.Responses;
using ChatApp.Modules.Channels.Application.Interfaces;
using ChatApp.Shared.Kernel.Common;
using MediatR;
using Microsoft.Extensions.Logging;

namespace ChatApp.Modules.Channels.Application.Queries.GetChannelLinks
{
    /// <summary>
    /// Channel-dakı link olan mesajları qaytarır (All Links panel üçün)
    /// </summary>
    public record GetChannelLinksQuery(
        Guid ChannelId,
        Guid RequestedBy,
        int PageSize = 30,
        DateTime? BeforeUtc = null
    ) : IRequest<Result<List<ChannelMessageDto>>>;

    public class GetChannelLinksQueryHandler : IRequestHandler<GetChannelLinksQuery, Result<List<ChannelMessageDto>>>
    {
        private readonly IUnitOfWork _unitOfWork;
        private readonly ILogger<GetChannelLinksQueryHandler> _logger;

        public GetChannelLinksQueryHandler(
            IUnitOfWork unitOfWork,
            ILogger<GetChannelLinksQueryHandler> logger)
        {
            _unitOfWork = unitOfWork;
            _logger = logger;
        }

        public async Task<Result<List<ChannelMessageDto>>> Handle(
            GetChannelLinksQuery request,
            CancellationToken cancellationToken = default)
        {
            try
            {
                var channel = await _unitOfWork.Channels.GetByIdAsync(
                    request.ChannelId,
                    cancellationToken);

                if (channel == null)
                    return Result.Failure<List<ChannelMessageDto>>("Channel not found");

                // Private channel-da yalnız üzvlər görə bilər
                if (channel.Type == Domain.Enums.ChannelType.Private)
                {
                    var isMember = await _unitOfWork.Channels.IsUserMemberAsync(
                        request.ChannelId,
                        request.RequestedBy,
                        cancellationToken);

                    if (!isMember)
                        return Result.Failure<List<ChannelMessageDto>>("You must be a member to view private channel links");
                }

                // Üzvün tarixçə görünürlüyünü yoxla
                var member = await _unitOfWork.ChannelMembers.GetMemberAsync(
                    request.ChannelId, request.RequestedBy, cancellationToken);
                DateTime? visibleFromUtc = (member != null && !member.CanViewHistory)
                    ? member.JoinedAtUtc : null;

                var links = await _unitOfWork.ChannelMessages.GetChannelLinksAsync(
                    request.ChannelId,
                    request.PageSize,
                    request.BeforeUtc,
                    visibleFromUtc,
                    cancellationToken);

                return Result.Success(links);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving links for channel {ChannelId}", request.ChannelId);
                return Result.Failure<List<ChannelMessageDto>>("An error occurred while retrieving links");
            }
        }
    }
}
