using ChatApp.Modules.DirectMessages.Application.DTOs.Response;
using ChatApp.Modules.DirectMessages.Domain.Entities;

namespace ChatApp.Modules.DirectMessages.Application.Interfaces
{
    public interface IDirectMessageRepository
    {
        Task<DirectMessage?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
        Task<List<DirectMessage>> GetByIdsAsync(List<Guid> ids, CancellationToken cancellationToken = default);
        Task<DirectMessage?> GetByIdWithReactionsAsync(Guid id, CancellationToken cancellationToken = default);
        Task<DirectMessageDto?> GetByIdAsDtoAsync(Guid id, CancellationToken cancellationToken = default);
        Task<List<DirectMessageDto>> GetConversationMessagesAsync(
            Guid conversationId,
            int pageSize = 30,
            DateTime? beforeUtc = null,
            CancellationToken cancellationToken = default);
        Task<List<DirectMessageDto>> GetMessagesAroundAsync(
            Guid conversationId,
            Guid messageId,
            int count = 30,
            CancellationToken cancellationToken = default);
        Task<List<DirectMessageDto>> GetMessagesBeforeDateAsync(
            Guid conversationId,
            DateTime beforeUtc,
            int limit = 100,
            CancellationToken cancellationToken = default);
        Task<List<DirectMessageDto>> GetMessagesAfterDateAsync(
            Guid conversationId,
            DateTime afterUtc,
            int limit = 100,
            CancellationToken cancellationToken = default);
        Task<List<DirectMessageDto>> GetPinnedMessagesAsync(Guid conversationId, CancellationToken cancellationToken = default);
        /// <summary>
        /// Gets messages with files in a conversation (for Files &amp; Media panel)
        /// </summary>
        Task<List<DirectMessageDto>> GetConversationFilesAsync(
            Guid conversationId,
            int pageSize = 30,
            DateTime? beforeUtc = null,
            bool? isMedia = null,
            CancellationToken cancellationToken = default);
        Task<int> GetUnreadCountAsync(Guid conversationId, Guid userId, CancellationToken cancellationToken = default);
        Task<List<DirectMessage>> GetUnreadMessagesForUserAsync(Guid conversationId, Guid userId, CancellationToken cancellationToken = default);
        Task<int> MarkAllAsReadAsync(Guid conversationId, Guid userId, CancellationToken cancellationToken = default);
        Task AddAsync(DirectMessage message, CancellationToken cancellationToken = default);
        Task UpdateAsync(DirectMessage message, CancellationToken cancellationToken = default);
        Task DeleteAsync(DirectMessage message, CancellationToken cancellationToken = default);
    }
}