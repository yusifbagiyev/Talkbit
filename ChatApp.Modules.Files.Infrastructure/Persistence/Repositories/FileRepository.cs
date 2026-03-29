using ChatApp.Modules.Files.Application.DTOs.Requests;
using ChatApp.Modules.Files.Application.DTOs.Responses;
using ChatApp.Modules.Files.Application.Interfaces;
using ChatApp.Modules.Files.Domain.Entities;
using ChatApp.Modules.Files.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace ChatApp.Modules.Files.Infrastructure.Persistence.Repositories
{
    public class FileRepository:IFileRepository
    {
        private readonly FilesDbContext _context;

        public FileRepository(FilesDbContext context)
        {
            _context = context;
        }

        public async Task AddAsync(FileMetadata file, CancellationToken cancellationToken = default)
        {
            await _context.FileMetadata.AddAsync(file, cancellationToken);
        }


        public Task DeleteAsync(FileMetadata file, CancellationToken cancellationToken = default)
        {
            _context.FileMetadata.Remove(file);
            return Task.CompletedTask;
        }


        public async Task<bool> ExistsAsync(Guid id, CancellationToken cancellationToken = default)
        {
            return await _context.FileMetadata
                .AnyAsync(f => f.Id == id && !f.IsDeleted, cancellationToken);
        }


        public async Task<FileMetadata?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
        {
            return await _context.FileMetadata
                .FirstOrDefaultAsync(f=>f.Id==id && !f.IsDeleted,cancellationToken);
        }


        public async Task<FileDto?> GetFileDtoByIdAsync(Guid id, CancellationToken cancellationToken = default)
        {
            var result = await (from file in _context.FileMetadata
                                join user in _context.Set<UserReadModel>() on file.UploadedBy equals user.Id
                                where file.Id == id && !file.IsDeleted
                                select new FileDto(
                                    file.Id,
                                    file.FileName,
                                    file.OriginalFileName,
                                    file.ContentType,
                                    file.FileSizeInBytes,
                                    file.FileType,
                                    file.UploadedBy,
                                    user.Email,
                                    user.FullName,
                                    file.Width,
                                    file.Height,
                                    file.CreatedAtUtc
                                ))
                              .FirstOrDefaultAsync(cancellationToken);
            return result;
        }


        public async Task<List<FileDto>> GetUserFilesAsync(
            Guid userId, 
            int pageSize = 50, 
            int skip = 0, 
            CancellationToken cancellationToken = default)
        {
            var results=await (from file in _context.FileMetadata
                               join user in _context.Set<UserReadModel>() on file.UploadedBy equals user.Id
                               where file.UploadedBy == userId && !file.IsDeleted
                               orderby file.CreatedAtUtc descending
                               select new FileDto(
                                   file.Id,
                                   file.FileName,
                                   file.OriginalFileName,
                                   file.ContentType,
                                   file.FileSizeInBytes,
                                   file.FileType,
                                   file.UploadedBy,
                                   user.Email,
                                   user.FullName,
                                   file.Width,
                                   file.Height,
                                   file.CreatedAtUtc
                               ))
                               .Skip(skip)
                               .Take(pageSize)
                               .ToListAsync(cancellationToken);

            return results;
        }


        public async Task<bool> IsFileUsedInUserChannelsAsync(
            Guid fileId,
            Guid userId,
            CancellationToken cancellationToken = default)
        {
            // Check if file is referenced in any channel message where user is a member
            var query = @"
                SELECT COUNT(*)
                FROM channel_messages cm
                INNER JOIN channel_members cmem ON cm.channel_id=cmem.channel_id
                WHERE cm.file_id=@fileId
                  AND cmem.user_id=@userId
                  AND cm.is_deleted=false";

            var connection = _context.Database.GetDbConnection();
            if (connection.State != System.Data.ConnectionState.Open)
            {
                await connection.OpenAsync(cancellationToken);
            }

            await using var command = connection.CreateCommand();
            command.CommandText = query;
            command.Parameters.Add(new Npgsql.NpgsqlParameter("@fileId", fileId.ToString()));
            command.Parameters.Add(new Npgsql.NpgsqlParameter("@userId", userId));

            var result = await command.ExecuteScalarAsync(cancellationToken);
            var count = Convert.ToInt32(result);

            return count > 0;
        }


        public async Task<bool> IsFileUsedInUserConversationsAsync(
            Guid fileId,
            Guid userId,
            CancellationToken cancellationToken = default)
        {
            // Check if file is referenced in any direct message where user is participant
            var query = @"
                SELECT COUNT(*)
                FROM direct_messages dm
                INNER JOIN direct_conversations dc ON dm.conversation_id = dc.id
                WHERE dm.file_id = @fileId
                  AND (dc.user1_id = @userId OR dc.user2_id = @userId)
                  AND dm.is_deleted = false";

            var connection = _context.Database.GetDbConnection();
            if (connection.State != System.Data.ConnectionState.Open)
            {
                await connection.OpenAsync(cancellationToken);
            }

            await using var command = connection.CreateCommand();
            command.CommandText = query;
            command.Parameters.Add(new Npgsql.NpgsqlParameter("@fileId", fileId.ToString()));
            command.Parameters.Add(new Npgsql.NpgsqlParameter("@userId", userId));

            var result = await command.ExecuteScalarAsync(cancellationToken);
            var count = Convert.ToInt32(result);

            return count > 0;
        }


        public Task UpdateAsync(FileMetadata file, CancellationToken cancellationToken = default)
        {
            _context.FileMetadata.Update(file);
            return Task.CompletedTask;
        }

        public async Task<(long TotalBytes, int FileCount, int ImageCount, int DocumentCount, int OtherCount)>
            GetStorageStatsAsync(Guid userId, CancellationToken cancellationToken = default)
        {
            // Bütün aggregasiya DB-də edilir — memory-ə heç bir sətir çəkilmir
            var result = await _context.FileMetadata
                .Where(f => f.UploadedBy == userId && !f.IsDeleted
                          && !f.StoragePath.Contains("/departments/")
                          && !f.StoragePath.Contains("/avatar"))
                .GroupBy(_ => 1)
                .Select(g => new
                {
                    TotalBytes = g.Sum(f => f.FileSizeInBytes),
                    FileCount = g.Count(),
                    ImageCount = g.Count(f => f.FileType == FileType.Image),
                    DocumentCount = g.Count(f => f.FileType == FileType.Document),
                    OtherCount = g.Count(f => f.FileType != FileType.Image && f.FileType != FileType.Document)
                })
                .FirstOrDefaultAsync(cancellationToken);

            if (result is null)
                return (0, 0, 0, 0, 0);

            return (result.TotalBytes, result.FileCount, result.ImageCount, result.DocumentCount, result.OtherCount);
        }

        public async Task<FileMetadata?> GetActiveByFileNameAsync(
            string fileName, CancellationToken cancellationToken = default)
        {
            return await _context.FileMetadata
                .FirstOrDefaultAsync(f => f.FileName == fileName && !f.IsDeleted, cancellationToken);
        }
    }
}