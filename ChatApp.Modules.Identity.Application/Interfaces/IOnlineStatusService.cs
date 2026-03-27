namespace ChatApp.Modules.Identity.Application.Interfaces
{
    public interface IOnlineStatusService
    {
        Task<Dictionary<Guid, bool>> GetOnlineStatusAsync(List<Guid> userIds);
    }
}
