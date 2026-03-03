using ChatApp.Modules.Channels.Application.DTOs.Responses;
using ChatApp.Modules.Channels.Application.Interfaces;
using ChatApp.Shared.Kernel.Common;
using MediatR;
using Microsoft.Extensions.Logging;

namespace ChatApp.Modules.Channels.Application.Queries.GetSharedChannels;

public record GetSharedChannelsQuery(
    Guid CurrentUserId,
    Guid OtherUserId
) : IRequest<Result<List<SharedChannelDto>>>;

public class GetSharedChannelsQueryHandler(
    IUnitOfWork unitOfWork,
    ILogger<GetSharedChannelsQueryHandler> logger)
    : IRequestHandler<GetSharedChannelsQuery, Result<List<SharedChannelDto>>>
{
    public async Task<Result<List<SharedChannelDto>>> Handle(
        GetSharedChannelsQuery request,
        CancellationToken cancellationToken)
    {
        try
        {
            var sharedChannels = await unitOfWork.Channels.GetSharedChannelsAsync(
                request.CurrentUserId,
                request.OtherUserId,
                cancellationToken);

            return Result.Success(sharedChannels);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error retrieving shared channels between {UserId1} and {UserId2}",
                request.CurrentUserId, request.OtherUserId);
            return Result.Failure<List<SharedChannelDto>>("An error occurred while retrieving shared channels");
        }
    }
}
