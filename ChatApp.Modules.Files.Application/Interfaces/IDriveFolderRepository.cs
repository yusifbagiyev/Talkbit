using ChatApp.Modules.Files.Domain.Entities;

namespace ChatApp.Modules.Files.Application.Interfaces
{
    public interface IDriveFolderRepository
    {
        Task<DriveFolder?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
        Task<List<DriveFolder>> GetChildrenAsync(Guid ownerId, Guid? parentFolderId, CancellationToken cancellationToken = default);
        Task<List<DriveFolder>> GetDeletedFoldersAsync(Guid ownerId, CancellationToken cancellationToken = default);
        Task<List<DriveFolder>> GetAllDescendantsAsync(Guid folderId, CancellationToken cancellationToken = default);
        Task<bool> ExistsAsync(Guid id, Guid ownerId, CancellationToken cancellationToken = default);
        Task AddAsync(DriveFolder folder, CancellationToken cancellationToken = default);
        Task UpdateAsync(DriveFolder folder, CancellationToken cancellationToken = default);
        Task<int> GetItemCountAsync(Guid folderId, CancellationToken cancellationToken = default);
    }
}
