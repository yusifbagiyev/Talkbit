using ChatApp.Modules.Channels.Application.DTOs.Responses;
using ChatApp.Modules.Channels.Application.Interfaces;
using ChatApp.Modules.Channels.Domain.Entities;
using ChatApp.Modules.Channels.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace ChatApp.Modules.Channels.Infrastructure.Persistence.Repositories
{
    public class ChannelMemberRepository : IChannelMemberRepository
    {
        private readonly ChannelsDbContext _context;

        public ChannelMemberRepository(ChannelsDbContext context)
        {
            _context = context;
        }

        public async Task<ChannelMember?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
        {
            return await _context.ChannelMembers
                .FirstOrDefaultAsync(m => m.Id == id, cancellationToken);
        }

        public async Task<ChannelMember?> GetMemberAsync(Guid channelId, Guid userId, CancellationToken cancellationToken = default)
        {
            return await _context.ChannelMembers
                .FirstOrDefaultAsync(m => m.ChannelId == channelId && m.UserId == userId, cancellationToken);
        }

        public async Task<List<ChannelMember>> GetChannelMembersAsync(Guid channelId, CancellationToken cancellationToken = default)
        {
            return await _context.ChannelMembers
                .Where(m => m.ChannelId == channelId)
                .OrderByDescending(m => m.Role)
                .ThenBy(m => m.JoinedAtUtc)
                .ToListAsync(cancellationToken);
        }

        public async Task<List<ChannelMemberDto>> GetChannelMembersWithUserDataAsync(
            Guid channelId, 
            CancellationToken cancellationToken = default)
        {
            // Database join with users table
            return await _context.ChannelMembers
                .AsNoTracking()
                .Where(m=> m.ChannelId == channelId)
                .Join(
                    _context.Set<UserReadModel>().AsNoTracking(),
                    member=>member.UserId,
                    user=>user.Id,
                    (member, user) => new {member, user})
                .OrderByDescending(x=> x.member.Role)
                    .ThenBy(x=> x.member.JoinedAtUtc)
                .Select(x=>new ChannelMemberDto(
                    x.member.Id,
                    x.member.ChannelId,
                    x.member.UserId,
                    x.user.Email,
                    x.user.FullName,
                    x.user.AvatarUrl,
                    x.member.Role,
                    x.member.JoinedAtUtc,
                    x.member.LastReadLaterMessageId
                ))
                .ToListAsync(cancellationToken);
        }

        public async Task<MemberRole?> GetUserRoleAsync(Guid channelId, Guid userId, CancellationToken cancellationToken = default)
        {
            var member = await _context.ChannelMembers
                .Where(m => m.ChannelId == channelId && m.UserId == userId)
                .Select(m => m.Role)
                .FirstOrDefaultAsync(cancellationToken);

            return member == default ? null : member;
        }

        public async Task<List<Guid>> GetChannelMemberIdsAsync(Guid channelId, CancellationToken cancellationToken = default)
        {
            return await _context.ChannelMembers
                .Where(m => m.ChannelId == channelId)
                .Select(m => m.UserId)
                .ToListAsync(cancellationToken);
        }

        public async Task AddAsync(ChannelMember member, CancellationToken cancellationToken = default)
        {
            await _context.ChannelMembers.AddAsync(member, cancellationToken);
        }

        public Task UpdateAsync(ChannelMember member, CancellationToken cancellationToken = default)
        {
            _context.ChannelMembers.Update(member);
            return Task.CompletedTask;
        }

        public Task DeleteAsync(ChannelMember member, CancellationToken cancellationToken = default)
        {
            _context.ChannelMembers.Remove(member);
            return Task.CompletedTask;
        }
    }
}