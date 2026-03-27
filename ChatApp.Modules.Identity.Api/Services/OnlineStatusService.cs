using ChatApp.Modules.Identity.Application.Interfaces;
using ChatApp.Shared.Infrastructure.SignalR.Services;

namespace ChatApp.Modules.Identity.Api.Services
{
    public class OnlineStatusService(IPresenceService presenceService) : IOnlineStatusService
    {
        public Task<Dictionary<Guid, bool>> GetOnlineStatusAsync(List<Guid> userIds)
            => presenceService.GetUsersOnlineStatusAsync(userIds);
    }
}
