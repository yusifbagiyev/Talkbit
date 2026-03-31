using ChatApp.Modules.DirectMessages.Application.DTOs.Request;
using ChatApp.Modules.DirectMessages.Application.DTOs.Response;
using ChatApp.Modules.DirectMessages.Application.Interfaces;
using ChatApp.Modules.DirectMessages.Domain.Entities;
using ChatApp.Shared.Kernel.Common;
using Microsoft.EntityFrameworkCore;

namespace ChatApp.Modules.DirectMessages.Infrastructure.Persistence.Repositories
{
    public class UserFavoriteMessageRepository : IUserFavoriteMessageRepository
    {
        private readonly DirectMessagesDbContext _context;

        public UserFavoriteMessageRepository(DirectMessagesDbContext context)
        {
            _context = context;
        }

        public async Task<UserFavoriteMessage?> GetAsync(Guid userId, Guid messageId, CancellationToken cancellationToken = default)
        {
            return await _context.UserFavoriteMessages
                .FirstOrDefaultAsync(f => f.UserId == userId && f.MessageId == messageId, cancellationToken);
        }

        public async Task<List<Guid>> GetFavoriteMessageIdsAsync(Guid userId, Guid conversationId, CancellationToken cancellationToken = default)
        {
            return await (
                from favorite in _context.UserFavoriteMessages
                join message in _context.DirectMessages on favorite.MessageId equals message.Id
                where favorite.UserId == userId && message.ConversationId == conversationId
                select favorite.MessageId
            ).ToListAsync(cancellationToken);
        }

        public async Task<List<FavoriteDirectMessageDto>> GetFavoriteMessagesAsync(Guid userId, Guid conversationId, CancellationToken cancellationToken = default)
        {
            var favorites = await (
                from favorite in _context.UserFavoriteMessages
                join message in _context.DirectMessages on favorite.MessageId equals message.Id
                join sender in _context.Set<UserReadModel>() on message.SenderId equals sender.Id
                where favorite.UserId == userId && message.ConversationId == conversationId
                orderby favorite.FavoritedAtUtc descending
                select new FavoriteDirectMessageDto(
                    message.Id,
                    message.ConversationId,
                    message.SenderId,
                    sender.Email,
                    sender.FullName,
                    sender.AvatarUrl,
                    message.IsDeleted ? "This message was deleted" : message.Content,
                    message.IsDeleted,
                    DateTime.SpecifyKind(message.CreatedAtUtc, DateTimeKind.Utc),
                    DateTime.SpecifyKind(favorite.FavoritedAtUtc, DateTimeKind.Utc),
                    message.FileId
                )
            ).ToListAsync(cancellationToken);

            return favorites.Select(f => f with { SenderAvatarUrl = FileUrlHelper.ToAvatarUrl(f.SenderAvatarUrl) }).ToList();
        }

        public async Task<bool> IsFavoriteAsync(Guid userId, Guid messageId, CancellationToken cancellationToken = default)
        {
            return await _context.UserFavoriteMessages
                .AnyAsync(f => f.UserId == userId && f.MessageId == messageId, cancellationToken);
        }

        public async Task AddAsync(UserFavoriteMessage favorite, CancellationToken cancellationToken = default)
        {
            await _context.UserFavoriteMessages.AddAsync(favorite, cancellationToken);
        }

        public Task RemoveAsync(UserFavoriteMessage favorite, CancellationToken cancellationToken = default)
        {
            _context.UserFavoriteMessages.Remove(favorite);
            return Task.CompletedTask;
        }
    }
}
