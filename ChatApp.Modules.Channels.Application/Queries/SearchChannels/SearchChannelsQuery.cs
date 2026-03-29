using ChatApp.Modules.Channels.Application.DTOs.Responses;
using ChatApp.Modules.Channels.Application.Interfaces;
using ChatApp.Modules.Channels.Domain.Enums;
using ChatApp.Shared.Kernel.Common;
using MediatR;
using Microsoft.Extensions.Logging;

namespace ChatApp.Modules.Channels.Application.Queries.SearchChannels
{
    public record SearchChannelsQuery(
        string SearchTerm,
        Guid RequestedBy,
        Guid? CallerCompanyId = null,
        bool IsSuperAdmin = false
    ) : IRequest<Result<List<ChannelDto>>>;

    public class SearchChannelsQueryHandler : IRequestHandler<SearchChannelsQuery, Result<List<ChannelDto>>>
    {
        private readonly IUnitOfWork _unitOfWork;
        private readonly ILogger<SearchChannelsQueryHandler> _logger;

        public SearchChannelsQueryHandler(
            IUnitOfWork unitOfWork,
            ILogger<SearchChannelsQueryHandler> logger)
        {
            _unitOfWork = unitOfWork;
            _logger = logger;
        }

        public async Task<Result<List<ChannelDto>>> Handle(
            SearchChannelsQuery request,
            CancellationToken cancellationToken)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(request.SearchTerm))
                {
                    return Result.Success(new List<ChannelDto>());
                }

                // Public channels — company-scoped
                var publicChannels = await _unitOfWork.Channels.GetPublicChannelsAsync(
                    request.CallerCompanyId, request.IsSuperAdmin, cancellationToken);

                // Get user's channels (includes private ones they're member of)
                var userChannels = await _unitOfWork.Channels.GetUserChannelsAsync(
                    request.RequestedBy,
                    cancellationToken);

                // Combine and filter by search term — artıq DTO-dur, birbaşa filter et
                var allAccessibleChannels = publicChannels
                    .UnionBy(userChannels, c => c.Id)
                    .Where(c => c.Name.Contains(request.SearchTerm, StringComparison.OrdinalIgnoreCase))
                    .OrderByDescending(c => c.CreatedAtUtc)
                    .ToList();

                return Result.Success(allAccessibleChannels);
            }
            catch (Exception ex)
            {
                _logger?.LogError(ex, "Error searching channels with term {SearchTerm}", request.SearchTerm);
                return Result.Failure<List<ChannelDto>>("An error occurred while searching channels");
            }
        }
    }
}