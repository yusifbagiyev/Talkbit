using ChatApp.Modules.Channels.Domain.Entities;

namespace ChatApp.Modules.Channels.Application.Interfaces
{
    public interface IChannelMessageReadRepository
    {
        /// <summary>
        /// Checks if a specific message has been read by a user
        /// </summary>
        Task<bool> ExistsAsync(Guid messageId, Guid userId, CancellationToken cancellationToken = default);

        /// <summary>
        /// Bulk inserts multiple ChannelMessageRead records
        /// </summary>
        Task BulkInsertAsync(List<ChannelMessageRead> reads, CancellationToken cancellationToken = default);

        /// <summary>
        /// Gets the IDs of unread messages in a channel for a specific user.
        /// Optionally excludes messages sent by a specific sender (e.g. don't mark own messages as read).
        /// </summary>
        Task<List<Guid>> GetUnreadMessageIdsAsync(Guid channelId, Guid userId, CancellationToken cancellationToken = default, Guid? excludeSenderId = null);

        /// <summary>
        /// Returns which message IDs from a given list have already been read by the user — single DB query.
        /// </summary>
        Task<HashSet<Guid>> GetExistingReadMessageIdsAsync(List<Guid> messageIds, Guid userId, CancellationToken cancellationToken = default);

        /// <summary>
        /// Adds a single read record
        /// </summary>
        Task AddAsync(ChannelMessageRead read, CancellationToken cancellationToken = default);

        /// <summary>
        /// Gets the read count for a specific message (how many users have read it)
        /// </summary>
        Task<int> GetReadByCountAsync(Guid messageId, CancellationToken cancellationToken = default);

        /// <summary>
        /// Gets the read counts for multiple messages in a single query (bulk operation)
        /// Returns dictionary of messageId -> readByCount. Messages with 0 reads are included with count 0.
        /// </summary>
        Task<Dictionary<Guid, int>> GetReadByCountsAsync(List<Guid> messageIds, CancellationToken cancellationToken = default);
    }
}
