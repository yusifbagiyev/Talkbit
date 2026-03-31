using ChatApp.Modules.DirectMessages.Application.DTOs.Request;
using ChatApp.Modules.DirectMessages.Application.DTOs.Response;
using ChatApp.Modules.DirectMessages.Application.Interfaces;
using ChatApp.Modules.DirectMessages.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using ChatApp.Shared.Kernel;
using ChatApp.Shared.Kernel.Common;
using ChatApp.Modules.Files.Domain.Entities;

namespace ChatApp.Modules.DirectMessages.Infrastructure.Persistence.Repositories
{
    public class DirectMessageRepository:IDirectMessageRepository
    {
        private readonly DirectMessagesDbContext _context;

        public DirectMessageRepository(DirectMessagesDbContext context)
        {
            _context= context;
        }

        public async Task AddAsync(DirectMessage message, CancellationToken cancellationToken = default)
        {
            await _context.DirectMessages.AddAsync(message,cancellationToken);
        }


        public Task UpdateAsync(DirectMessage message, CancellationToken cancellationToken = default)
        {
            _context.DirectMessages.Update(message);
            return Task.CompletedTask;
        }


        public Task DeleteAsync(DirectMessage message, CancellationToken cancellationToken = default)
        {
            _context.DirectMessages.Remove(message);
            return Task.CompletedTask;
        }


        public async Task<DirectMessage?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
        {
            return await _context.DirectMessages
                .FirstOrDefaultAsync(m => m.Id == id, cancellationToken);
        }

        public async Task<List<DirectMessage>> GetByIdsAsync(List<Guid> ids, CancellationToken cancellationToken = default)
        {
            return await _context.DirectMessages
                .Where(m => ids.Contains(m.Id))
                .ToListAsync(cancellationToken);
        }


        public async Task<DirectMessage?> GetByIdWithReactionsAsync(Guid id, CancellationToken cancellationToken = default)
        {
            return await _context.DirectMessages
                .Include(m=>m.Reactions)
                .FirstOrDefaultAsync(m=>m.Id==id,cancellationToken);
        }


        public async Task<DirectMessageDto?> GetByIdAsDtoAsync(Guid id, CancellationToken cancellationToken = default)
        {
            var result = await BuildBaseQuery()
                        .Where(r => r.Id == id)
                        .FirstOrDefaultAsync(cancellationToken);

            if (result == null)
                return null;

            var messageIds = new List<Guid> { id };
            var (reactionCounts, reactions, mentions) = await LoadRelatedDataAsync(messageIds, cancellationToken);

            return MapToDto(result, reactionCounts, reactions, mentions, sanitizeContent: true);
        }


        public async Task<List<DirectMessageDto>> GetConversationMessagesAsync(
            Guid conversationId,
            int pageSize = 30,
            DateTime? beforeUtc = null,
            CancellationToken cancellationToken = default)
        {
            // Real database join with users table
            var query = BuildBaseQuery()
                .Where(r => r.ConversationId == conversationId); // Removed IsDeleted filter - show deleted messages as "This message was deleted"

            if (beforeUtc.HasValue)
            {
                query = query.Where(m => m.CreatedAtUtc < beforeUtc.Value);
            }

            var results = await query
                .OrderByDescending(m => m.CreatedAtUtc)
                .Take(pageSize)
                .ToListAsync(cancellationToken);

            return await MapResultsAsync(results, sanitizeContent: true, cancellationToken);
        }


        public async Task<List<DirectMessageDto>> GetMessagesAroundAsync(
            Guid conversationId,
            Guid messageId,
            int count = 50,
            CancellationToken cancellationToken = default)
        {
            // 1. Hədəf mesajın tarixini tap
            var targetMessage = await _context.DirectMessages
                .Where(m => m.Id == messageId && m.ConversationId == conversationId)
                .Select(m => new { m.CreatedAtUtc })
                .FirstOrDefaultAsync(cancellationToken);

            if (targetMessage == null)
                return new List<DirectMessageDto>();

            var targetDate = targetMessage.CreatedAtUtc;
            var halfCount = count / 2;

            // 2. Base query (projection)
            var baseQuery = BuildBaseQuery()
                .Where(r => r.ConversationId == conversationId);

            // 3. Hədəf mesajdan ƏVVƏL olan mesajlar (hədəf daxil)
            var beforeMessages = await baseQuery
                .Where(m => m.CreatedAtUtc <= targetDate)
                .OrderByDescending(m => m.CreatedAtUtc)
                .Take(halfCount + 1)
                .ToListAsync(cancellationToken);

            // 4. Hədəf mesajdan SONRA olan mesajlar (hədəf istisna)
            var afterMessages = await baseQuery
                .Where(m => m.CreatedAtUtc > targetDate)
                .OrderBy(m => m.CreatedAtUtc)
                .Take(halfCount)
                .ToListAsync(cancellationToken);

            // 5. Birləşdir və DESC sırala (digər endpoint-lərlə konsistent)
            var results = beforeMessages.Concat(afterMessages)
                .OrderByDescending(m => m.CreatedAtUtc)
                .ToList();

            return await MapResultsAsync(results, sanitizeContent: true, cancellationToken);
        }


        public async Task<List<DirectMessageDto>> GetMessagesBeforeDateAsync(
            Guid conversationId,
            DateTime beforeUtc,
            int limit = 100,
            CancellationToken cancellationToken = default)
        {
            // Base query with all joins
            var results = await BuildBaseQuery()
                .Where(r => r.ConversationId == conversationId
                         && r.CreatedAtUtc < beforeUtc)
                .OrderByDescending(m => m.CreatedAtUtc)
                .Take(limit)
                .ToListAsync(cancellationToken);

            return await MapResultsAsync(results, sanitizeContent: true, cancellationToken);
        }


        public async Task<List<DirectMessageDto>> GetMessagesAfterDateAsync(
            Guid conversationId,
            DateTime afterUtc,
            int limit = 100,
            CancellationToken cancellationToken = default)
        {
            // Base query with all joins
            var results = await BuildBaseQuery()
                .Where(r => r.ConversationId == conversationId
                         && r.CreatedAtUtc > afterUtc)
                .OrderBy(m => m.CreatedAtUtc)
                .Take(limit)
                .ToListAsync(cancellationToken);

            return await MapResultsAsync(results, sanitizeContent: true, cancellationToken);
        }


        public async Task<int> GetUnreadCountAsync(
            Guid conversationId,
            Guid userId,
            CancellationToken cancellationToken = default)
        {
            return await _context.DirectMessages
                .Where(m => m.ConversationId == conversationId &&
                       m.ReceiverId == userId &&
                       !m.IsRead &&
                       !m.IsDeleted)
                .CountAsync(cancellationToken);
        }


        public async Task<List<DirectMessage>> GetUnreadMessagesForUserAsync(
            Guid conversationId,
            Guid userId,
            CancellationToken cancellationToken = default)
        {
            return await _context.DirectMessages
                .Where(m => m.ConversationId == conversationId &&
                       m.ReceiverId == userId &&
                       !m.IsRead &&
                       !m.IsDeleted)
                .OrderBy(m => m.CreatedAtUtc)
                .ToListAsync(cancellationToken);
        }


        public async Task<int> MarkAllAsReadAsync(
            Guid conversationId,
            Guid userId,
            CancellationToken cancellationToken = default)
        {
            // Bulk update all unread messages in the conversation for the user
            var affectedRows = await _context.DirectMessages
                .Where(m => m.ConversationId == conversationId &&
                       m.ReceiverId == userId &&
                       !m.IsRead &&
                       !m.IsDeleted)
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(m => m.IsRead, true)
                    .SetProperty(m => m.ReadAtUtc, DateTime.UtcNow),
                    cancellationToken);

            return affectedRows;
        }


        public async Task<List<DirectMessageDto>> GetPinnedMessagesAsync(
            Guid conversationId,
            CancellationToken cancellationToken = default)
        {
            // Database join to get pinned messages with user details
            var results = await BuildBaseQuery()
                .Where(r => r.ConversationId == conversationId
                         && r.IsPinned
                         && !r.IsDeleted)
                .OrderBy(r => r.PinnedAtUtc)
                .ToListAsync(cancellationToken);

            return await MapResultsAsync(results, sanitizeContent: false, cancellationToken); // Pinned messages are not deleted, no sanitization needed
        }


        /// <summary>
        /// Conversation-dakı fayl olan mesajları pagination ilə qaytarır (Files & Media panel üçün)
        /// </summary>
        public async Task<List<DirectMessageDto>> GetConversationFilesAsync(
            Guid conversationId,
            int pageSize = 30,
            DateTime? beforeUtc = null,
            bool? isMedia = null,
            CancellationToken cancellationToken = default)
        {
            var query = BuildBaseQuery()
                .Where(r => r.ConversationId == conversationId
                         && r.FileId != null
                         && !r.IsDeleted);

            // Media/file filterləmə
            if (isMedia == true)
                query = query.Where(r => r.FileContentType != null && r.FileContentType.StartsWith("image/"));
            else if (isMedia == false)
                query = query.Where(r => r.FileContentType == null || !r.FileContentType.StartsWith("image/"));

            if (beforeUtc.HasValue)
                query = query.Where(r => r.CreatedAtUtc < beforeUtc.Value);

            var results = await query
                .OrderByDescending(r => r.CreatedAtUtc)
                .Take(pageSize)
                .ToListAsync(cancellationToken);

            return await MapResultsAsync(results, sanitizeContent: false, cancellationToken);
        }

        /// <summary>
        /// Link olan mesajları qaytarır (All Links panel üçün)
        /// Content-də http:// və ya https:// olan mesajları filter edir
        /// </summary>
        public async Task<List<DirectMessageDto>> GetConversationLinksAsync(
            Guid conversationId,
            int pageSize = 30,
            DateTime? beforeUtc = null,
            CancellationToken cancellationToken = default)
        {
            var query = BuildBaseQuery()
                .Where(r => r.ConversationId == conversationId
                         && !r.IsDeleted
                         && (r.Content.Contains("http://") || r.Content.Contains("https://")));

            if (beforeUtc.HasValue)
                query = query.Where(r => r.CreatedAtUtc < beforeUtc.Value);

            var results = await query
                .OrderByDescending(r => r.CreatedAtUtc)
                .Take(pageSize)
                .ToListAsync(cancellationToken);

            return await MapResultsAsync(results, sanitizeContent: false, cancellationToken);
        }


        #region Private Helper Methods

        /// <summary>
        /// Strongly-typed projection class used by all query methods.
        /// Uses object initializer syntax (not constructor) so EF Core can translate
        /// .Where() and .OrderBy() on properties after .Select().
        /// </summary>
        private class RawMessageProjection
        {
            public Guid Id { get; init; }
            public Guid ConversationId { get; init; }
            public Guid SenderId { get; init; }
            public string SenderEmail { get; init; } = null!;
            public string SenderFullName { get; init; } = null!;
            public string? AvatarUrl { get; init; }
            public Guid ReceiverId { get; init; }
            public string Content { get; init; } = null!;
            public string? FileId { get; init; }
            public string? FileName { get; init; }
            public string? FileContentType { get; init; }
            public long? FileSizeInBytes { get; init; }
            public int? FileWidth { get; init; }
            public int? FileHeight { get; init; }
            public bool IsEdited { get; init; }
            public bool IsDeleted { get; init; }
            public bool IsRead { get; init; }
            public DateTime? ReadAtUtc { get; init; }
            public bool IsPinned { get; init; }
            public DateTime CreatedAtUtc { get; init; }
            public DateTime? EditedAtUtc { get; init; }
            public DateTime? PinnedAtUtc { get; init; }
            public Guid? ReplyToMessageId { get; init; }
            public string? ReplyToContent { get; init; }
            public bool ReplyToIsDeleted { get; init; }
            public string? ReplyToSenderName { get; init; }
            public string? ReplyToFileId { get; init; }
            public string? ReplyToFileName { get; init; }
            public string? ReplyToFileContentType { get; init; }
            public bool IsForwarded { get; init; }
        }

        /// <summary>
        /// Builds the base LINQ query with all necessary joins (sender, file, reply, reply sender, reply file).
        /// Each public method calls this then adds its specific .Where(), .OrderBy(), .Take().
        /// </summary>
        private IQueryable<RawMessageProjection> BuildBaseQuery()
        {
            return from message in _context.DirectMessages
                   join sender in _context.Set<UserReadModel>() on message.SenderId equals sender.Id
                   join file in _context.Set<FileMetadata>() on message.FileId equals file.Id.ToString() into fileJoin
                   from file in fileJoin.DefaultIfEmpty()
                   join repliedMessage in _context.DirectMessages on message.ReplyToMessageId equals repliedMessage.Id into replyJoin
                   from repliedMessage in replyJoin.DefaultIfEmpty()
                   join repliedSender in _context.Set<UserReadModel>() on repliedMessage.SenderId equals repliedSender.Id into repliedSenderJoin
                   from repliedSender in repliedSenderJoin.DefaultIfEmpty()
                   join repliedFile in _context.Set<FileMetadata>() on repliedMessage.FileId equals repliedFile.Id.ToString() into repliedFileJoin
                   from repliedFile in repliedFileJoin.DefaultIfEmpty()
                   select new RawMessageProjection
                   {
                       Id = message.Id,
                       ConversationId = message.ConversationId,
                       SenderId = message.SenderId,
                       SenderEmail = sender.Email,
                       SenderFullName = sender.FullName,
                       AvatarUrl = sender.AvatarUrl,
                       ReceiverId = message.ReceiverId,
                       Content = message.Content,
                       FileId = message.FileId,
                       FileName = file != null ? file.OriginalFileName : null,
                       FileContentType = file != null ? file.ContentType : null,
                       FileSizeInBytes = file != null ? (long?)file.FileSizeInBytes : null,
                       FileWidth = file != null ? file.Width : null,
                       FileHeight = file != null ? file.Height : null,
                       IsEdited = message.IsEdited,
                       IsDeleted = message.IsDeleted,
                       IsRead = message.IsRead,
                       ReadAtUtc = message.ReadAtUtc,
                       IsPinned = message.IsPinned,
                       CreatedAtUtc = message.CreatedAtUtc,
                       EditedAtUtc = message.EditedAtUtc,
                       PinnedAtUtc = message.PinnedAtUtc,
                       ReplyToMessageId = message.ReplyToMessageId,
                       ReplyToContent = repliedMessage != null && !repliedMessage.IsDeleted ? repliedMessage.Content : null,
                       ReplyToIsDeleted = repliedMessage != null && repliedMessage.IsDeleted,
                       ReplyToSenderName = repliedSender != null ? repliedSender.FullName : null,
                       ReplyToFileId = repliedMessage != null ? repliedMessage.FileId : null,
                       ReplyToFileName = repliedFile != null ? repliedFile.OriginalFileName : null,
                       ReplyToFileContentType = repliedFile != null ? repliedFile.ContentType : null,
                       IsForwarded = message.IsForwarded
                   };
        }

        /// <summary>
        /// Batch loads reaction counts, reactions, and mentions for a list of message IDs.
        /// PERFORMANCE FIX: Eliminates N+1 queries by batching all related data loading.
        /// </summary>
        private async Task<(Dictionary<Guid, int> reactionCounts,
                             Dictionary<Guid, List<DirectMessageReactionDto>> reactions,
                             Dictionary<Guid, List<MessageMentionDto>> mentions)>
            LoadRelatedDataAsync(List<Guid> messageIds, CancellationToken cancellationToken)
        {
            // PERFORMANCE FIX: Batch load reaction counts (eliminates N+1 query)
            var reactionCounts = await _context.DirectMessageReactions
                .Where(r => messageIds.Contains(r.MessageId))
                .GroupBy(r => r.MessageId)
                .Select(g => new { MessageId = g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.MessageId, x => x.Count, cancellationToken);

            // Load reactions grouped by message
            var reactions = await _context.DirectMessageReactions
                .Where(r => messageIds.Contains(r.MessageId))
                .GroupBy(r => r.MessageId)
                .Select(g => new
                {
                    MessageId = g.Key,
                    Reactions = g.GroupBy(r => r.Reaction)
                        .Select(rg => new DirectMessageReactionDto(
                            rg.Key,
                            rg.Count(),
                            rg.Select(r => r.UserId).ToList()
                        )).ToList()
                })
                .ToDictionaryAsync(x => x.MessageId, x => x.Reactions, cancellationToken);

            // Load mentions grouped by message
            var mentions = await _context.DirectMessageMentions
                .Where(m => messageIds.Contains(m.MessageId))
                .GroupBy(m => m.MessageId)
                .Select(g => new
                {
                    MessageId = g.Key,
                    Mentions = g.Select(m => new MessageMentionDto(m.MentionedUserId, m.MentionedUserFullName)).ToList()
                })
                .ToDictionaryAsync(x => x.MessageId, x => x.Mentions, cancellationToken);

            return (reactionCounts, reactions, mentions);
        }

        /// <summary>
        /// Maps a RawMessageProjection to a DirectMessageDto.
        /// </summary>
        /// <param name="r">The raw projection from the database query.</param>
        /// <param name="reactionCounts">Batched reaction counts by message ID.</param>
        /// <param name="reactions">Batched reactions by message ID.</param>
        /// <param name="mentions">Batched mentions by message ID.</param>
        /// <param name="sanitizeContent">
        /// When true, deleted message content is replaced with "This message was deleted".
        /// When false (e.g., pinned messages), content is returned as-is.
        /// Reply content is ALWAYS sanitized regardless of this flag.
        /// </param>
        private static DirectMessageDto MapToDto(
            RawMessageProjection r,
            Dictionary<Guid, int> reactionCounts,
            Dictionary<Guid, List<DirectMessageReactionDto>> reactions,
            Dictionary<Guid, List<MessageMentionDto>> mentions,
            bool sanitizeContent = true)
        {
            return new DirectMessageDto(
                r.Id,
                r.ConversationId,
                r.SenderId,
                r.SenderEmail,
                r.SenderFullName,
                FileUrlHelper.ToAvatarUrl(r.AvatarUrl),
                r.ReceiverId,
                sanitizeContent && r.IsDeleted ? "This message was deleted" : r.Content, // SECURITY: Sanitize deleted content when applicable
                r.FileId,
                r.FileName,
                r.FileContentType,
                r.FileSizeInBytes,
                FileUrlHelper.ToServeUrl(r.FileId),      // FileUrl
                r.FileWidth,
                r.FileHeight,
                r.IsEdited,
                r.IsDeleted,
                r.IsRead,
                r.ReadAtUtc,
                r.IsPinned,
                reactionCounts.TryGetValue(r.Id, out var count) ? count : 0, // PERFORMANCE FIX: Use batched count
                r.CreatedAtUtc,
                r.EditedAtUtc,
                r.PinnedAtUtc,
                r.ReplyToMessageId,
                r.ReplyToIsDeleted ? "This message was deleted" : r.ReplyToContent, // SECURITY: Sanitize deleted reply content
                r.ReplyToSenderName,
                r.ReplyToFileId,
                r.ReplyToFileName,
                r.ReplyToFileContentType,
                FileUrlHelper.ToServeUrl(r.ReplyToFileId),      // ReplyToFileUrl
                r.IsForwarded,
                reactions.TryGetValue(r.Id, out var rxns) ? rxns : null,
                mentions.TryGetValue(r.Id, out var mnts) ? mnts : null,
                r.IsRead ? MessageStatus.Read : MessageStatus.Sent // Set Status based on IsRead
            );
        }

        /// <summary>
        /// Convenience method: loads related data for a list of projections, then maps them all to DTOs.
        /// Used by all batch-returning public methods.
        /// </summary>
        private async Task<List<DirectMessageDto>> MapResultsAsync(
            List<RawMessageProjection> results,
            bool sanitizeContent,
            CancellationToken cancellationToken)
        {
            var messageIds = results.Select(r => r.Id).ToList();
            var (reactionCounts, reactions, mentions) = await LoadRelatedDataAsync(messageIds, cancellationToken);

            return results.Select(r => MapToDto(r, reactionCounts, reactions, mentions, sanitizeContent)).ToList();
        }

        #endregion
    }
}
