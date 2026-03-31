using ChatApp.Modules.DirectMessages.Application.Commands.DirectMessageReactions;
using ChatApp.Modules.DirectMessages.Application.DTOs.Request;
using ChatApp.Modules.DirectMessages.Application.Interfaces;
using ChatApp.Modules.DirectMessages.Domain.Entities;
using ChatApp.Shared.Kernel.Common;
using Microsoft.EntityFrameworkCore;

namespace ChatApp.Modules.DirectMessages.Infrastructure.Persistence.Repositories
{
    public class DirectMessageReactionRepository : IDirectMessageReactionRepository
    {
        private readonly DirectMessagesDbContext _context;

        public DirectMessageReactionRepository(DirectMessagesDbContext context)
        {
            _context = context;
        }

        public async Task AddAsync(DirectMessageReaction reaction, CancellationToken cancellationToken = default)
        {
            await _context.DirectMessageReactions.AddAsync(reaction, cancellationToken);
        }

        public Task DeleteAsync(DirectMessageReaction reaction, CancellationToken cancellationToken = default)
        {
            _context.DirectMessageReactions.Remove(reaction);
            return Task.CompletedTask;
        }

        public async Task<List<ReactionSummary>> GetMessageReactionsWithUserDetailsAsync(
            Guid messageId,
            CancellationToken cancellationToken = default)
        {
            var reactions = await (
                from reaction in _context.DirectMessageReactions
                join user in _context.Set<UserReadModel>() on reaction.UserId equals user.Id
                where reaction.MessageId == messageId
                group new { reaction, user } by reaction.Reaction into g
                select new ReactionSummary(
                    g.Key,
                    g.Count(),
                    g.Select(x => x.reaction.UserId).ToList(),
                    g.Select(x => x.user.FullName).ToList(),
                    g.Select(x => x.user.AvatarUrl).ToList()
                ))
                .ToListAsync(cancellationToken);

            return reactions.Select(r => r with {
                UserAvatarUrls = r.UserAvatarUrls.Select(a => FileUrlHelper.ToAvatarUrl(a)).ToList()
            }).ToList();
        }

        public async Task<DirectMessageReaction?> GetReactionAsync(Guid messageId, Guid userId, string reaction, CancellationToken cancellationToken = default)
        {
            return await _context.DirectMessageReactions
                .AsNoTracking()
                .FirstOrDefaultAsync(r=>
                    r.MessageId==messageId &&
                    r.UserId==userId &&
                    r.Reaction==reaction, 
                    cancellationToken);
        }
    }
}