using ChatApp.Shared.Infrastructure.SignalR.Hubs;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging;

namespace ChatApp.Shared.Infrastructure.SignalR.Services
{
    public class SignalRNotificationService : ISignalRNotificationService
    {
        private readonly IHubContext<ChatHub> _hubContext;
        private readonly IConnectionManager _connectionManager;
        private readonly ILogger<SignalRNotificationService> _logger;

        public SignalRNotificationService(
            IHubContext<ChatHub> hubContext,
            IConnectionManager connectionManager,
            ILogger<SignalRNotificationService> logger)
        {
            _hubContext = hubContext;
            _connectionManager = connectionManager;
            _logger = logger;
        }

        // ─── Channel Messages ─────────────────────────────────────────────────────

        public async Task NotifyChannelMessageAsync(Guid channelId, object messageDto)
        {
            _logger?.LogDebug("Broadcasting new message to channel {ChannelId}", channelId);

            await _hubContext.Clients
                .Group($"channel_{channelId}")
                .SendAsync("NewChannelMessage", messageDto);
        }

        public async Task NotifyChannelMessageToMembersAsync(Guid channelId, List<Guid> memberUserIds, object messageDto)
        {
            _logger?.LogDebug("Broadcasting new message to channel {ChannelId} to {MemberCount} members",
                channelId, memberUserIds.Count);

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
            _logger?.LogDebug("Broadcasting edited message to channel {ChannelId} to {MemberCount} members",
                channelId, memberUserIds.Count);

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
            _logger?.LogDebug("Broadcasting deleted message to channel {ChannelId} to {MemberCount} members",
                channelId, memberUserIds.Count);

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
            _logger?.LogDebug("Broadcasting reactions updated for message {MessageId} to channel {ChannelId} to {MemberCount} members",
                messageId, channelId, memberUserIds.Count);

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
            _logger?.LogDebug("Broadcasting {Count} messages read for user {UserId} to channel {ChannelId} to {MemberCount} members",
                messageReadCounts.Count, userId, channelId, memberUserIds.Count);

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
            _logger?.LogDebug("Broadcasting pinned message to channel {ChannelId} to {MemberCount} members",
                channelId, memberUserIds.Count);

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
            _logger?.LogDebug("Broadcasting unpinned message to channel {ChannelId} to {MemberCount} members",
                channelId, memberUserIds.Count);

            var allConnections = await CollectMemberConnectionsAsync(memberUserIds);
            if (allConnections.Count > 0)
            {
                await _hubContext.Clients
                    .Clients(allConnections)
                    .SendAsync("ChannelMessageUnpinned", messageDto);
            }
        }

        // ─── Direct Messages ──────────────────────────────────────────────────────

        public async Task NotifyDirectMessageAsync(Guid conversationId, Guid receiverId, object messageDto)
        {
            _logger?.LogDebug(
                "Sending direct message notification to user {ReceiverId} in conversation {ConversationId}",
                receiverId, conversationId);

            // Send to conversation group
            await _hubContext.Clients
                .Group($"conversation_{conversationId}")
                .SendAsync("NewDirectMessage", messageDto);

            // Also send directly to receiver's connections (in case they're not in the group yet)
            var receiverConnections = await _connectionManager.GetUserConnectionsAsync(receiverId);
            if (receiverConnections.Count != 0)
            {
                await _hubContext.Clients
                    .Clients(receiverConnections)
                    .SendAsync("NewDirectMessage", messageDto);
            }
        }

        public async Task NotifyDirectMessageEditedAsync(Guid conversationId, Guid receiverId, object messageDto)
        {
            _logger?.LogDebug(
                "Sending edited direct message notification to user {ReceiverId} in conversation {ConversationId}",
                receiverId, conversationId);

            await _hubContext.Clients
                .Group($"conversation_{conversationId}")
                .SendAsync("DirectMessageEdited", messageDto);

            var receiverConnections = await _connectionManager.GetUserConnectionsAsync(receiverId);
            if (receiverConnections.Count != 0)
            {
                await _hubContext.Clients
                    .Clients(receiverConnections)
                    .SendAsync("DirectMessageEdited", messageDto);
            }
        }

        public async Task NotifyDirectMessageDeletedAsync(Guid conversationId, Guid receiverId, object messageDto)
        {
            _logger?.LogDebug(
                "Sending deleted direct message notification to user {ReceiverId} in conversation {ConversationId}",
                receiverId, conversationId);

            await _hubContext.Clients
                .Group($"conversation_{conversationId}")
                .SendAsync("DirectMessageDeleted", messageDto);

            var receiverConnections = await _connectionManager.GetUserConnectionsAsync(receiverId);
            if (receiverConnections.Count != 0)
            {
                await _hubContext.Clients
                    .Clients(receiverConnections)
                    .SendAsync("DirectMessageDeleted", messageDto);
            }
        }

        public async Task NotifyMessageReadAsync(Guid conversationId, Guid messageId, Guid readBy, Guid senderId, DateTime readAtUtc)
        {
            _logger?.LogDebug("Broadcasting message read for message {MessageId} to sender {SenderId}", messageId, senderId);

            var notification = new { conversationId, messageId, readBy, readAtUtc };

            // Send to conversation group (both users if they're in the group)
            await _hubContext.Clients
                .Group($"conversation_{conversationId}")
                .SendAsync("MessageRead", notification);

            // ALSO send directly to sender specifically
            var senderConnections = await _connectionManager.GetUserConnectionsAsync(senderId);
            if (senderConnections.Count != 0)
            {
                await _hubContext.Clients
                    .Clients(senderConnections)
                    .SendAsync("MessageRead", notification);
            }
        }

        public async Task NotifyDirectMessagePinnedAsync(Guid conversationId, Guid receiverId, object messageDto)
        {
            _logger?.LogDebug(
                "Sending pinned direct message notification to user {ReceiverId} in conversation {ConversationId}",
                receiverId, conversationId);

            await _hubContext.Clients
                .Group($"conversation_{conversationId}")
                .SendAsync("DirectMessagePinned", messageDto);

            var receiverConnections = await _connectionManager.GetUserConnectionsAsync(receiverId);
            if (receiverConnections.Count != 0)
            {
                await _hubContext.Clients
                    .Clients(receiverConnections)
                    .SendAsync("DirectMessagePinned", messageDto);
            }
        }

        public async Task NotifyDirectMessageUnpinnedAsync(Guid conversationId, Guid receiverId, object messageDto)
        {
            _logger?.LogDebug(
                "Sending unpinned direct message notification to user {ReceiverId} in conversation {ConversationId}",
                receiverId, conversationId);

            await _hubContext.Clients
                .Group($"conversation_{conversationId}")
                .SendAsync("DirectMessageUnpinned", messageDto);

            var receiverConnections = await _connectionManager.GetUserConnectionsAsync(receiverId);
            if (receiverConnections.Count != 0)
            {
                await _hubContext.Clients
                    .Clients(receiverConnections)
                    .SendAsync("DirectMessageUnpinned", messageDto);
            }
        }

        // ─── User / Channel Membership ────────────────────────────────────────────

        public async Task NotifyUserAsync(Guid userId, string eventName, object data)
        {
            _logger?.LogDebug("Sending event {EventName} to user {UserId}", eventName, userId);

            var userConnections = await _connectionManager.GetUserConnectionsAsync(userId);
            if (userConnections.Count != 0)
            {
                await _hubContext.Clients
                    .Clients(userConnections)
                    .SendAsync(eventName, data);
            }
        }

        public async Task NotifyMemberAddedToChannelAsync(Guid userId, object channelDto)
        {
            _logger?.LogDebug("Notifying user {UserId} about being added to channel", userId);

            var userConnections = await _connectionManager.GetUserConnectionsAsync(userId);
            if (userConnections.Count != 0)
            {
                await _hubContext.Clients
                    .Clients(userConnections)
                    .SendAsync("AddedToChannel", channelDto);
            }
        }

        public async Task NotifyMemberLeftChannelAsync(Guid channelId, Guid leftUserId, string leftUserFullName)
        {
            _logger?.LogDebug("Broadcasting member left to channel {ChannelId} group. Left user: {LeftUserId}",
                channelId, leftUserId);

            await _hubContext.Clients
                .Group($"channel_{channelId}")
                .SendAsync("MemberLeftChannel", new { channelId, leftUserId, leftUserFullName });
        }

        // ─── Typing Indicators ────────────────────────────────────────────────────

        public async Task NotifyUserTypingInChannelToMembersAsync(Guid channelId, List<Guid> memberUserIds, Guid typingUserId, string fullName, bool isTyping)
        {
            _logger?.LogDebug("Broadcasting typing indicator to channel {ChannelId} to {MemberCount} members",
                channelId, memberUserIds.Count);

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
            _logger?.LogDebug("Broadcasting typing indicator to conversation {ConversationId} to {MemberCount} members",
                conversationId, memberUserIds.Count);

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
