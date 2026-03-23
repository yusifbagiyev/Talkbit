using ChatApp.Modules.Channels.Application.DTOs.Responses;
using ChatApp.Modules.Channels.Domain.Entities;

namespace ChatApp.Modules.Channels.Application.Interfaces
{
    public interface IChannelMessageRepository
    {
        Task<ChannelMessage?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
        Task<List<ChannelMessage>> GetByIdsAsync(List<Guid> ids, CancellationToken cancellationToken = default);
        Task<ChannelMessage?> GetByIdWithReactionsAsync(Guid id, CancellationToken cancellationToken = default);
        Task<ChannelMessageDto?> GetByIdAsDtoAsync(Guid id, CancellationToken cancellationToken = default);
        Task<List<ChannelMessageDto>> GetChannelMessagesAsync(
            Guid channelId,
            int pageSize = 30,
            DateTime? beforeUtc = null,
            DateTime? visibleFromUtc = null,
            CancellationToken cancellationToken = default);
        Task<List<ChannelMessageDto>> GetMessagesAroundAsync(
            Guid channelId,
            Guid messageId,
            int count = 30,
            DateTime? visibleFromUtc = null,
            CancellationToken cancellationToken = default);
        Task<List<ChannelMessageDto>> GetMessagesBeforeDateAsync(
            Guid channelId,
            DateTime beforeUtc,
            int limit = 100,
            DateTime? visibleFromUtc = null,
            CancellationToken cancellationToken = default);
        Task<List<ChannelMessageDto>> GetMessagesAfterDateAsync(
            Guid channelId,
            DateTime afterUtc,
            int limit = 100,
            DateTime? visibleFromUtc = null,
            CancellationToken cancellationToken = default);
        Task<List<ChannelMessageDto>> GetPinnedMessagesAsync(Guid channelId, CancellationToken cancellationToken = default);
        /// <summary>
        /// Gets messages with files in a channel (for Files &amp; Media panel)
        /// </summary>
        Task<List<ChannelMessageDto>> GetChannelFilesAsync(
            Guid channelId,
            int pageSize = 30,
            DateTime? beforeUtc = null,
            bool? isMedia = null,
            DateTime? visibleFromUtc = null,
            CancellationToken cancellationToken = default);
        Task<int> GetUnreadCountAsync(Guid channelId, Guid userId, CancellationToken cancellationToken = default);
        Task<int> MarkAllAsReadAsync(Guid channelId, Guid userId, CancellationToken cancellationToken = default);
        Task<bool> HasMessagesAsync(Guid channelId, CancellationToken cancellationToken = default);
        Task AddAsync(ChannelMessage message, CancellationToken cancellationToken = default);
        Task UpdateAsync(ChannelMessage message, CancellationToken cancellationToken = default);
        Task DeleteAsync(ChannelMessage message, CancellationToken cancellationToken = default);
    }
}