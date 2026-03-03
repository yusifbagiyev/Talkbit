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
                                 where member.ChannelId == id && member.IsActive
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
                                     member.IsActive,
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

        public async Task<List<Channel>> GetUserChannelsAsync(Guid userId, CancellationToken cancellationToken = default)
        {
            return await _context.Channels
                .Include(c => c.Members)
                .Where(c => c.Members.Any(m => m.UserId == userId && m.IsActive))
                .OrderByDescending(c => c.CreatedAtUtc)
                .ToListAsync(cancellationToken);
        }

        private async Task<List<ChannelDto>> GetUserChannelDtosAsync(Guid userId, CancellationToken cancellationToken = default)
        {
            // Get channels where user is a member with last message info
            var channelsWithLastMessage = await (
                from channel in _context.Channels
                join member in _context.ChannelMembers on channel.Id equals member.ChannelId
                where member.UserId == userId && member.IsActive && !member.IsHidden
                // Get last message for each channel (LEFT JOIN) - Include deleted messages to show "This message was deleted"
                let lastMessage = (from msg in _context.ChannelMessages
                                   join sender in _context.Set<UserReadModel>() on msg.SenderId equals sender.Id
                                   where msg.ChannelId == channel.Id
                                   join file in _context.Set<ChatApp.Modules.Files.Domain.Entities.FileMetadata>()
                                       on msg.FileId equals file.Id.ToString() into fileGroup
                                   from file in fileGroup.DefaultIfEmpty()
                                   orderby msg.CreatedAtUtc descending
                                   select new
                                   {
                                       msg.Id,
                                       msg.Content,
                                       msg.IsDeleted,
                                       msg.SenderId,
                                       sender.AvatarUrl,
                                       SenderFullName = sender.FirstName + " " + sender.LastName,
                                       msg.CreatedAtUtc,
                                       msg.FileId,
                                       FileContentType = file != null ? file.ContentType : null
                                   }).FirstOrDefault()
                // Get member count
                let memberCount = _context.ChannelMembers.Count(m => m.ChannelId == channel.Id && m.IsActive)
                // Get unread count (messages after user's last read)
                let lastReadTime = (from read in _context.ChannelMessageReads
                                    join msg in _context.ChannelMessages on read.MessageId equals msg.Id
                                    where read.UserId == userId && msg.ChannelId == channel.Id
                                    orderby read.ReadAtUtc descending
                                    select (DateTime?)read.ReadAtUtc).FirstOrDefault()
                let unreadCount = _context.ChannelMessages.Count(m =>
                    m.ChannelId == channel.Id &&
                    !m.IsDeleted &&
                    m.SenderId != userId &&
                    (lastReadTime == null || m.CreatedAtUtc > lastReadTime.Value))
                // Get first unread message ID
                let firstUnreadMessage = _context.ChannelMessages
                    .Where(m =>
                        m.ChannelId == channel.Id &&
                        !m.IsDeleted &&
                        m.SenderId != userId &&
                        (lastReadTime == null || m.CreatedAtUtc > lastReadTime.Value))
                    .OrderBy(m => m.CreatedAtUtc)
                    .FirstOrDefault()
                select new
                {
                    channel.Id,
                    channel.Name,
                    channel.Description,
                    channel.Type,
                    channel.CreatedBy,
                    MemberCount = memberCount,
                    channel.CreatedAtUtc,
                    channel.AvatarUrl,
                    LastMessageContent = lastMessage == null ? null :
                        lastMessage.IsDeleted ? "This message was deleted" :
                        lastMessage.FileId != null ?
                            (lastMessage.FileContentType != null && lastMessage.FileContentType.StartsWith("image/") ?
                                (string.IsNullOrWhiteSpace(lastMessage.Content) ? "[Image]" : "[Image] " + lastMessage.Content) :
                                (string.IsNullOrWhiteSpace(lastMessage.Content) ? "[File]" : "[File] " + lastMessage.Content)) :
                        lastMessage.Content,
                    LastMessageAtUtc = lastMessage != null ? lastMessage.CreatedAtUtc : (DateTime?)null,
                    LastMessageId = lastMessage != null ? (Guid?)lastMessage.Id : null,
                    LastMessageSenderId = lastMessage != null ? (Guid?)lastMessage.SenderId : null,
                    LastMessageSenderAvatarUrl = lastMessage != null ? lastMessage.AvatarUrl : null,
                    LastMessageSenderFullName = lastMessage != null ? lastMessage.SenderFullName : null,
                    UnreadCount = unreadCount,
                    FirstUnreadMessageId = firstUnreadMessage != null ? (Guid?)firstUnreadMessage.Id : null,
                    member.LastReadLaterMessageId,
                    member.IsPinned,
                    member.IsMuted,
                    member.IsMarkedReadLater
                }
            ).ToListAsync(cancellationToken);

            // Batch query: Get read receipts for all last messages to calculate status
            var lastMessageIds = channelsWithLastMessage
                .Where(c => c.LastMessageId.HasValue && c.LastMessageSenderId == userId)
                .Select(c => c.LastMessageId!.Value)
                .ToList();

            var messageReadCounts = new Dictionary<Guid, int>();
            if (lastMessageIds.Any())
            {
                // Get how many members read each last message (for user's own messages only)
                messageReadCounts = await (
                    from read in _context.ChannelMessageReads
                    where lastMessageIds.Contains(read.MessageId)
                    group read by read.MessageId into g
                    select new { MessageId = g.Key, ReadCount = g.Count() }
                ).ToDictionaryAsync(x => x.MessageId, x => x.ReadCount, cancellationToken);
            }

            // Batch query: Get channels with unread mentions
            var hasUnreadMentionsDictionary = new Dictionary<Guid, bool>();
            var channelIds = channelsWithLastMessage.Select(c => c.Id).ToList();

            if (channelIds.Any())
            {
                var channelsWithMentions = await (
                    from mention in _context.ChannelMessageMentions
                    join msg in _context.ChannelMessages on mention.MessageId equals msg.Id
                    join member in _context.ChannelMembers on msg.ChannelId equals member.ChannelId
                    where channelIds.Contains(msg.ChannelId) &&
                          member.UserId == userId &&
                          member.IsActive &&
                          !msg.IsDeleted &&
                          msg.SenderId != userId &&
                          (mention.MentionedUserId == userId || mention.IsAllMention)
                    let lastReadTime = (from read in _context.ChannelMessageReads
                                        join readMsg in _context.ChannelMessages on read.MessageId equals readMsg.Id
                                        where read.UserId == userId && readMsg.ChannelId == msg.ChannelId
                                        orderby read.ReadAtUtc descending
                                        select (DateTime?)read.ReadAtUtc).FirstOrDefault()
                    where lastReadTime == null || msg.CreatedAtUtc > lastReadTime.Value
                    select msg.ChannelId
                ).Distinct().ToListAsync(cancellationToken);

                foreach (var channelId in channelsWithMentions)
                {
                    hasUnreadMentionsDictionary[channelId] = true;
                }
            }

            // Map to ChannelDto with calculated status
            var result = channelsWithLastMessage.Select(c =>
            {
                string? status = null;
                if (c.LastMessageSenderId == userId && c.LastMessageId.HasValue)
                {
                    // Calculate status for user's own messages
                    var readCount = messageReadCounts.GetValueOrDefault(c.LastMessageId.Value, 0);
                    var totalMembers = c.MemberCount - 1; // Exclude sender

                    if (totalMembers == 0)
                    {
                        // No other members - just "Sent"
                        status = "Sent";
                    }
                    else if (readCount >= totalMembers)
                    {
                        // All members read
                        status = "Read";
                    }
                    else if (readCount > 0)
                    {
                        // Some members read
                        status = "Delivered";
                    }
                    else
                    {
                        // No one read yet
                        status = "Sent";
                    }
                }

                return new ChannelDto(
                    c.Id,
                    c.Name,
                    c.Description,
                    c.Type,
                    c.CreatedBy,
                    c.MemberCount,
                    c.CreatedAtUtc,
                    c.AvatarUrl,
                    c.LastMessageContent,
                    c.LastMessageAtUtc,
                    c.UnreadCount,
                    hasUnreadMentionsDictionary.ContainsKey(c.Id) && hasUnreadMentionsDictionary[c.Id],
                    c.LastReadLaterMessageId,
                    c.LastMessageId,
                    c.LastMessageSenderId,
                    status,
                    c.LastMessageSenderAvatarUrl,
                    c.LastMessageSenderFullName,
                    c.FirstUnreadMessageId,
                    c.IsPinned,
                    c.IsMuted,
                    c.IsMarkedReadLater
                );
            }).ToList();

            return result
                .OrderByDescending(c => c.LastMessageAtUtc ?? c.CreatedAtUtc)
                .ToList();
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

        public async Task<List<Channel>> GetPublicChannelsAsync(CancellationToken cancellationToken = default)
        {
            return await _context.Channels
                .Include(c => c.Members)
                .Where(c => c.Type == ChannelType.Public)
                .OrderByDescending(c => c.CreatedAtUtc)
                .ToListAsync(cancellationToken);
        }

        public async Task<bool> IsUserMemberAsync(Guid channelId, Guid userId, CancellationToken cancellationToken = default)
        {
            return await _context.ChannelMembers
                .AnyAsync(m => m.ChannelId == channelId && m.UserId == userId && m.IsActive, cancellationToken);
        }

        public async Task<List<Guid>> GetMemberUserIdsAsync(Guid channelId, CancellationToken cancellationToken = default)
        {
            return await _context.ChannelMembers
                .Where(m => m.ChannelId == channelId && m.IsActive)
                .Select(m => m.UserId)
                .ToListAsync(cancellationToken);
        }

        public async Task<List<SharedChannelDto>> GetSharedChannelsAsync(Guid userId1, Guid userId2, CancellationToken cancellationToken = default)
        {
            // İki istifadəçinin ortaq olduğu kanalları tapır (INTERSECT)
            return await (
                from channel in _context.Channels
                where _context.ChannelMembers.Any(m => m.ChannelId == channel.Id && m.UserId == userId1 && m.IsActive)
                   && _context.ChannelMembers.Any(m => m.ChannelId == channel.Id && m.UserId == userId2 && m.IsActive)
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