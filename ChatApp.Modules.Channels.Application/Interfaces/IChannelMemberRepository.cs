using ChatApp.Modules.Channels.Application.DTOs.Responses;
using ChatApp.Modules.Channels.Domain.Entities;
using ChatApp.Modules.Channels.Domain.Enums;

namespace ChatApp.Modules.Channels.Application.Interfaces
{
    public interface IChannelMemberRepository
    {
        Task<ChannelMember?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
        Task<ChannelMember?> GetMemberAsync(Guid channelId, Guid userId, CancellationToken cancellationToken = default);
        Task<List<ChannelMember>> GetChannelMembersAsync(Guid channelId, CancellationToken cancellationToken = default);
        Task<List<ChannelMemberDto>> GetChannelMembersWithUserDataAsync(
            Guid channelId, 
            int skip = 0, 
            int take = 30, 
            CancellationToken cancellationToken = default);
        Task<MemberRole?> GetUserRoleAsync(Guid channelId, Guid userId, CancellationToken cancellationToken = default);
        Task<List<Guid>> GetChannelMemberIdsAsync(Guid channelId, CancellationToken cancellationToken = default);
        Task AddAsync(ChannelMember member, CancellationToken cancellationToken = default);
        Task UpdateAsync(ChannelMember member, CancellationToken cancellationToken = default);
        Task DeleteAsync(ChannelMember member, CancellationToken cancellationToken = default);
    }
}