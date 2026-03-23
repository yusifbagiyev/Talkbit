using ChatApp.Modules.Channels.Application.DTOs.Responses;
using ChatApp.Modules.Channels.Application.Interfaces;
using ChatApp.Shared.Kernel.Common;
using MediatR;
using Microsoft.Extensions.Logging;

namespace ChatApp.Modules.Channels.Application.Queries.GetChannelFiles
{
    /// <summary>
    /// Channel-dakı fayl olan mesajları qaytarır (Files & Media panel üçün)
    /// IsMedia: true=şəkillər, false=sənədlər, null=hamısı
    /// </summary>
    public record GetChannelFilesQuery(
        Guid ChannelId,
        Guid RequestedBy,
        int PageSize = 30,
        DateTime? BeforeUtc = null,
        bool? IsMedia = null
    ) : IRequest<Result<List<ChannelMessageDto>>>;

    public class GetChannelFilesQueryHandler : IRequestHandler<GetChannelFilesQuery, Result<List<ChannelMessageDto>>>
    {
        private readonly IUnitOfWork _unitOfWork;
        private readonly ILogger<GetChannelFilesQueryHandler> _logger;

        public GetChannelFilesQueryHandler(
            IUnitOfWork unitOfWork,
            ILogger<GetChannelFilesQueryHandler> logger)
        {
            _unitOfWork = unitOfWork;
            _logger = logger;
        }

        public async Task<Result<List<ChannelMessageDto>>> Handle(
            GetChannelFilesQuery request,
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
                        return Result.Failure<List<ChannelMessageDto>>("You must be a member to view private channel files");
                }

                // Üzvün tarixçə görünürlüyünü yoxla
                var member = await _unitOfWork.ChannelMembers.GetMemberAsync(
                    request.ChannelId, request.RequestedBy, cancellationToken);
                DateTime? visibleFromUtc = (member != null && !member.CanViewHistory)
                    ? member.JoinedAtUtc : null;

                var files = await _unitOfWork.ChannelMessages.GetChannelFilesAsync(
                    request.ChannelId,
                    request.PageSize,
                    request.BeforeUtc,
                    request.IsMedia,
                    visibleFromUtc,
                    cancellationToken);

                return Result.Success(files);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving files for channel {ChannelId}", request.ChannelId);
                return Result.Failure<List<ChannelMessageDto>>("An error occurred while retrieving files");
            }
        }
    }
}
