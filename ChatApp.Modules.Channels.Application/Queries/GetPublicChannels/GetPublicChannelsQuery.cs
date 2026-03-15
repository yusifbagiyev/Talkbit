using ChatApp.Modules.Channels.Application.DTOs.Responses;
using ChatApp.Modules.Channels.Application.Interfaces;
using ChatApp.Shared.Kernel.Common;
using MediatR;
using Microsoft.Extensions.Logging;

namespace ChatApp.Modules.Channels.Application.Queries.GetPublicChannels
{
    public record GetPublicChannelsQuery() : IRequest<Result<List<ChannelDto>>>;

    public class GetPublicChannelsQueryHandler : IRequestHandler<GetPublicChannelsQuery, Result<List<ChannelDto>>>
    {
        private readonly IUnitOfWork _unitOfWork;
        private readonly ILogger<GetPublicChannelsQueryHandler> _logger;

        public GetPublicChannelsQueryHandler(
            IUnitOfWork unitOfWork,
            ILogger<GetPublicChannelsQueryHandler> logger)
        {
            _unitOfWork = unitOfWork;
            _logger = logger;
        }

        public async Task<Result<List<ChannelDto>>> Handle(
            GetPublicChannelsQuery request,
            CancellationToken cancellationToken)
        {
            try
            {
                var channelDtos = await _unitOfWork.Channels.GetPublicChannelsAsync(cancellationToken);

                return Result.Success(channelDtos);
            }
            catch (Exception ex)
            {
                _logger?.LogError(ex, "Error retrieving public channels");
                return Result.Failure<List<ChannelDto>>("An error occurred while retrieving public channels");
            }
        }
    }
}