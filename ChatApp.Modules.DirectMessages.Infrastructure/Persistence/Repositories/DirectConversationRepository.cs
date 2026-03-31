using ChatApp.Modules.DirectMessages.Application.DTOs.Request;
using ChatApp.Modules.DirectMessages.Application.DTOs.Response;
using ChatApp.Modules.DirectMessages.Application.Interfaces;
using ChatApp.Modules.DirectMessages.Domain.Entities;
using ChatApp.Modules.Files.Domain.Entities;
using ChatApp.Shared.Kernel.Common;
using Microsoft.EntityFrameworkCore;

namespace ChatApp.Modules.DirectMessages.Infrastructure.Persistence.Repositories
{
    public class DirectConversationRepository(DirectMessagesDbContext context) : IDirectConversationRepository
    {
        private readonly DirectMessagesDbContext _context = context;

        public async Task AddAsync(DirectConversation conversation, CancellationToken cancellationToken = default)
        {
            await _context.DirectConversations.AddAsync(conversation, cancellationToken);
        }


        public Task DeleteAsync(DirectConversation conversation, CancellationToken cancellationToken = default)
        {
            _context.DirectConversations.Remove(conversation);
            return Task.CompletedTask;
        }


        public async Task<bool> ExistsAsync(
            Guid user1Id,
            Guid user2Id, 
            CancellationToken cancellationToken = default)
        {
            var (smallerId, largerId) = user1Id < user2Id ? (user1Id, user2Id) : (user2Id, user1Id);

            return await _context.DirectConversations
                .AnyAsync(c => c.User1Id == smallerId && c.User2Id == largerId, cancellationToken);
        }


        public async Task<DirectConversation?> GetByIdAsync(
            Guid id, 
            CancellationToken cancellationToken = default)
        {
            return await _context.DirectConversations
                .FirstOrDefaultAsync(c => c.Id == id, cancellationToken);
        }


        public async Task<DirectConversation?> GetByParticipantsAsync(
            Guid user1Id, 
            Guid user2Id, 
            CancellationToken cancellationToken = default)
        {
            // Normalize user order for consistent lookup
            var (smallerId, largerId) = user1Id < user2Id ? (user1Id, user2Id) : (user2Id, user1Id);

            return await _context.DirectConversations
                .FirstOrDefaultAsync(
                    c => c.User1Id == smallerId && c.User2Id == largerId,
                    cancellationToken);
        }



        public async Task<PagedResult<DirectConversationDto>> GetUserConversationsPagedAsync(
            Guid userId,
            int pageNumber,
            int pageSize,
            CancellationToken cancellationToken = default)
        {
            // Base query - same visibility rules as non-paged version
            var baseQuery = from conv in _context.DirectConversations
                            join member in _context.DirectConversationMembers
                                on new { conv.Id, UserId = userId } equals new { Id = member.ConversationId, member.UserId }
                            where member.IsActive && !member.IsHidden
                                  && (conv.InitiatedByUserId == userId || conv.HasMessages || conv.IsNotes)
                            select conv;

            var totalCount = await baseQuery.CountAsync(cancellationToken);

            // Paginated main query with all details (including employee position)
            var conversationsQuery = await (from conv in baseQuery
                                        join member in _context.DirectConversationMembers
                                            on new { conv.Id, UserId = userId } equals new { Id = member.ConversationId, member.UserId }
                                        // Calculate otherUserId first
                                        let otherUserId = conv.User1Id == userId ? conv.User2Id : conv.User1Id
                                        // Join with OTHER user's data (not current user)
                                        from user in _context.Set<UserReadModel>().Where(u => u.Id == otherUserId)
                                        // Left join to employees table for OTHER user's position info
                                        from emp in _context.Set<EmployeeReadModel>().Where(e => e.UserId == otherUserId).DefaultIfEmpty()
                                        // Left join to positions table for position name
                                        from pos in _context.Set<PositionReadModel>().Where(p => emp != null && p.Id == emp.PositionId).DefaultIfEmpty()
                                        let lastMessageInfo = (from m in _context.DirectMessages
                                           where m.ConversationId == conv.Id
                                           orderby m.CreatedAtUtc descending
                                           join file in _context.Set<FileMetadata>()
                                               on m.FileId equals file.Id.ToString() into fileGroup
                                           from file in fileGroup.DefaultIfEmpty()
                                           select new { m.Id, m.Content, m.IsDeleted, m.SenderId, m.IsRead, m.FileId, FileContentType = file != null ? file.ContentType : null })
                                           .FirstOrDefault()
                                        orderby member.IsPinned descending, conv.LastMessageAtUtc descending
                                        select new
                                        {
                                            conv.Id,
                                            conv.IsNotes,
                                            OtherUserId = otherUserId,
                                            OtherUserEmail = user.Email,
                                            OtherUserFullName = user.FirstName + " " + user.LastName,
                                            user.AvatarUrl,
                                            user.Role,
                                            user.LastVisit,
                                            PositionName = pos != null ? pos.Name : null,
                                            LastMessage = lastMessageInfo == null ? null :
                                                lastMessageInfo.IsDeleted ? "This message was deleted" :
                                                lastMessageInfo.FileId != null ?
                                                    (lastMessageInfo.FileContentType != null && lastMessageInfo.FileContentType.StartsWith("image/") ?
                                                        (string.IsNullOrWhiteSpace(lastMessageInfo.Content) ? "[Image]" : "[Image] " + lastMessageInfo.Content) :
                                                        (string.IsNullOrWhiteSpace(lastMessageInfo.Content) ? "[File]" : "[File] " + lastMessageInfo.Content)) :
                                                lastMessageInfo.Content,
                                            conv.LastMessageAtUtc,
                                            member.LastReadLaterMessageId,
                                            LastMessageSenderId = lastMessageInfo != null ? (Guid?)lastMessageInfo.SenderId : null,
                                            LastMessageIsRead = lastMessageInfo != null && lastMessageInfo.IsRead,
                                            LastMessageId = lastMessageInfo != null ? (Guid?)lastMessageInfo.Id : null,
                                            member.IsPinned,
                                            member.IsMuted,
                                            member.IsMarkedReadLater
                                        })
                                        .Skip((pageNumber - 1) * pageSize)
                                        .Take(pageSize)
                                        .ToListAsync(cancellationToken);

            // Batch unread data only for this page's conversations
            var conversationIds = conversationsQuery.Select(c => c.Id).ToList();
            var firstUnreadMessageIds = new Dictionary<Guid, Guid>();
            var unreadCountDictionary = new Dictionary<Guid, int>();
            var hasUnreadMentionsDictionary = new Dictionary<Guid, bool>();

            if (conversationIds.Any())
            {
                var allUnreadMessages = await _context.DirectMessages
                    .Where(m => conversationIds.Contains(m.ConversationId) &&
                                m.ReceiverId == userId &&
                                !m.IsRead &&
                                !m.IsDeleted)
                    .Select(m => new { m.Id, m.ConversationId, m.CreatedAtUtc })
                    .ToListAsync(cancellationToken);

                var groupedUnreadMessages = allUnreadMessages.GroupBy(m => m.ConversationId);

                firstUnreadMessageIds = groupedUnreadMessages
                    .ToDictionary(g => g.Key, g => g.OrderBy(m => m.CreatedAtUtc).First().Id);

                unreadCountDictionary = groupedUnreadMessages
                    .ToDictionary(g => g.Key, g => g.Count());

                var conversationsWithMentions = await _context.DirectMessageMentions
                    .Where(mention => conversationIds.Contains(mention.Message.ConversationId) &&
                                      mention.MentionedUserId == userId &&
                                      !mention.Message.IsRead &&
                                      !mention.Message.IsDeleted)
                    .Select(mention => mention.Message.ConversationId)
                    .Distinct()
                    .ToListAsync(cancellationToken);

                foreach (var convId in conversationsWithMentions)
                {
                    hasUnreadMentionsDictionary[convId] = true;
                }
            }

            var conversations = conversationsQuery.Select(c =>
            {
                string? status = null;
                if (c.LastMessageSenderId == userId)
                {
                    status = c.LastMessageIsRead ? "Read" : "Sent";
                }

                // Role enum to string: 0 = User, 1 = Administrator
                var roleName = c.Role == 1 ? "Administrator" : "User";

                return new DirectConversationDto(
                    c.Id, c.OtherUserId, c.OtherUserEmail, c.OtherUserFullName, FileUrlHelper.ToAvatarUrl(c.AvatarUrl),
                    c.PositionName, // OtherUserPosition - from employees+positions join
                    roleName, // OtherUserRole
                    c.LastVisit, // OtherUserLastSeenAtUtc
                    c.LastMessage, c.LastMessageAtUtc,
                    unreadCountDictionary.TryGetValue(c.Id, out int unreadCount) ? unreadCount : 0,
                    hasUnreadMentionsDictionary.ContainsKey(c.Id) && hasUnreadMentionsDictionary[c.Id],
                    c.LastReadLaterMessageId, c.LastMessageSenderId, status, c.LastMessageId,
                    firstUnreadMessageIds.TryGetValue(c.Id, out Guid value) ? (Guid?)value : null,
                    c.IsNotes, c.IsPinned, c.IsMuted, c.IsMarkedReadLater
                );
            }).ToList();

            return PagedResult<DirectConversationDto>.Create(conversations, pageNumber, pageSize, totalCount);
        }


        public Task UpdateAsync(DirectConversation conversation, CancellationToken cancellationToken = default)
        {
            _context.DirectConversations.Update(conversation);
            return Task.CompletedTask;
        }
    }
}