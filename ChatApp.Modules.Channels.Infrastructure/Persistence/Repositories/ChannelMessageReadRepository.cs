using ChatApp.Modules.Channels.Application.Interfaces;
using ChatApp.Modules.Channels.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace ChatApp.Modules.Channels.Infrastructure.Persistence.Repositories
{
    public class ChannelMessageReadRepository : IChannelMessageReadRepository
    {
        private readonly ChannelsDbContext _context;

        public ChannelMessageReadRepository(ChannelsDbContext context)
        {
            _context = context;
        }

        public async Task<bool> ExistsAsync(Guid messageId, Guid userId, CancellationToken cancellationToken = default)
        {
            return await _context.ChannelMessageReads
                .AnyAsync(r => r.MessageId == messageId && r.UserId == userId, cancellationToken);
        }

        public async Task BulkInsertAsync(List<ChannelMessageRead> reads, CancellationToken cancellationToken = default)
        {
            if (reads == null || reads.Count == 0)
                return;

            // DEADLOCK FIX: Use raw SQL with ON CONFLICT DO NOTHING
            // Prevents deadlock when multiple concurrent mark-as-read requests arrive
            // Index: ix_channel_message_reads_message_user (message_id, user_id) UNIQUE

            // Build batch insert query with ON CONFLICT clause
            var values = string.Join(", ", reads.Select((r, index) =>
                $"(@id{index}, @createdAt{index}, @messageId{index}, @readAt{index}, @updatedAt{index}, @userId{index})"));

            var sql = $@"
                INSERT INTO channel_message_reads (id, created_at_utc, message_id, read_at_utc, updated_at_utc, user_id)
                VALUES {values}
                ON CONFLICT (message_id, user_id) DO NOTHING";

            // Build parameters
            var parameters = new List<object>();
            for (int i = 0; i < reads.Count; i++)
            {
                var read = reads[i];
                parameters.Add(new Npgsql.NpgsqlParameter($"@id{i}", read.Id));
                parameters.Add(new Npgsql.NpgsqlParameter($"@createdAt{i}", read.CreatedAtUtc));
                parameters.Add(new Npgsql.NpgsqlParameter($"@messageId{i}", read.MessageId));
                parameters.Add(new Npgsql.NpgsqlParameter($"@readAt{i}", read.ReadAtUtc));
                parameters.Add(new Npgsql.NpgsqlParameter($"@updatedAt{i}", read.UpdatedAtUtc));
                parameters.Add(new Npgsql.NpgsqlParameter($"@userId{i}", read.UserId));
            }

            await _context.Database.ExecuteSqlRawAsync(sql, parameters, cancellationToken);
        }

        public async Task<List<Guid>> GetUnreadMessageIdsAsync(
            Guid channelId, Guid userId,
            CancellationToken cancellationToken = default,
            Guid? excludeSenderId = null)
        {
            var query = _context.ChannelMessages
                .Where(m => m.ChannelId == channelId && !m.IsDeleted)
                .Where(m => !_context.ChannelMessageReads
                    .Any(r => r.MessageId == m.Id && r.UserId == userId));

            if (excludeSenderId.HasValue)
                query = query.Where(m => m.SenderId != excludeSenderId.Value);

            return await query.Select(m => m.Id).ToListAsync(cancellationToken);
        }

        public async Task<HashSet<Guid>> GetExistingReadMessageIdsAsync(
            List<Guid> messageIds, Guid userId,
            CancellationToken cancellationToken = default)
        {
            var existing = await _context.ChannelMessageReads
                .Where(r => messageIds.Contains(r.MessageId) && r.UserId == userId)
                .Select(r => r.MessageId)
                .ToListAsync(cancellationToken);

            return existing.ToHashSet();
        }

        public async Task AddAsync(ChannelMessageRead read, CancellationToken cancellationToken = default)
        {
            await _context.ChannelMessageReads.AddAsync(read, cancellationToken);
        }

        public async Task<int> GetReadByCountAsync(Guid messageId, CancellationToken cancellationToken = default)
        {
            return await _context.ChannelMessageReads
                .CountAsync(r => r.MessageId == messageId, cancellationToken);
        }

        public async Task<Dictionary<Guid, int>> GetReadByCountsAsync(List<Guid> messageIds, CancellationToken cancellationToken = default)
        {
            if (messageIds == null || messageIds.Count == 0)
                return new Dictionary<Guid, int>();

            // Get read counts from database (only for messages that have been read)
            var readCounts = await _context.ChannelMessageReads
                .Where(r => messageIds.Contains(r.MessageId))
                .GroupBy(r => r.MessageId)
                .Select(g => new { MessageId = g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.MessageId, x => x.Count, cancellationToken);

            // Add missing messages with 0 count (messages that haven't been read yet)
            var result = new Dictionary<Guid, int>();
            foreach (var messageId in messageIds)
            {
                result[messageId] = readCounts.TryGetValue(messageId, out var count) ? count : 0;
            }

            return result;
        }
    }
}