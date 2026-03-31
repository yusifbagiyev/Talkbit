using ChatApp.Modules.Search.Application.DTOs.Requests;
using ChatApp.Modules.Search.Application.DTOs.Responses;
using ChatApp.Modules.Search.Application.Interfaces;
using ChatApp.Modules.Search.Domain.Enums;
using ChatApp.Modules.Search.Infrastructure.Persistence;
using ChatApp.Shared.Kernel.Common;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using static System.Runtime.InteropServices.JavaScript.JSType;

namespace ChatApp.Modules.Search.Infrastructure.Repositories
{
    public class SearchRepository : ISearchRepository
    {
        private readonly SearchDbContext _context;
        private readonly ILogger<SearchRepository> _logger;

        public SearchRepository(
            SearchDbContext context,
            ILogger<SearchRepository> logger)
        {
            _context = context;
            _logger = logger;
        }

        public async Task<SearchResultsDto> SearchChannelMessagesAsync(
            Guid userId, 
            string searchTerm, 
            Guid? specificChannelId,
            int pageNumber, 
            int pageSize, 
            CancellationToken cancellationToken = default)
        {
            // Build the database query (this will be translated to SQL)
            var query = from message in _context.Set<ChannelMessageReadModel>()
                        join channel in _context.Set<ChannelReadModel>()
                            on message.ChannelId equals channel.Id
                        join sender in _context.Set<UserReadModel>()
                            on message.SenderId equals sender.Id
                        join member in _context.Set<ChannelMemberReadModel>()
                            on new { message.ChannelId, UserId = userId }
                            equals new { member.ChannelId, member.UserId }
                        where !message.IsDeleted
                              && EF.Functions.ILike(message.Content, $"%{searchTerm}%") // Case-insensitive search
                        select new
                        {
                            // Select only the raw data from the database
                            MessageId = message.Id,
                            MessageContent = message.Content,
                            MessageCreatedAtUtc = message.CreatedAtUtc,
                            MessageChannelId = message.ChannelId,
                            SenderId = sender.Id,
                            SenderEmail = sender.Email,
                            SenderFullName = sender.FullName,
                            SenderAvatarUrl = sender.AvatarUrl,
                            ChannelName = channel.Name
                        };

            // Filter by specific channel if provided
            if (specificChannelId.HasValue)
            {
                query=query.Where(r=>r.MessageChannelId== specificChannelId.Value);
            }

            // Get the total count (this executes a COUNT query in SQL)
            var totalCount = await query.CountAsync(cancellationToken);


            // Order and paginate in the database, then retrieve the data
            var rawResults = await query
                .OrderByDescending(r => r.MessageCreatedAtUtc)
                .Skip((pageNumber - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync(cancellationToken);


            // Now that we have the data in memory, transform it to DTOs and apply the highlighting (client-side operation)
            var results = rawResults.Select(r => new SearchResultDto(
                r.MessageId,
                SearchResultType.ChannelMessage,
                r.MessageContent,
                HighlightSearchTerm(r.MessageContent, searchTerm),
                r.SenderId,
                r.SenderEmail,
                r.SenderFullName,
                FileUrlHelper.ToAvatarUrl(r.SenderAvatarUrl),
                r.MessageCreatedAtUtc,
                r.MessageChannelId,
                r.ChannelName,
                null,
                null,
                null,
                null
            )).ToList();

            var hasNextPage = totalCount > (pageNumber * pageSize);

            return new SearchResultsDto(
                results,
                totalCount,
                pageNumber,
                pageSize,
                hasNextPage);
        }


        public async Task<SearchResultsDto> SearchDirectMessagesAsync(
            Guid userId, 
            string searchTerm,
            Guid? specificConversationId, 
            int pageNumber,
            int pageSize,
            CancellationToken cancellationToken = default)
        {
            // Build the database query
            var query = from message in _context.Set<DirectMessageReadModel>()
                        join conversation in _context.Set<ConversationReadModel>()
                           on message.ConversationId equals conversation.Id
                        join sender in _context.Set<UserReadModel>()
                           on message.SenderId equals sender.Id
                        where !message.IsDeleted
                           && (conversation.User1Id == userId || conversation.User2Id == userId)
                           && EF.Functions.ILike(message.Content, $"%{searchTerm}%")
                        select new
                        {
                            Message = message,
                            Sender = sender,
                            Conversation = conversation
                        };

            // Filter by specific conversation if provided
            if (specificConversationId.HasValue)
            {
                query = query.Where(x => x.Conversation.Id == specificConversationId.Value);
            }

            // Get total count
            var totalCount = await query.CountAsync(cancellationToken);

            // Order, paginate and retrieve from database
            var rawData = await query
                .OrderByDescending(x => x.Message.CreatedAtUtc)
                .Skip((pageNumber - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync(cancellationToken);

            // Batch load other user details to eliminate N+1 queries
            var otherUserIds = rawData
                .Select(item => item.Conversation.User1Id == userId
                    ? item.Conversation.User2Id
                    : item.Conversation.User1Id)
                .Distinct()
                .ToList();

            var otherUsers = await _context.Set<UserReadModel>()
                .Where(u => otherUserIds.Contains(u.Id))
                .ToDictionaryAsync(u => u.Id, cancellationToken);

            var results = rawData.Select(item =>
            {
                var otherUserId = item.Conversation.User1Id == userId
                    ? item.Conversation.User2Id
                    : item.Conversation.User1Id;

                otherUsers.TryGetValue(otherUserId, out var otherUser);

                return new SearchResultDto(
                    item.Message.Id,
                    SearchResultType.DirectMessage,
                    item.Message.Content,
                    HighlightSearchTerm(item.Message.Content, searchTerm),
                    item.Sender.Id,
                    item.Sender.Email,
                    item.Sender.FullName,
                    FileUrlHelper.ToAvatarUrl(item.Sender.AvatarUrl),
                    item.Message.CreatedAtUtc,
                    null,
                    null,
                    item.Conversation.Id,
                    otherUser?.Id,
                    otherUser?.Email,
                    otherUser?.FullName
                );
            }).ToList();

            var hasNextPage = totalCount > (pageNumber * pageSize);

            return new SearchResultsDto(
                results,
                totalCount,
                pageNumber,
                pageSize,
                hasNextPage);
        }


        public async Task<SearchResultsDto> SearchMessagesAsync(
            Guid userId,
            string searchTerm,
            SearchScope scope,
            Guid? channelId, 
            Guid? conversationId,
            int pageNumber,
            int pageSize,
            CancellationToken cancellationToken = default)
        {
            var results = new List<SearchResultDto>();

            // Search in channels
            if(scope==SearchScope.All || scope == SearchScope.Channels)
            {
                var channelResults = await SearchChannelMessagesAsync(
                    userId,
                    searchTerm,
                    channelId,
                    pageNumber,
                    pageSize,
                    cancellationToken);

                results.AddRange(channelResults.Results);
            }

            // Search in direct messages
            if(scope==SearchScope.All || scope == SearchScope.DirectMessages)
            {
                var dmResults = await SearchDirectMessagesAsync(
                    userId,
                    searchTerm,
                    conversationId,
                    pageNumber,
                    pageSize,
                    cancellationToken);

                results.AddRange(dmResults.Results);
            }

            // Sort by date descending
            results = results
                .OrderByDescending(r => r.CreatedAtUtc)
                .ToList();

            var totalCount = results.Count;
            var hasNextPage = totalCount > (pageNumber * pageSize);

            return new SearchResultsDto(
                results.Take(pageSize).ToList(),
                totalCount,
                pageNumber,
                pageSize,
                hasNextPage);
        }

        private static string HighlightSearchTerm(string content,string searchTerm)
        {
            if (string.IsNullOrEmpty(content) || string.IsNullOrEmpty(searchTerm)) return content;

            // Simple highlight: wrap matching term in <mark> tags
            // Frontend can use this to highlight search results
            return content.Replace(
                searchTerm,
                $"<mark>{searchTerm}</mark>",
                StringComparison.OrdinalIgnoreCase);
        }
    }
}