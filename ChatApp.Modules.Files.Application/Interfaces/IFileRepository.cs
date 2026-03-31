using ChatApp.Modules.Files.Application.DTOs.Responses;
using ChatApp.Modules.Files.Domain.Entities;
using ChatApp.Modules.Files.Domain.Enums;

namespace ChatApp.Modules.Files.Application.Interfaces
{
    public interface IFileRepository
    {
        Task<FileMetadata?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
        Task<FileDto?> GetFileDtoByIdAsync(Guid id, CancellationToken cancellationToken = default);
        Task<List<FileDto>> GetUserFilesAsync(Guid userId,int pageSize=50,int skip=0,CancellationToken cancellationToken = default);
        Task<bool> ExistsAsync(Guid id, CancellationToken cancellationToken = default);

        /// <summary>
        /// Check if file is used in any channel where user is a member
        /// </summary>
        Task<bool> IsFileUsedInUserChannelsAsync(
            Guid fileId,
            Guid userId,
            CancellationToken cancellationToken = default);

        /// <summary>
        /// Check if file is used in any conversation where user is a participant
        /// </summary>
        Task<bool> IsFileUsedInUserConversationsAsync(
            Guid fileId,
            Guid userId,
            CancellationToken cancellationToken = default);

        Task AddAsync(FileMetadata file, CancellationToken cancellationToken = default);
        Task UpdateAsync(FileMetadata file, CancellationToken cancellationToken = default);
        Task DeleteAsync(FileMetadata file, CancellationToken cancellationToken = default);

        Task<(long TotalBytes, int FileCount, int ImageCount, int DocumentCount, int OtherCount)>
            GetStorageStatsAsync(Guid userId, CancellationToken cancellationToken = default);

        /// <summary>
        /// Finds active (non-deleted) file by its unique file name.
        /// Used for avatar cleanup — URL-dən filename extract edilib axtarılır.
        /// </summary>
        Task<FileMetadata?> GetActiveByFileNameAsync(string fileName, CancellationToken cancellationToken = default);

        // Drive-spesifik metodlar
        Task<List<FileMetadata>> GetDriveFilesAsync(Guid ownerId, Guid? folderId,
            string? sortBy, string? sortOrder, string? search,
            CancellationToken cancellationToken = default);
        Task<List<FileMetadata>> GetDeletedDriveFilesAsync(Guid ownerId, CancellationToken cancellationToken = default);
        Task<long> GetDriveUsageAsync(Guid ownerId, CancellationToken cancellationToken = default);
        Task<List<FileMetadata>> GetFilesByFolderIdAsync(Guid folderId, CancellationToken cancellationToken = default);
    }
}