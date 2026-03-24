using ChatApp.Modules.Channels.Domain.Events;
using ChatApp.Shared.Infrastructure.SignalR.Services;
using Microsoft.Extensions.Logging;

namespace ChatApp.Modules.Channels.Application.Events
{
    public class ChannelUpdatedEventHandler(
        ISignalRNotificationService signalRNotificationService,
        IChannelMemberCache channelMemberCache,
        ILogger<ChannelUpdatedEventHandler> logger)
    {
        public async Task HandleAsync(ChannelUpdatedEvent @event)
        {
            try
            {
                var memberUserIds = await channelMemberCache.GetChannelMemberIdsAsync(@event.ChannelId);

                await signalRNotificationService.NotifyChannelUpdatedToMembersAsync(
                    @event.ChannelId,
                    memberUserIds,
                    @event.Name,
                    @event.AvatarUrl);
            }
            catch (Exception ex)
            {
                logger.LogError(
                    ex,
                    "Error handling ChannelUpdatedEvent for channel {ChannelId}",
                    @event.ChannelId);
            }
        }
    }
}
