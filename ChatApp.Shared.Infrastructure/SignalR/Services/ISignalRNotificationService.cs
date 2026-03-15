namespace ChatApp.Shared.Infrastructure.SignalR.Services
{
    /// <summary>
    /// Service for sending real-time notifications via SignalR
    /// This is used by modules to broadcast events
    /// </summary>
    public interface ISignalRNotificationService
    {
        // ─── Channel Messages ───
        Task NotifyChannelMessageAsync(Guid channelId, object messageDto);
        Task NotifyChannelMessageToMembersAsync(Guid channelId, List<Guid> memberUserIds, object messageDto);
        Task NotifyChannelMessageEditedToMembersAsync(Guid channelId, List<Guid> memberUserIds, object messageDto);
        Task NotifyChannelMessageDeletedToMembersAsync(Guid channelId, List<Guid> memberUserIds, object messageDto);
        Task NotifyChannelMessageReactionsUpdatedToMembersAsync(Guid channelId, List<Guid> memberUserIds, Guid messageId, object reactions);
        Task NotifyChannelMessagesReadToMembersAsync(Guid channelId, List<Guid> memberUserIds, Guid userId, Dictionary<Guid, int> messageReadCounts);
        Task NotifyChannelMessagePinnedToMembersAsync(Guid channelId, List<Guid> memberUserIds, object messageDto);
        Task NotifyChannelMessageUnpinnedToMembersAsync(Guid channelId, List<Guid> memberUserIds, object messageDto);

        // ─── Direct Messages ───
        Task NotifyDirectMessageAsync(Guid conversationId, Guid receiverId, object messageDto);
        Task NotifyDirectMessageEditedAsync(Guid conversationId, Guid receiverId, object messageDto);
        Task NotifyDirectMessageDeletedAsync(Guid conversationId, Guid receiverId, object messageDto);
        Task NotifyMessageReadAsync(Guid conversationId, Guid messageId, Guid readBy, Guid senderId, DateTime readAtUtc);
        Task NotifyDirectMessagePinnedAsync(Guid conversationId, Guid receiverId, object messageDto);
        Task NotifyDirectMessageUnpinnedAsync(Guid conversationId, Guid receiverId, object messageDto);

        // ─── User / Channel Membership ───
        Task NotifyUserAsync(Guid userId, string eventName, object data);
        Task NotifyMemberAddedToChannelAsync(Guid userId, object channelDto);
        Task NotifyMemberLeftChannelAsync(Guid channelId, Guid leftUserId, string leftUserFullName);

        // ─── Typing Indicators ───
        Task NotifyUserTypingInChannelToMembersAsync(Guid channelId, List<Guid> memberUserIds, Guid typingUserId, string fullName, bool isTyping);
        Task NotifyUserTypingInConversationToMembersAsync(Guid conversationId, List<Guid> memberUserIds, Guid typingUserId, bool isTyping);
    }
}