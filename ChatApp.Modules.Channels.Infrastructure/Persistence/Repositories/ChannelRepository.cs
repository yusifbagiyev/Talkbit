using ChatApp.Modules.Channels.Application.DTOs.Responses;
using ChatApp.Modules.Channels.Application.Interfaces;
using ChatApp.Modules.Channels.Domain.Entities;
using ChatApp.Modules.Channels.Domain.Enums;
using ChatApp.Shared.Kernel.Common;
using Microsoft.EntityFrameworkCore;
using System.Linq.Expressions;

namespace ChatApp.Modules.Channels.Infrastructure.Persistence.Repositories
{
    public class ChannelRepository : IChannelRepository
    {
        private readonly ChannelsDbContext _context;

        public ChannelRepository(ChannelsDbContext context)
        {
            _context = context;
        }

        public async Task<Channel?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
        {
            return await _context.Channels
                .AsNoTracking()
                .FirstOrDefaultAsync(c => c.Id == id, cancellationToken);
        }

        public async Task<Channel?> GetByIdWithMembersAsync(Guid id, CancellationToken cancellationToken = default)
        {
            return await _context.Channels
                .AsNoTracking()
                .Include(c => c.Members)
                .FirstOrDefaultAsync(c => c.Id == id, cancellationToken);
        }

        public async Task<ChannelDetailsDto?> GetChannelDetailsByIdAsync(Guid id, CancellationToken cancellationToken = default)
        {
            // Get channel with creator full name
            var channelWithCreator = await (from channel in _context.Channels
                                            join creator in _context.Set<UserReadModel>() on channel.CreatedBy equals creator.Id
                                            where channel.Id == id
                                            select new
                                            {
                                                channel.Id,
                                                channel.Name,
                                                channel.Description,
                                                channel.Type,
                                                channel.CreatedBy,
                                                CreatorEmail = creator.Email,
                                                channel.CreatedAtUtc
                                            })
                                           .FirstOrDefaultAsync(cancellationToken);

            if (channelWithCreator == null)
                return null;

            // Get members with user details
            var members = await (from member in _context.ChannelMembers
                                 join user in _context.Set<UserReadModel>() on member.UserId equals user.Id
                                 where member.ChannelId == id
                                 orderby member.Role descending, member.JoinedAtUtc
                                 select new ChannelMemberDto(
                                     member.Id,
                                     member.ChannelId,
                                     member.UserId,
                                     user.Email,
                                     user.FullName,
                                     user.AvatarUrl,
                                     member.Role,
                                     member.JoinedAtUtc,
                                     member.LastReadLaterMessageId
                                 ))
                                .ToListAsync(cancellationToken);

            return new ChannelDetailsDto(
                channelWithCreator.Id,
                channelWithCreator.Name,
                channelWithCreator.Description,
                channelWithCreator.Type,
                channelWithCreator.CreatedBy,
                channelWithCreator.CreatorEmail,
                members.Count,
                members,
                channelWithCreator.CreatedAtUtc
            );
        }

        public async Task<Channel?> GetByNameAsync(string name, CancellationToken cancellationToken = default)
        {
            return await _context.Channels
                .FirstOrDefaultAsync(c => c.Name == name, cancellationToken);
        }

        public async Task<Channel?> GetByNameAndCompanyAsync(string name, Guid companyId, CancellationToken cancellationToken = default)
        {
            return await _context.Channels
                .FirstOrDefaultAsync(c => c.Name == name && c.CompanyId == companyId, cancellationToken);
        }

        public async Task<List<ChannelDto>> GetUserChannelsAsync(Guid userId, CancellationToken cancellationToken = default)
        {
            var channels = await _context.Channels
                .Where(c => c.Members.Any(m => m.UserId == userId))
                .OrderByDescending(c => c.CreatedAtUtc)
                .Select(c => new ChannelDto(
                    c.Id, c.Name, c.Description, c.Type, c.CreatedBy,
                    c.Members.Count, c.CreatedAtUtc, c.AvatarUrl))
                .ToListAsync(cancellationToken);

            return channels.Select(c => c with { AvatarUrl = FileUrlHelper.ToAvatarUrl(c.AvatarUrl) }).ToList();
        }

        /// <summary>
        /// OPTIMIZED: Replaced 6 correlated subqueries per channel (O(N²)) with
        /// 7 independent batch queries (O(N)). For 50 channels, this reduces from
        /// ~300 subqueries to 7 queries.
        /// </summary>
        private async Task<List<ChannelDto>> GetUserChannelDtosAsync(Guid userId, CancellationToken cancellationToken = default)
        {
            // ─── Q1: User's channels + membership info ───
            var userChannels = await (
                from channel in _context.Channels
                join member in _context.ChannelMembers on channel.Id equals member.ChannelId
                where member.UserId == userId && !member.IsHidden
                select new
                {
                    channel.Id,
                    channel.Name,
                    channel.Description,
                    channel.Type,
                    channel.CreatedBy,
                    channel.CreatedAtUtc,
                    channel.AvatarUrl,
                    member.LastReadLaterMessageId,
                    member.IsPinned,
                    member.IsMuted,
                    member.IsMarkedReadLater
                }
            ).ToListAsync(cancellationToken);

            if (userChannels.Count == 0)
                return new List<ChannelDto>();

            var channelIds = userChannels.Select(c => c.Id).ToList();

            // ─── Q2: Member counts per channel (batch) ───
            var memberCounts = await _context.ChannelMembers
                .Where(m => channelIds.Contains(m.ChannelId))
                .GroupBy(m => m.ChannelId)
                .Select(g => new { ChannelId = g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.ChannelId, x => x.Count, cancellationToken);

            // ─── Q3: Last message per channel (batch — 2 step: max dates + join back) ───
            var lastMessageDates = await _context.ChannelMessages
                .Where(m => channelIds.Contains(m.ChannelId))
                .GroupBy(m => m.ChannelId)
                .Select(g => new { ChannelId = g.Key, MaxDate = g.Max(m => m.CreatedAtUtc) })
                .ToDictionaryAsync(x => x.ChannelId, x => x.MaxDate, cancellationToken);

            var lastMessages = new Dictionary<Guid, LastMessageProjection>();
            if (lastMessageDates.Count > 0)
            {
                var channelsWithMessages = lastMessageDates.Keys.ToList();
                var allCandidates = await (
                    from msg in _context.ChannelMessages
                    join sender in _context.Set<UserReadModel>() on msg.SenderId equals sender.Id
                    join file in _context.Set<ChatApp.Modules.Files.Domain.Entities.FileMetadata>()
                        on msg.FileId equals file.Id.ToString() into fileGroup
                    from file in fileGroup.DefaultIfEmpty()
                    where channelsWithMessages.Contains(msg.ChannelId)
                    select new LastMessageProjection
                    {
                        ChannelId = msg.ChannelId,
                        Id = msg.Id,
                        Content = msg.Content,
                        IsDeleted = msg.IsDeleted,
                        SenderId = msg.SenderId,
                        AvatarUrl = sender.AvatarUrl,
                        SenderFullName = sender.FirstName + " " + sender.LastName,
                        CreatedAtUtc = msg.CreatedAtUtc,
                        FileId = msg.FileId,
                        FileContentType = file != null ? file.ContentType : null
                    }
                ).ToListAsync(cancellationToken);

                // Keep only the latest message per channel (in-memory filter on small set)
                foreach (var group in allCandidates.GroupBy(m => m.ChannelId))
                {
                    lastMessages[group.Key] = group.OrderByDescending(m => m.CreatedAtUtc).First();
                }
            }

            // ─── Q4: Unread counts per channel (batch — NOT EXISTS pattern) ───
            var unreadCounts = await _context.ChannelMessages
                .Where(m => channelIds.Contains(m.ChannelId) &&
                            !m.IsDeleted &&
                            m.SenderId != userId &&
                            !_context.ChannelMessageReads.Any(r => r.MessageId == m.Id && r.UserId == userId))
                .GroupBy(m => m.ChannelId)
                .Select(g => new { ChannelId = g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.ChannelId, x => x.Count, cancellationToken);

            // ─── Q5: First unread message per channel (batch) ───
            var firstUnreadIds = await _context.ChannelMessages
                .Where(m => channelIds.Contains(m.ChannelId) &&
                            !m.IsDeleted &&
                            m.SenderId != userId &&
                            !_context.ChannelMessageReads.Any(r => r.MessageId == m.Id && r.UserId == userId))
                .GroupBy(m => m.ChannelId)
                .Select(g => new { ChannelId = g.Key, FirstId = g.OrderBy(m => m.CreatedAtUtc).First().Id })
                .ToDictionaryAsync(x => x.ChannelId, x => x.FirstId, cancellationToken);

            // ─── Q6: Read receipts for last messages (status calculation) ───
            var lastMessageIds = lastMessages
                .Where(kvp => kvp.Value.SenderId == userId)
                .Select(kvp => kvp.Value.Id)
                .ToList();

            var messageReadCounts = new Dictionary<Guid, int>();
            if (lastMessageIds.Count > 0)
            {
                messageReadCounts = await (
                    from read in _context.ChannelMessageReads
                    where lastMessageIds.Contains(read.MessageId)
                    group read by read.MessageId into g
                    select new { MessageId = g.Key, ReadCount = g.Count() }
                ).ToDictionaryAsync(x => x.MessageId, x => x.ReadCount, cancellationToken);
            }

            // ─── Q7: Unread mentions per channel (batch — NOT EXISTS pattern) ───
            var unreadMentionChannels = await (
                from mention in _context.ChannelMessageMentions
                join msg in _context.ChannelMessages on mention.MessageId equals msg.Id
                where channelIds.Contains(msg.ChannelId) &&
                      !msg.IsDeleted &&
                      msg.SenderId != userId &&
                      (mention.MentionedUserId == userId || mention.IsAllMention) &&
                      !_context.ChannelMessageReads.Any(r => r.MessageId == msg.Id && r.UserId == userId)
                select msg.ChannelId
            ).Distinct().ToListAsync(cancellationToken);

            var hasUnreadMentions = new HashSet<Guid>(unreadMentionChannels);

            // ─── Map to ChannelDto ───
            var result = userChannels.Select(c =>
            {
                var memberCount = memberCounts.TryGetValue(c.Id, out var mc) ? mc : 0;
                var hasLastMsg = lastMessages.TryGetValue(c.Id, out var lm);

                // Format last message content
                string? lastMsgContent = null;
                if (hasLastMsg)
                {
                    if (lm!.IsDeleted)
                    {
                        lastMsgContent = "This message was deleted";
                    }
                    else if (lm.FileId != null)
                    {
                        var isImage = lm.FileContentType?.StartsWith("image/") == true;
                        var prefix = isImage ? "[Image]" : "[File]";
                        lastMsgContent = string.IsNullOrWhiteSpace(lm.Content) ? prefix : $"{prefix} {lm.Content}";
                    }
                    else
                    {
                        lastMsgContent = lm.Content;
                    }
                }

                // Calculate status for user's own last message
                string? status = null;
                if (hasLastMsg && lm!.SenderId == userId)
                {
                    var readCount = messageReadCounts.GetValueOrDefault(lm.Id, 0);
                    var totalMembers = memberCount - 1;
                    status = totalMembers <= 0 ? "Sent" :
                             readCount >= totalMembers ? "Read" :
                             readCount > 0 ? "Delivered" : "Sent";
                }

                return new ChannelDto(
                    c.Id,
                    c.Name,
                    c.Description,
                    c.Type,
                    c.CreatedBy,
                    memberCount,
                    c.CreatedAtUtc,
                    FileUrlHelper.ToAvatarUrl(c.AvatarUrl),
                    lastMsgContent,
                    hasLastMsg ? lm!.CreatedAtUtc : null,
                    unreadCounts.TryGetValue(c.Id, out var uc) ? uc : 0,
                    hasUnreadMentions.Contains(c.Id),
                    c.LastReadLaterMessageId,
                    hasLastMsg ? lm!.Id : null,
                    hasLastMsg ? lm!.SenderId : null,
                    status,
                    hasLastMsg ? FileUrlHelper.ToAvatarUrl(lm!.AvatarUrl) : null,
                    hasLastMsg ? lm!.SenderFullName : null,
                    firstUnreadIds.TryGetValue(c.Id, out var fui) ? fui : null,
                    c.IsPinned,
                    c.IsMuted,
                    c.IsMarkedReadLater
                );
            }).ToList();

            return result
                .OrderByDescending(c => c.LastMessageAtUtc ?? c.CreatedAtUtc)
                .ToList();
        }

        /// <summary>
        /// Projection for last message per channel — used by GetUserChannelDtosAsync batch loading.
        /// </summary>
        private class LastMessageProjection
        {
            public Guid ChannelId { get; init; }
            public Guid Id { get; init; }
            public string? Content { get; init; }
            public bool IsDeleted { get; init; }
            public Guid SenderId { get; init; }
            public string? AvatarUrl { get; init; }
            public string SenderFullName { get; init; } = null!;
            public DateTime CreatedAtUtc { get; init; }
            public string? FileId { get; init; }
            public string? FileContentType { get; init; }
        }

        public async Task<PagedResult<ChannelDto>> GetUserChannelDtosPagedAsync(
            Guid userId,
            int pageNumber,
            int pageSize,
            CancellationToken cancellationToken = default)
        {
            // Reuse existing method - channels per user are typically few,
            // so in-memory pagination is efficient and avoids duplicating the complex query
            var allChannels = await GetUserChannelDtosAsync(userId, cancellationToken);
            var totalCount = allChannels.Count;
            var items = allChannels
                .Skip((pageNumber - 1) * pageSize)
                .Take(pageSize)
                .ToList();

            return PagedResult<ChannelDto>.Create(items, pageNumber, pageSize, totalCount);
        }

        public async Task<List<ChannelDto>> GetPublicChannelsAsync(
            Guid? callerCompanyId = null, bool isSuperAdmin = false,
            CancellationToken cancellationToken = default)
        {
            var query = _context.Channels.Where(c => c.Type == ChannelType.Public);

            if (!isSuperAdmin && callerCompanyId.HasValue)
                query = query.Where(c => c.CompanyId == callerCompanyId);

            var channels = await query
                .OrderByDescending(c => c.CreatedAtUtc)
                .Select(c => new ChannelDto(
                    c.Id, c.Name, c.Description, c.Type, c.CreatedBy,
                    c.Members.Count, c.CreatedAtUtc, c.AvatarUrl))
                .ToListAsync(cancellationToken);

            return channels.Select(c => c with { AvatarUrl = FileUrlHelper.ToAvatarUrl(c.AvatarUrl) }).ToList();
        }

        public async Task<bool> IsUserMemberAsync(Guid channelId, Guid userId, CancellationToken cancellationToken = default)
        {
            return await _context.ChannelMembers
                .AnyAsync(m => m.ChannelId == channelId && m.UserId == userId, cancellationToken);
        }

        public async Task<List<Guid>> GetMemberUserIdsAsync(Guid channelId, CancellationToken cancellationToken = default)
        {
            return await _context.ChannelMembers
                .Where(m => m.ChannelId == channelId)
                .Select(m => m.UserId)
                .ToListAsync(cancellationToken);
        }

        public async Task<List<SharedChannelDto>> GetSharedChannelsAsync(Guid userId1, Guid userId2, CancellationToken cancellationToken = default)
        {
            // İki istifadəçinin ortaq olduğu kanalları tapır (INTERSECT)
            var channels = await (
                from channel in _context.Channels
                where _context.ChannelMembers.Any(m => m.ChannelId == channel.Id && m.UserId == userId1)
                   && _context.ChannelMembers.Any(m => m.ChannelId == channel.Id && m.UserId == userId2)
                let lastMessage = _context.ChannelMessages
                    .Where(msg => msg.ChannelId == channel.Id)
                    .OrderByDescending(msg => msg.CreatedAtUtc)
                    .Select(msg => (DateTime?)msg.CreatedAtUtc)
                    .FirstOrDefault()
                orderby lastMessage descending
                select new SharedChannelDto(
                    channel.Id,
                    channel.Name,
                    channel.AvatarUrl,
                    channel.Type,
                    lastMessage
                )
            ).ToListAsync(cancellationToken);

            return channels.Select(c => c with { AvatarUrl = FileUrlHelper.ToAvatarUrl(c.AvatarUrl) }).ToList();
        }

        public async Task<bool> ExistsAsync(Expression<Func<Channel, bool>> predicate, CancellationToken cancellationToken = default)
        {
            return await _context.Channels.AnyAsync(predicate, cancellationToken);
        }

        public async Task AddAsync(Channel channel, CancellationToken cancellationToken = default)
        {
            await _context.Channels.AddAsync(channel, cancellationToken);
        }

        public Task UpdateAsync(Channel channel, CancellationToken cancellationToken = default)
        {
            _context.Channels.Update(channel);
            return Task.CompletedTask;
        }

        public Task DeleteAsync(Channel channel, CancellationToken cancellationToken = default)
        {
            _context.Channels.Remove(channel);
            return Task.CompletedTask;
        }
    }
}