using ChatApp.Modules.Channels.Application.DTOs.Responses;
using ChatApp.Modules.Channels.Application.Interfaces;
using ChatApp.Modules.Channels.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using ChatApp.Shared.Kernel;
using ChatApp.Shared.Kernel.Common;

namespace ChatApp.Modules.Channels.Infrastructure.Persistence.Repositories
{
    public class ChannelMessageRepository : IChannelMessageRepository
    {
        private readonly ChannelsDbContext _context;

        public ChannelMessageRepository(ChannelsDbContext context)
        {
            _context = context;
        }

        public async Task<ChannelMessage?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
        {
            return await _context.ChannelMessages
                .FirstOrDefaultAsync(m => m.Id == id, cancellationToken);
        }

        public async Task<List<ChannelMessage>> GetByIdsAsync(List<Guid> ids, CancellationToken cancellationToken = default)
        {
            return await _context.ChannelMessages
                .Where(m => ids.Contains(m.Id))
                .ToListAsync(cancellationToken);
        }

        public async Task<ChannelMessage?> GetByIdWithReactionsAsync(Guid id, CancellationToken cancellationToken = default)
        {
            return await _context.ChannelMessages
                .Include(m => m.Reactions)
                .FirstOrDefaultAsync(m => m.Id == id, cancellationToken);
        }

        public async Task<ChannelMessageDto?> GetByIdAsDtoAsync(Guid id, CancellationToken cancellationToken = default)
        {
            var result = await (from message in _context.ChannelMessages
                        join user in _context.Set<UserReadModel>() on message.SenderId equals user.Id
                        join repliedMessage in _context.ChannelMessages on message.ReplyToMessageId equals repliedMessage.Id into replyJoin
                        from repliedMessage in replyJoin.DefaultIfEmpty()
                        join repliedSender in _context.Set<UserReadModel>() on repliedMessage.SenderId equals repliedSender.Id into repliedSenderJoin
                        from repliedSender in repliedSenderJoin.DefaultIfEmpty()
                        join file in _context.Set<ChatApp.Modules.Files.Domain.Entities.FileMetadata>() on message.FileId equals file.Id.ToString() into fileJoin
                        from file in fileJoin.DefaultIfEmpty()
                        join repliedFile in _context.Set<ChatApp.Modules.Files.Domain.Entities.FileMetadata>() on repliedMessage.FileId equals repliedFile.Id.ToString() into repliedFileJoin
                        from repliedFile in repliedFileJoin.DefaultIfEmpty()
                        where message.Id == id
                        select new
                        {
                            message.Id,
                            message.ChannelId,
                            message.SenderId,
                            user.Email,
                            user.FullName,
                            user.AvatarUrl,
                            message.Content,
                            message.FileId,
                            FileName = file != null ? file.OriginalFileName : null,
                            FileContentType = file != null ? file.ContentType : null,
                            FileSizeInBytes = file != null ? (long?)file.FileSizeInBytes : null,
                            FileStoragePath = file != null ? file.StoragePath : null,
                            FileWidth = file != null ? file.Width : (int?)null,
                            FileHeight = file != null ? file.Height : (int?)null,
                            message.IsEdited,
                            message.IsDeleted,
                            message.IsPinned,
                            message.CreatedAtUtc,
                            message.EditedAtUtc,
                            message.PinnedAtUtc,
                            message.ReplyToMessageId,
                            ReplyToContent = repliedMessage != null && !repliedMessage.IsDeleted ? repliedMessage.Content : null,
                            ReplyToIsDeleted = repliedMessage != null && repliedMessage.IsDeleted,
                            ReplyToSenderName = repliedSender != null ? repliedSender.FullName : null,
                            ReplyToFileId = repliedMessage != null ? repliedMessage.FileId : null,
                            ReplyToFileName = repliedFile != null ? repliedFile.OriginalFileName : null,
                            ReplyToFileContentType = repliedFile != null ? repliedFile.ContentType : null,
                            ReplyToFileStoragePath = repliedFile != null ? repliedFile.StoragePath : null,
                            message.IsForwarded,
                            ReadByCount = _context.ChannelMessageReads.Count(r =>
                                r.MessageId == message.Id &&
                                r.UserId != message.SenderId),
                            TotalMemberCount = _context.ChannelMembers.Count(m =>
                                m.ChannelId == message.ChannelId &&
                                m.UserId != message.SenderId),
                            ReadBy = _context.ChannelMessageReads
                                .Where(r => r.MessageId == message.Id && r.UserId != message.SenderId)
                                .Select(r => r.UserId)
                                .ToList()
                        }).FirstOrDefaultAsync(cancellationToken);

            if (result == null)
                return null;

            // Load mentions for this message
            var mentions = await _context.ChannelMessageMentions
                .Where(m => m.MessageId == id)
                .Select(m => new ChannelMessageMentionDto(m.MentionedUserId, m.MentionedUserFullName, m.IsAllMention))
                .ToListAsync(cancellationToken);

            // Load reactions for this message
            var reactions = await (from reaction in _context.ChannelMessageReactions
                                  join reactionUser in _context.Set<UserReadModel>() on reaction.UserId equals reactionUser.Id
                                  where reaction.MessageId == id
                                  group new { reaction, reactionUser } by reaction.Reaction into g
                                  select new ChannelMessageReactionDto(
                                      g.Key,
                                      g.Count(),
                                      g.Select(x => x.reaction.UserId).ToList(),
                                      g.Select(x => x.reactionUser.FullName).ToList(),
                                      g.Select(x => x.reactionUser.AvatarUrl).ToList()
                                  )).ToListAsync(cancellationToken);

            // Calculate Status based on ReadByCount and TotalMemberCount
            var status = CalculateStatus(result.ReadByCount, result.TotalMemberCount);

            return new ChannelMessageDto(
                result.Id,
                result.ChannelId,
                result.SenderId,
                result.Email,
                result.FullName,
                result.AvatarUrl,
                result.IsDeleted ? "This message was deleted" : result.Content, // SECURITY: Sanitize deleted content
                result.FileId,
                result.FileName,
                result.FileContentType,
                result.FileSizeInBytes,
                FileUrlHelper.ToUrl(result.FileStoragePath),      // FileUrl
                result.FileWidth,
                result.FileHeight,
                result.IsEdited,
                result.IsDeleted,
                result.IsPinned,
                reactions.Sum(r => r.Count), // ReactionCount from loaded reactions
                result.CreatedAtUtc,
                result.EditedAtUtc,
                result.PinnedAtUtc,
                result.ReplyToMessageId,
                result.ReplyToIsDeleted ? "This message was deleted" : result.ReplyToContent, // SECURITY: Sanitize deleted reply content
                result.ReplyToSenderName,
                result.ReplyToFileId,
                result.ReplyToFileName,
                result.ReplyToFileContentType,
                FileUrlHelper.ToUrl(result.ReplyToFileStoragePath),      // ReplyToFileUrl
                result.IsForwarded,
                result.ReadByCount,
                result.TotalMemberCount,
                result.ReadBy,
                reactions.Count > 0 ? reactions : null,
                mentions.Count > 0 ? mentions : null,
                status
            );
        }

        public async Task<List<ChannelMessageDto>> GetChannelMessagesAsync(
            Guid channelId,
            int pageSize = 30,
            DateTime? beforeUtc = null,
            DateTime? visibleFromUtc = null,
            CancellationToken cancellationToken = default)
        {
            var query = BuildBaseQuery()
                .Where(r => r.ChannelId == channelId); // Removed IsDeleted filter - show deleted messages as "This message was deleted"

            if (visibleFromUtc.HasValue)
            {
                query = query.Where(m => m.CreatedAtUtc >= visibleFromUtc.Value);
            }

            if (beforeUtc.HasValue)
            {
                query = query.Where(m => m.CreatedAtUtc < beforeUtc.Value);
            }

            var results = await query
                .OrderByDescending(m => m.CreatedAtUtc)
                .Take(pageSize)
                .ToListAsync(cancellationToken);

            return await MapResultsAsync(results, channelId, sanitizeContent: true, cancellationToken);
        }

        public async Task<List<ChannelMessageDto>> GetMessagesAroundAsync(
            Guid channelId,
            Guid messageId,
            int count = 50,
            DateTime? visibleFromUtc = null,
            CancellationToken cancellationToken = default)
        {
            // 1. Hədəf mesajın tarixini tap
            var targetMessage = await _context.ChannelMessages
                .Where(m => m.Id == messageId && m.ChannelId == channelId)
                .Select(m => new { m.CreatedAtUtc })
                .FirstOrDefaultAsync(cancellationToken);

            if (targetMessage == null)
                return new List<ChannelMessageDto>();

            var targetDate = targetMessage.CreatedAtUtc;
            var halfCount = count / 2;

            // 2. Base query (projection) + visibility filter
            var baseQuery = BuildBaseQuery()
                .Where(r => r.ChannelId == channelId);

            if (visibleFromUtc.HasValue)
            {
                baseQuery = baseQuery.Where(m => m.CreatedAtUtc >= visibleFromUtc.Value);
            }

            // 3. Hədəf mesajdan ƏVVƏL olan mesajlar (hədəf daxil)
            var beforeMessages = await baseQuery
                .Where(m => m.CreatedAtUtc <= targetDate)
                .OrderByDescending(m => m.CreatedAtUtc)
                .Take(halfCount + 1) // +1 hədəf mesajın özü üçün
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

            return await MapResultsAsync(results, channelId, sanitizeContent: true, cancellationToken);
        }

        public async Task<List<ChannelMessageDto>> GetMessagesBeforeDateAsync(
            Guid channelId,
            DateTime beforeUtc,
            int limit = 100,
            DateTime? visibleFromUtc = null,
            CancellationToken cancellationToken = default)
        {
            var query = BuildBaseQuery()
                .Where(r => r.ChannelId == channelId
                         && r.CreatedAtUtc < beforeUtc);

            if (visibleFromUtc.HasValue)
            {
                query = query.Where(m => m.CreatedAtUtc >= visibleFromUtc.Value);
            }

            var results = await query
                .OrderByDescending(m => m.CreatedAtUtc)
                .Take(limit)
                .ToListAsync(cancellationToken);

            return await MapResultsAsync(results, channelId, sanitizeContent: true, cancellationToken);
        }

        public async Task<List<ChannelMessageDto>> GetMessagesAfterDateAsync(
            Guid channelId,
            DateTime afterUtc,
            int limit = 100,
            DateTime? visibleFromUtc = null,
            CancellationToken cancellationToken = default)
        {
            var query = BuildBaseQuery()
                .Where(r => r.ChannelId == channelId
                         && r.CreatedAtUtc > afterUtc);

            if (visibleFromUtc.HasValue)
            {
                query = query.Where(m => m.CreatedAtUtc >= visibleFromUtc.Value);
            }

            var results = await query
                .OrderBy(m => m.CreatedAtUtc)
                .Take(limit)
                .ToListAsync(cancellationToken);

            return await MapResultsAsync(results, channelId, sanitizeContent: true, cancellationToken);
        }

        public async Task<List<ChannelMessageDto>> GetPinnedMessagesAsync(Guid channelId, CancellationToken cancellationToken = default)
        {
            var results = await BuildBaseQuery()
                .Where(r => r.ChannelId == channelId
                         && r.IsPinned
                         && !r.IsDeleted)
                .OrderBy(r => r.PinnedAtUtc)
                .ToListAsync(cancellationToken);

            if (results.Count == 0)
                return new List<ChannelMessageDto>();

            return await MapResultsAsync(results, channelId, sanitizeContent: false, cancellationToken);
        }


        /// <summary>
        /// Channel-dakı fayl olan mesajları pagination ilə qaytarır (Files & Media panel üçün)
        /// </summary>
        public async Task<List<ChannelMessageDto>> GetChannelFilesAsync(
            Guid channelId,
            int pageSize = 30,
            DateTime? beforeUtc = null,
            bool? isMedia = null,
            DateTime? visibleFromUtc = null,
            CancellationToken cancellationToken = default)
        {
            var query = BuildBaseQuery()
                .Where(r => r.ChannelId == channelId
                         && r.FileId != null
                         && !r.IsDeleted);

            // Media/file filterləmə
            if (isMedia == true)
                query = query.Where(r => r.FileContentType != null && r.FileContentType.StartsWith("image/"));
            else if (isMedia == false)
                query = query.Where(r => r.FileContentType == null || !r.FileContentType.StartsWith("image/"));

            // Tarix görünürlüyü (private channel-da üzv olma tarixindən sonrakı mesajlar)
            if (visibleFromUtc.HasValue)
                query = query.Where(r => r.CreatedAtUtc >= visibleFromUtc.Value);

            if (beforeUtc.HasValue)
                query = query.Where(r => r.CreatedAtUtc < beforeUtc.Value);

            var results = await query
                .OrderByDescending(r => r.CreatedAtUtc)
                .Take(pageSize)
                .ToListAsync(cancellationToken);

            if (results.Count == 0)
                return new List<ChannelMessageDto>();

            return await MapResultsAsync(results, channelId, sanitizeContent: false, cancellationToken);
        }


        public async Task<int> GetUnreadCountAsync(Guid channelId, Guid userId, CancellationToken cancellationToken = default)
        {
            // Verify user is a member of the channel
            var member = await _context.ChannelMembers
                .Where(m => m.ChannelId == channelId && m.UserId == userId)
                .FirstOrDefaultAsync(cancellationToken);

            if (member == null)
                return 0;

            // Count messages in the channel that:
            // 1. Are not deleted
            // 2. Were not sent by the user
            // 3. Don't have a corresponding ChannelMessageRead record for this user
            return await _context.ChannelMessages
                .Where(m => m.ChannelId == channelId
                         && !m.IsDeleted
                         && m.SenderId != userId
                         && !_context.ChannelMessageReads.Any(r => r.MessageId == m.Id && r.UserId == userId))
                .CountAsync(cancellationToken);
        }

        public async Task<int> MarkAllAsReadAsync(Guid channelId, Guid userId, CancellationToken cancellationToken = default)
        {
            // Get all unread message IDs in the channel (excluding user's own messages)
            var unreadMessageIds = await _context.ChannelMessages
                .Where(m => m.ChannelId == channelId
                         && !m.IsDeleted
                         && m.SenderId != userId
                         && !_context.ChannelMessageReads.Any(r => r.MessageId == m.Id && r.UserId == userId))
                .Select(m => m.Id)
                .ToListAsync(cancellationToken);

            if (!unreadMessageIds.Any())
                return 0;

            // Bulk insert read records for all unread messages
            var readRecords = unreadMessageIds.Select(msgId => new ChannelMessageRead(msgId, userId)).ToList();

            await _context.ChannelMessageReads.AddRangeAsync(readRecords, cancellationToken);
            await _context.SaveChangesAsync(cancellationToken);

            return readRecords.Count;
        }

        public async Task<bool> HasMessagesAsync(Guid channelId, CancellationToken cancellationToken = default)
        {
            return await _context.ChannelMessages
                .AnyAsync(m => m.ChannelId == channelId, cancellationToken);
        }

        public async Task AddAsync(ChannelMessage message, CancellationToken cancellationToken = default)
        {
            await _context.ChannelMessages.AddAsync(message, cancellationToken);
        }

        public Task UpdateAsync(ChannelMessage message, CancellationToken cancellationToken = default)
        {
            _context.ChannelMessages.Update(message);
            return Task.CompletedTask;
        }

        public Task DeleteAsync(ChannelMessage message, CancellationToken cancellationToken = default)
        {
            _context.ChannelMessages.Remove(message);
            return Task.CompletedTask;
        }

        #region Private Helper Methods

        /// <summary>
        /// Strongly-typed projection class used by all list-returning query methods.
        /// Uses object initializer syntax (not constructor) so EF Core can translate
        /// .Where() and .OrderBy() on properties after .Select().
        /// </summary>
        private class RawChannelMessageProjection
        {
            public Guid Id { get; init; }
            public Guid ChannelId { get; init; }
            public Guid SenderId { get; init; }
            public string Email { get; init; } = null!;
            public string FullName { get; init; } = null!;
            public string? AvatarUrl { get; init; }
            public string Content { get; init; } = null!;
            public string? FileId { get; init; }
            public string? FileName { get; init; }
            public string? FileContentType { get; init; }
            public long? FileSizeInBytes { get; init; }
            public string? FileStoragePath { get; init; }
            public int? FileWidth { get; init; }
            public int? FileHeight { get; init; }
            public bool IsEdited { get; init; }
            public bool IsDeleted { get; init; }
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
            public string? ReplyToFileStoragePath { get; init; }
            public bool IsForwarded { get; init; }
        }

        /// <summary>
        /// Builds the base LINQ query with all necessary joins (sender, file, reply, reply sender, reply file).
        /// ReadBy and Reactions are loaded in batch by LoadRelatedDataAsync (not inline — avoids N+1).
        /// Each public method calls this then adds its specific .Where(), .OrderBy(), .Take().
        /// </summary>
        private IQueryable<RawChannelMessageProjection> BuildBaseQuery()
        {
            return from message in _context.ChannelMessages
                   join user in _context.Set<UserReadModel>() on message.SenderId equals user.Id
                   join repliedMessage in _context.ChannelMessages on message.ReplyToMessageId equals repliedMessage.Id into replyJoin
                   from repliedMessage in replyJoin.DefaultIfEmpty()
                   join repliedSender in _context.Set<UserReadModel>() on repliedMessage.SenderId equals repliedSender.Id into repliedSenderJoin
                   from repliedSender in repliedSenderJoin.DefaultIfEmpty()
                   join file in _context.Set<ChatApp.Modules.Files.Domain.Entities.FileMetadata>() on message.FileId equals file.Id.ToString() into fileJoin
                   from file in fileJoin.DefaultIfEmpty()
                   join repliedFile in _context.Set<ChatApp.Modules.Files.Domain.Entities.FileMetadata>() on repliedMessage.FileId equals repliedFile.Id.ToString() into repliedFileJoin
                   from repliedFile in repliedFileJoin.DefaultIfEmpty()
                   select new RawChannelMessageProjection
                   {
                       Id = message.Id,
                       ChannelId = message.ChannelId,
                       SenderId = message.SenderId,
                       Email = user.Email,
                       FullName = user.FullName,
                       AvatarUrl = user.AvatarUrl,
                       Content = message.Content,
                       FileId = message.FileId,
                       FileName = file != null ? file.OriginalFileName : null,
                       FileContentType = file != null ? file.ContentType : null,
                       FileSizeInBytes = file != null ? (long?)file.FileSizeInBytes : null,
                       FileStoragePath = file != null ? file.StoragePath : null,
                       FileWidth = file != null ? file.Width : null,
                       FileHeight = file != null ? file.Height : null,
                       IsEdited = message.IsEdited,
                       IsDeleted = message.IsDeleted,
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
                       ReplyToFileStoragePath = repliedFile != null ? repliedFile.StoragePath : null,
                       IsForwarded = message.IsForwarded
                   };
        }

        /// <summary>
        /// Batch loads reaction counts, read counts, and mentions for a list of message IDs.
        /// PERFORMANCE FIX: Eliminates N+1 queries by batching all related data loading.
        /// </summary>
        private async Task<(Dictionary<Guid, int> reactionCounts,
                             Dictionary<Guid, int> readCounts,
                             Dictionary<Guid, List<ChannelMessageMentionDto>> mentions,
                             Dictionary<Guid, List<Guid>> readByUsers,
                             Dictionary<Guid, List<ChannelMessageReactionDto>> reactions)>
            LoadRelatedDataAsync(List<Guid> messageIds, CancellationToken cancellationToken)
        {
            // Get sender IDs for excluding from read lists
            var senderMap = await _context.ChannelMessages
                .Where(m => messageIds.Contains(m.Id))
                .Select(m => new { m.Id, m.SenderId })
                .ToDictionaryAsync(x => x.Id, x => x.SenderId, cancellationToken);

            // Batch load all read records (single query for counts + user lists)
            var allReads = await _context.ChannelMessageReads
                .Where(r => messageIds.Contains(r.MessageId))
                .Select(r => new { r.MessageId, r.UserId })
                .ToListAsync(cancellationToken);

            // Filter out sender reads and build both dictionaries from single query result
            var readCounts = new Dictionary<Guid, int>();
            var readByUsers = new Dictionary<Guid, List<Guid>>();
            foreach (var group in allReads.GroupBy(r => r.MessageId))
            {
                var senderId = senderMap.TryGetValue(group.Key, out var sid) ? sid : Guid.Empty;
                var nonSenderReads = group.Where(r => r.UserId != senderId).Select(r => r.UserId).ToList();
                readCounts[group.Key] = nonSenderReads.Count;
                readByUsers[group.Key] = nonSenderReads;
            }

            // Batch load all reactions with user details (single query)
            var allReactions = await (from reaction in _context.ChannelMessageReactions
                                     join reactionUser in _context.Set<UserReadModel>() on reaction.UserId equals reactionUser.Id
                                     where messageIds.Contains(reaction.MessageId)
                                     select new
                                     {
                                         reaction.MessageId,
                                         reaction.Reaction,
                                         reaction.UserId,
                                         reactionUser.FullName,
                                         reactionUser.AvatarUrl
                                     }).ToListAsync(cancellationToken);

            // Build reaction counts + full reaction DTOs from single query result
            var reactionCounts = new Dictionary<Guid, int>();
            var reactions = new Dictionary<Guid, List<ChannelMessageReactionDto>>();
            foreach (var msgGroup in allReactions.GroupBy(r => r.MessageId))
            {
                reactionCounts[msgGroup.Key] = msgGroup.Count();
                reactions[msgGroup.Key] = msgGroup
                    .GroupBy(r => r.Reaction)
                    .Select(g => new ChannelMessageReactionDto(
                        g.Key,
                        g.Count(),
                        g.Select(x => x.UserId).ToList(),
                        g.Select(x => x.FullName).ToList(),
                        g.Select(x => (string?)x.AvatarUrl).ToList()
                    )).ToList();
            }

            // Load mentions grouped by message
            var mentions = await _context.ChannelMessageMentions
                .Where(m => messageIds.Contains(m.MessageId))
                .GroupBy(m => m.MessageId)
                .Select(g => new
                {
                    MessageId = g.Key,
                    Mentions = g.Select(m => new ChannelMessageMentionDto(m.MentionedUserId, m.MentionedUserFullName, m.IsAllMention)).ToList()
                })
                .ToDictionaryAsync(x => x.MessageId, x => x.Mentions, cancellationToken);

            return (reactionCounts, readCounts, mentions, readByUsers, reactions);
        }

        /// <summary>
        /// Calculates message status based on read receipts.
        /// Read = everyone read, Delivered = at least one person read, Sent = no one read yet.
        /// </summary>
        private static MessageStatus CalculateStatus(int readByCount, int totalMemberCount)
        {
            if (totalMemberCount == 0)
                return MessageStatus.Sent;
            if (readByCount >= totalMemberCount)
                return MessageStatus.Read;
            if (readByCount > 0)
                return MessageStatus.Delivered;
            return MessageStatus.Sent;
        }

        /// <summary>
        /// Maps a RawChannelMessageProjection to a ChannelMessageDto.
        /// </summary>
        /// <param name="r">The raw projection from the database query.</param>
        /// <param name="reactionCounts">Batched reaction counts by message ID.</param>
        /// <param name="readCounts">Batched read counts by message ID.</param>
        /// <param name="mentions">Batched mentions by message ID.</param>
        /// <param name="totalMemberCount">Total active member count for the channel (excluding sender).</param>
        /// <param name="sanitizeContent">
        /// When true, deleted message content is replaced with "This message was deleted".
        /// When false (e.g., pinned messages), content is returned as-is.
        /// Reply content is ALWAYS sanitized regardless of this flag.
        /// </param>
        private static ChannelMessageDto MapToDto(
            RawChannelMessageProjection r,
            Dictionary<Guid, int> reactionCounts,
            Dictionary<Guid, int> readCounts,
            Dictionary<Guid, List<ChannelMessageMentionDto>> mentions,
            Dictionary<Guid, List<Guid>> readByUsers,
            Dictionary<Guid, List<ChannelMessageReactionDto>> reactions,
            int totalMemberCount,
            bool sanitizeContent)
        {
            var readByCount = readCounts.TryGetValue(r.Id, out var rbc) ? rbc : 0;
            var reactionCount = reactionCounts.TryGetValue(r.Id, out var rc) ? rc : 0;
            var status = CalculateStatus(readByCount, totalMemberCount);

            return new ChannelMessageDto(
                r.Id,
                r.ChannelId,
                r.SenderId,
                r.Email,
                r.FullName,
                r.AvatarUrl,
                sanitizeContent && r.IsDeleted ? "This message was deleted" : r.Content,
                r.FileId,
                r.FileName,
                r.FileContentType,
                r.FileSizeInBytes,
                FileUrlHelper.ToUrl(r.FileStoragePath),
                r.FileWidth,
                r.FileHeight,
                r.IsEdited,
                r.IsDeleted,
                r.IsPinned,
                reactionCount,
                r.CreatedAtUtc,
                r.EditedAtUtc,
                r.PinnedAtUtc,
                r.ReplyToMessageId,
                r.ReplyToIsDeleted ? "This message was deleted" : r.ReplyToContent,
                r.ReplyToSenderName,
                r.ReplyToFileId,
                r.ReplyToFileName,
                r.ReplyToFileContentType,
                FileUrlHelper.ToUrl(r.ReplyToFileStoragePath),
                r.IsForwarded,
                readByCount,
                totalMemberCount,
                readByUsers.TryGetValue(r.Id, out var readBy) ? readBy : null,
                reactions.TryGetValue(r.Id, out var rxns) ? rxns : null,
                mentions.TryGetValue(r.Id, out var mnts) ? mnts : null,
                status
            );
        }

        /// <summary>
        /// Convenience method: loads related data for a list of projections, then maps them all to DTOs.
        /// Used by all batch-returning public methods.
        /// </summary>
        private async Task<List<ChannelMessageDto>> MapResultsAsync(
            List<RawChannelMessageProjection> results,
            Guid channelId,
            bool sanitizeContent,
            CancellationToken cancellationToken)
        {
            var messageIds = results.Select(r => r.Id).ToList();
            var (reactionCounts, readCounts, mentions, readByUsers, reactions) = await LoadRelatedDataAsync(messageIds, cancellationToken);

            // TotalMemberCount is same for all messages in channel (count once, not N times)
            var totalMemberCount = await _context.ChannelMembers
                .Where(m => m.ChannelId == channelId)
                .CountAsync(cancellationToken) - 1; // Exclude sender

            return results.Select(r => MapToDto(r, reactionCounts, readCounts, mentions, readByUsers, reactions, totalMemberCount, sanitizeContent)).ToList();
        }

        #endregion

    }
}
