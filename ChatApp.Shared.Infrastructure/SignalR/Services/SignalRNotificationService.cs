using ChatApp.Shared.Infrastructure.SignalR.Hubs;
using Microsoft.AspNetCore.SignalR;

namespace ChatApp.Shared.Infrastructure.SignalR.Services
{
    public class SignalRNotificationService : ISignalRNotificationService
    {
        private readonly IHubContext<ChatHub> _hubContext;
        private readonly IConnectionManager _connectionManager;

        public SignalRNotificationService(
            IHubContext<ChatHub> hubContext,
            IConnectionManager connectionManager)
        {
            _hubContext = hubContext;
            _connectionManager = connectionManager;
        }

        // ─── Channel Messages ─────────────────────────────────────────────────────

        public async Task NotifyChannelMessageToMembersAsync(Guid channelId, List<Guid> memberUserIds, object messageDto)
        {
            var allConnections = await CollectMemberConnectionsAsync(memberUserIds);
            if (allConnections.Count > 0)
            {
                await _hubContext.Clients
                    .Clients(allConnections)
                    .SendAsync("NewChannelMessage", messageDto);
            }
        }

        public async Task NotifyChannelMessageEditedToMembersAsync(Guid channelId, List<Guid> memberUserIds, object messageDto)
        {
            var allConnections = await CollectMemberConnectionsAsync(memberUserIds);
            if (allConnections.Count > 0)
            {
                await _hubContext.Clients
                    .Clients(allConnections)
                    .SendAsync("ChannelMessageEdited", messageDto);
            }
        }

        public async Task NotifyChannelMessageDeletedToMembersAsync(Guid channelId, List<Guid> memberUserIds, object messageDto)
        {
            var allConnections = await CollectMemberConnectionsAsync(memberUserIds);
            if (allConnections.Count > 0)
            {
                await _hubContext.Clients
                    .Clients(allConnections)
                    .SendAsync("ChannelMessageDeleted", messageDto);
            }
        }

        public async Task NotifyChannelMessageReactionsUpdatedToMembersAsync(Guid channelId, List<Guid> memberUserIds, Guid messageId, object reactions)
        {
            var allConnections = await CollectMemberConnectionsAsync(memberUserIds);
            if (allConnections.Count > 0)
            {
                await _hubContext.Clients
                    .Clients(allConnections)
                    .SendAsync("ChannelMessageReactionsUpdated", new { messageId, reactions });
            }
        }

        public async Task NotifyChannelMessagesReadToMembersAsync(Guid channelId, List<Guid> memberUserIds, Guid userId, Dictionary<Guid, int> messageReadCounts)
        {
            var allConnections = await CollectMemberConnectionsAsync(memberUserIds);
            if (allConnections.Count > 0)
            {
                await _hubContext.Clients
                    .Clients(allConnections)
                    .SendAsync("ChannelMessagesRead", channelId, userId, messageReadCounts);
            }
        }

        public async Task NotifyChannelMessagePinnedToMembersAsync(Guid channelId, List<Guid> memberUserIds, object messageDto)
        {
            var allConnections = await CollectMemberConnectionsAsync(memberUserIds);
            if (allConnections.Count > 0)
            {
                await _hubContext.Clients
                    .Clients(allConnections)
                    .SendAsync("ChannelMessagePinned", messageDto);
            }
        }

        public async Task NotifyChannelMessageUnpinnedToMembersAsync(Guid channelId, List<Guid> memberUserIds, object messageDto)
        {
            var allConnections = await CollectMemberConnectionsAsync(memberUserIds);
            if (allConnections.Count > 0)
            {
                await _hubContext.Clients
                    .Clients(allConnections)
                    .SendAsync("ChannelMessageUnpinned", messageDto);
            }
        }

        // ─── Direct Messages ──────────────────────────────────────────────────────

        public async Task NotifyDirectMessageAsync(Guid conversationId, Guid senderId, Guid receiverId, object messageDto)
        {
            var connections = await CollectMemberConnectionsAsync(new List<Guid> { senderId, receiverId });
            if (connections.Count > 0)
            {
                await _hubContext.Clients
                    .Clients(connections)
                    .SendAsync("NewDirectMessage", messageDto);
            }
        }

        public async Task NotifyDirectMessageEditedAsync(Guid conversationId, Guid senderId, Guid receiverId, object messageDto)
        {
            var connections = await CollectMemberConnectionsAsync(new List<Guid> { senderId, receiverId });
            if (connections.Count > 0)
            {
                await _hubContext.Clients
                    .Clients(connections)
                    .SendAsync("DirectMessageEdited", messageDto);
            }
        }

        public async Task NotifyDirectMessageDeletedAsync(Guid conversationId, Guid senderId, Guid receiverId, object messageDto)
        {
            var connections = await CollectMemberConnectionsAsync(new List<Guid> { senderId, receiverId });
            if (connections.Count > 0)
            {
                await _hubContext.Clients
                    .Clients(connections)
                    .SendAsync("DirectMessageDeleted", messageDto);
            }
        }

        public async Task NotifyMessageReadAsync(Guid conversationId, Guid messageId, Guid readBy, Guid senderId, DateTime readAtUtc)
        {
            var senderConnections = await _connectionManager.GetUserConnectionsAsync(senderId);
            if (senderConnections.Count > 0)
            {
                await _hubContext.Clients
                    .Clients(senderConnections)
                    .SendAsync("MessageRead", new { conversationId, messageId, readBy, readAtUtc });
            }
        }

        public async Task NotifyDirectMessagePinnedAsync(Guid conversationId, Guid senderId, Guid receiverId, object messageDto)
        {
            var connections = await CollectMemberConnectionsAsync(new List<Guid> { senderId, receiverId });
            if (connections.Count > 0)
            {
                await _hubContext.Clients
                    .Clients(connections)
                    .SendAsync("DirectMessagePinned", messageDto);
            }
        }

        public async Task NotifyDirectMessageUnpinnedAsync(Guid conversationId, Guid senderId, Guid receiverId, object messageDto)
        {
            var connections = await CollectMemberConnectionsAsync(new List<Guid> { senderId, receiverId });
            if (connections.Count > 0)
            {
                await _hubContext.Clients
                    .Clients(connections)
                    .SendAsync("DirectMessageUnpinned", messageDto);
            }
        }

        // ─── User / Channel Membership ────────────────────────────────────────────

        public async Task NotifyUserAsync(Guid userId, string eventName, object data)
        {
            var userConnections = await _connectionManager.GetUserConnectionsAsync(userId);
            if (userConnections.Count > 0)
            {
                await _hubContext.Clients
                    .Clients(userConnections)
                    .SendAsync(eventName, data);
            }
        }

        public async Task NotifyMemberAddedToChannelAsync(Guid userId, object channelDto)
        {
            var userConnections = await _connectionManager.GetUserConnectionsAsync(userId);
            if (userConnections.Count > 0)
            {
                await _hubContext.Clients
                    .Clients(userConnections)
                    .SendAsync("AddedToChannel", channelDto);
            }
        }

        public async Task NotifyMemberLeftChannelToMembersAsync(Guid channelId, List<Guid> memberUserIds, Guid leftUserId, string leftUserFullName)
        {
            var allConnections = await CollectMemberConnectionsAsync(memberUserIds);
            if (allConnections.Count > 0)
            {
                await _hubContext.Clients
                    .Clients(allConnections)
                    .SendAsync("MemberLeftChannel", new { channelId, leftUserId, leftUserFullName });
            }
        }

        // ─── Channel Updates ──────────────────────────────────────────────────────

        public async Task NotifyChannelUpdatedToMembersAsync(Guid channelId, List<Guid> memberUserIds, string name, string? avatarUrl)
        {
            var allConnections = await CollectMemberConnectionsAsync(memberUserIds);
            if (allConnections.Count > 0)
            {
                await _hubContext.Clients
                    .Clients(allConnections)
                    .SendAsync("ChannelUpdated", new { channelId, name, avatarUrl });
            }
        }

        // ─── Typing Indicators ────────────────────────────────────────────────────

        public async Task NotifyUserTypingInChannelToMembersAsync(Guid channelId, List<Guid> memberUserIds, Guid typingUserId, string fullName, bool isTyping)
        {
            var allConnections = await CollectMemberConnectionsAsync(memberUserIds);
            if (allConnections.Count > 0)
            {
                await _hubContext.Clients
                    .Clients(allConnections)
                    .SendAsync("UserTypingInChannel", channelId, typingUserId, fullName, isTyping);
            }
        }

        public async Task NotifyUserTypingInConversationToMembersAsync(Guid conversationId, List<Guid> memberUserIds, Guid typingUserId, bool isTyping)
        {
            var allConnections = await CollectMemberConnectionsAsync(memberUserIds);
            if (allConnections.Count > 0)
            {
                await _hubContext.Clients
                    .Clients(allConnections)
                    .SendAsync("UserTypingInConversation", conversationId, typingUserId, isTyping);
            }
        }

        // ─── Helper ───────────────────────────────────────────────────────────────

        private async Task<List<string>> CollectMemberConnectionsAsync(List<Guid> memberUserIds)
        {
            var allConnections = new List<string>();
            foreach (var memberId in memberUserIds)
            {
                var memberConnections = await _connectionManager.GetUserConnectionsAsync(memberId);
                allConnections.AddRange(memberConnections);
            }
            return allConnections;
        }
    }
}
