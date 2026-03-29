using ChatApp.Modules.Files.Application.Interfaces;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace ChatApp.Modules.Files.Infrastructure.Services
{
    public class LocalFileStorageService : IFileStorageService
    {
        private readonly string _baseStoragePath;
        private readonly ILogger<LocalFileStorageService> _logger;

        public LocalFileStorageService(
            IConfiguration configuration,
            ILogger<LocalFileStorageService> logger)
        {
            _baseStoragePath = configuration["FileStorage:LocalPath"]
                ?? Path.Combine(Directory.GetCurrentDirectory(), "uploads");

            _logger = logger;

            if (!Directory.Exists(_baseStoragePath))
            {
                Directory.CreateDirectory(_baseStoragePath);
                _logger.LogInformation("Created storage directory: {Path}", _baseStoragePath);
            }
        }

        /// <summary>
        /// Faylı diskə saxlayır. Return: absolute full path (disk I/O üçün).
        /// DB-yə yazılmır — handler relative path yaradır.
        /// </summary>
        public async Task<string> SaveFileAsync(
            IFormFile file,
            string fileName,
            string directory,
            CancellationToken cancellationToken = default)
        {
            try
            {
                var fullDirectoryPath = Path.Combine(_baseStoragePath, directory);
                if (!Directory.Exists(fullDirectoryPath))
                    Directory.CreateDirectory(fullDirectoryPath);

                var fullPath = Path.Combine(fullDirectoryPath, fileName);

                using var stream = new FileStream(fullPath, FileMode.Create);
                await file.CopyToAsync(stream, cancellationToken);

                _logger?.LogInformation("File saved successfully: {Path}", fullPath);
                return fullPath;
            }
            catch (Exception ex)
            {
                _logger?.LogError(ex, "Error saving file to storage");
                throw;
            }
        }

        public async Task<Stream> GetFileStreamAsync(
            string storagePath,
            CancellationToken cancellationToken = default)
        {
            var fullPath = ResolvePath(storagePath);

            if (!File.Exists(fullPath))
                throw new FileNotFoundException($"File not found: {storagePath}");

            var memoryStream = new MemoryStream();
            using var fileStream = new FileStream(fullPath, FileMode.Open, FileAccess.Read);
            await fileStream.CopyToAsync(memoryStream, cancellationToken);

            memoryStream.Position = 0;
            return memoryStream;
        }

        public Task DeleteFileAsync(string storagePath, CancellationToken cancellationToken = default)
        {
            try
            {
                var fullPath = ResolvePath(storagePath);

                if (File.Exists(fullPath))
                {
                    File.Delete(fullPath);
                    _logger?.LogInformation("File deleted: {Path}", storagePath);
                }
            }
            catch (Exception ex)
            {
                _logger?.LogError(ex, "Error deleting file: {Path}", storagePath);
                throw;
            }

            return Task.CompletedTask;
        }

        public Task<bool> FileExistsAsync(string storagePath, CancellationToken cancellationToken = default)
        {
            var fullPath = ResolvePath(storagePath);
            return Task.FromResult(File.Exists(fullPath));
        }

        public Task<long> GetFileSizeAsync(string storagePath, CancellationToken cancellationToken = default)
        {
            var fullPath = ResolvePath(storagePath);

            if (!File.Exists(fullPath))
                throw new FileNotFoundException($"File not found: {storagePath}");

            return Task.FromResult(new FileInfo(fullPath).Length);
        }

        /// <summary>
        /// Relative path → absolute disk path. Əgər path artıq absolute-dirsa (köhnə data), olduğu kimi qaytarır.
        /// </summary>
        private string ResolvePath(string storagePath)
        {
            if (Path.IsPathRooted(storagePath))
                return storagePath;

            return Path.Combine(_baseStoragePath, storagePath);
        }
    }
}
