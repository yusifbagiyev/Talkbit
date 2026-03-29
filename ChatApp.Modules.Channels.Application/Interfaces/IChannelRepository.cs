using ChatApp.Modules.Channels.Application.DTOs.Responses;
using ChatApp.Modules.Channels.Domain.Entities;
using ChatApp.Shared.Kernel.Common;
using System.Linq.Expressions;

namespace ChatApp.Modules.Channels.Application.Interfaces
{
    public interface IChannelRepository
    {
        Task<Channel?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
        Task<Channel?> GetByIdWithMembersAsync(Guid id, CancellationToken cancellationToken = default);
        Task<ChannelDetailsDto?> GetChannelDetailsByIdAsync(Guid id, CancellationToken cancellationToken = default);
        Task<Channel?> GetByNameAsync(string name, CancellationToken cancellationToken = default);
        Task<Channel?> GetByNameAndCompanyAsync(string name, Guid companyId, CancellationToken cancellationToken = default);
        Task<List<ChannelDto>> GetUserChannelsAsync(Guid userId, CancellationToken cancellationToken = default);
        Task<PagedResult<ChannelDto>> GetUserChannelDtosPagedAsync(Guid userId, int pageNumber, int pageSize, CancellationToken cancellationToken = default);
        Task<List<ChannelDto>> GetPublicChannelsAsync(Guid? callerCompanyId = null, bool isSuperAdmin = false, CancellationToken cancellationToken = default);
        Task<bool> IsUserMemberAsync(Guid channelId, Guid userId, CancellationToken cancellationToken = default);
        Task<List<Guid>> GetMemberUserIdsAsync(Guid channelId, CancellationToken cancellationToken = default);
        Task<List<SharedChannelDto>> GetSharedChannelsAsync(Guid userId1, Guid userId2, CancellationToken cancellationToken = default);
        Task<bool> ExistsAsync(Expression<Func<Channel, bool>> predicate, CancellationToken cancellationToken = default);
        Task AddAsync(Channel channel, CancellationToken cancellationToken = default);
        Task UpdateAsync(Channel channel, CancellationToken cancellationToken = default);
        Task DeleteAsync(Channel channel, CancellationToken cancellationToken = default);
    }
}