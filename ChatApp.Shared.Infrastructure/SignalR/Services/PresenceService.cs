using ChatApp.Shared.Infrastructure.SignalR.Hubs;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging;

namespace ChatApp.Shared.Infrastructure.SignalR.Services
{
    public class PresenceService : IPresenceService
    {
        private readonly IConnectionManager _connectionManager;
        private readonly IHubContext<ChatHub> _hubContext;
        private readonly ILogger<PresenceService> _logger;

        public PresenceService(
            IConnectionManager connectionManager,
            IHubContext<ChatHub> hubContext,
            ILogger<PresenceService> logger)
        {
            _connectionManager= connectionManager;
            _hubContext= hubContext;
            _logger= logger;
        }

        public async Task BroadcastPresenceUpdateAsync(Guid userId, bool isOnline)
        {
            _logger.LogDebug("Broadcasting presence update: User {UserId} is {Status}",
                userId,
                isOnline ? "online" : "offline");

            // Broadcast to all connected clients
            var eventName = isOnline ? "UserOnline" : "UserOffline";
            await _hubContext.Clients.All.SendAsync(eventName, userId);
        }

        public async Task<Dictionary<Guid, bool>> GetUsersOnlineStatusAsync(List<Guid> userIds)
        {
            var connections = await _connectionManager.GetUsersConnectionsAsync(userIds);
            var result = new Dictionary<Guid, bool>(userIds.Count);
            foreach (var userId in userIds)
            {
                result[userId] = connections.ContainsKey(userId);
            }
            return result;
        }

        public async Task UserConnectedAsync(Guid userId, string connectionId)
        {
            var connectionCount=await _connectionManager.GetConnectionCountAsync(userId);

            // Only broadcast if this is the first connection (user went from offline to online)
            if (connectionCount == 1)
            {
                await BroadcastPresenceUpdateAsync(userId, true);
                _logger?.LogInformation("User {UserId} went online", userId);
            }
        }

        public async Task UserDisconnectedAsync(string connectionId)
        {
            var userId=await _connectionManager.GetUserIdByConnectionAsync(connectionId);

            if (userId.HasValue)
            {
                var connectionCount=await _connectionManager.GetConnectionCountAsync(userId.Value);

                // Only broadcast if this was the last connection (user went from online to offline)
                if (connectionCount == 0)
                {
                    await BroadcastPresenceUpdateAsync(userId.Value, false);
                    _logger?.LogInformation("User {UserId} went offline", userId.Value);
                }
            }
        }
    }
}