using ChatApp.Modules.Files.Application.Interfaces;
using ChatApp.Modules.Files.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace ChatApp.Modules.Files.Infrastructure.Persistence.Repositories
{
    public class DriveFolderRepository(FilesDbContext context) : IDriveFolderRepository
    {
        public async Task<DriveFolder?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
        {
            return await context.DriveFolders
                .FirstOrDefaultAsync(f => f.Id == id, cancellationToken);
        }

        public async Task<List<DriveFolder>> GetChildrenAsync(
            Guid ownerId, Guid? parentFolderId, CancellationToken cancellationToken = default)
        {
            return await context.DriveFolders
                .Where(f => f.OwnerId == ownerId
                    && f.ParentFolderId == parentFolderId
                    && !f.IsDeleted)
                .OrderBy(f => f.Name)
                .AsNoTracking()
                .ToListAsync(cancellationToken);
        }

        public async Task<List<DriveFolder>> GetDeletedFoldersAsync(
            Guid ownerId, CancellationToken cancellationToken = default)
        {
            var thirtyDaysAgo = DateTime.UtcNow.AddDays(-30);
            return await context.DriveFolders
                .Where(f => f.OwnerId == ownerId
                    && f.IsDeleted
                    && f.DeletedAtUtc > thirtyDaysAgo)
                .OrderByDescending(f => f.DeletedAtUtc)
                .AsNoTracking()
                .ToListAsync(cancellationToken);
        }

        // Recursive — bütün alt folder-ləri tapır (delete/move üçün)
        public async Task<List<DriveFolder>> GetAllDescendantsAsync(
            Guid folderId, CancellationToken cancellationToken = default)
        {
            var result = new List<DriveFolder>();
            var queue = new Queue<Guid>();
            queue.Enqueue(folderId);

            while (queue.Count > 0)
            {
                var parentId = queue.Dequeue();
                var children = await context.DriveFolders
                    .Where(f => f.ParentFolderId == parentId && !f.IsDeleted)
                    .ToListAsync(cancellationToken);

                result.AddRange(children);
                foreach (var child in children)
                    queue.Enqueue(child.Id);
            }

            return result;
        }

        public async Task<bool> ExistsAsync(Guid id, Guid ownerId, CancellationToken cancellationToken = default)
        {
            return await context.DriveFolders
                .AnyAsync(f => f.Id == id && f.OwnerId == ownerId && !f.IsDeleted, cancellationToken);
        }

        public async Task AddAsync(DriveFolder folder, CancellationToken cancellationToken = default)
        {
            await context.DriveFolders.AddAsync(folder, cancellationToken);
        }

        public Task UpdateAsync(DriveFolder folder, CancellationToken cancellationToken = default)
        {
            context.DriveFolders.Update(folder);
            return Task.CompletedTask;
        }

        public async Task<int> GetItemCountAsync(Guid folderId, CancellationToken cancellationToken = default)
        {
            var subFolders = await context.DriveFolders
                .CountAsync(f => f.ParentFolderId == folderId && !f.IsDeleted, cancellationToken);
            var files = await context.FileMetadata
                .CountAsync(f => f.FolderId == folderId && !f.IsDeleted && f.IsDriveFile, cancellationToken);
            return subFolders + files;
        }
    }
}
