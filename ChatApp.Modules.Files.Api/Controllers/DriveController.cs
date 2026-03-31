using ChatApp.Modules.Files.Application.Commands.UploadFile;
using ChatApp.Modules.Files.Application.DTOs.Requests;
using ChatApp.Modules.Files.Application.DTOs.Responses;
using ChatApp.Modules.Files.Application.Interfaces;
using ChatApp.Modules.Files.Domain.Entities;
using ChatApp.Shared.Infrastructure.Authorization;
using ChatApp.Shared.Kernel.Common;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using System.Security.Claims;

namespace ChatApp.Modules.Files.Api.Controllers
{
    [ApiController]
    [Route("api/drive")]
    [Authorize]
    [RequirePermission("Drive.Access")]
    public class DriveController(
        IMediator mediator,
        IUnitOfWork unitOfWork,
        IFileStorageService fileStorageService,
        ILogger<DriveController> logger) : ControllerBase
    {
        private const long DriveQuotaBytes = 3L * 1024 * 1024 * 1024; // 3GB

        // ─── Folders ────────────────────────────────────────────────────────

        [HttpGet("folders")]
        public async Task<IActionResult> GetFolders(
            [FromQuery] Guid? parentId,
            [FromQuery] string? search,
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == Guid.Empty) return Unauthorized();

            var folders = await unitOfWork.DriveFolders.GetChildrenAsync(userId, parentId, cancellationToken);

            // Hər folder üçün item count
            var dtos = new List<DriveFolderDto>();
            foreach (var f in folders)
            {
                if (!string.IsNullOrWhiteSpace(search) &&
                    !f.Name.Contains(search, StringComparison.OrdinalIgnoreCase))
                    continue;

                var itemCount = await unitOfWork.DriveFolders.GetItemCountAsync(f.Id, cancellationToken);
                dtos.Add(new DriveFolderDto(f.Id, f.Name, f.ParentFolderId, itemCount, f.CreatedAtUtc, f.UpdatedAtUtc));
            }

            return Ok(dtos);
        }

        [HttpPost("folders")]
        public async Task<IActionResult> CreateFolder(
            [FromBody] CreateFolderRequest request,
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == Guid.Empty) return Unauthorized();

            // Parent folder yoxlaması
            if (request.ParentFolderId.HasValue)
            {
                var parentExists = await unitOfWork.DriveFolders.ExistsAsync(
                    request.ParentFolderId.Value, userId, cancellationToken);
                if (!parentExists)
                    return BadRequest(new { error = "Parent folder not found" });
            }

            var (companyId, _) = GetCompanyClaims();
            var folder = new DriveFolder(request.Name, userId, companyId, request.ParentFolderId);

            await unitOfWork.DriveFolders.AddAsync(folder, cancellationToken);
            await unitOfWork.SaveChangesAsync(cancellationToken);

            return Ok(new DriveFolderDto(folder.Id, folder.Name, folder.ParentFolderId, 0,
                folder.CreatedAtUtc, folder.UpdatedAtUtc));
        }

        [HttpPut("folders/{id:guid}")]
        public async Task<IActionResult> RenameFolder(
            [FromRoute] Guid id,
            [FromBody] RenameFolderRequest request,
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == Guid.Empty) return Unauthorized();

            var folder = await unitOfWork.DriveFolders.GetByIdAsync(id, cancellationToken);
            if (folder == null || folder.OwnerId != userId)
                return NotFound(new { error = "Folder not found" });

            folder.Rename(request.Name);
            await unitOfWork.SaveChangesAsync(cancellationToken);

            return Ok(new { message = "Folder renamed" });
        }

        [HttpPut("folders/{id:guid}/move")]
        public async Task<IActionResult> MoveFolder(
            [FromRoute] Guid id,
            [FromBody] MoveRequest request,
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == Guid.Empty) return Unauthorized();

            var folder = await unitOfWork.DriveFolders.GetByIdAsync(id, cancellationToken);
            if (folder == null || folder.OwnerId != userId)
                return NotFound(new { error = "Folder not found" });

            // Öz-özünə və ya alt folder-ə köçürmə qadağandır
            if (request.TargetFolderId == id)
                return BadRequest(new { error = "Cannot move folder into itself" });

            if (request.TargetFolderId.HasValue)
            {
                var targetExists = await unitOfWork.DriveFolders.ExistsAsync(
                    request.TargetFolderId.Value, userId, cancellationToken);
                if (!targetExists)
                    return BadRequest(new { error = "Target folder not found" });

                // Alt folder-ə köçürmə yoxlaması
                var descendants = await unitOfWork.DriveFolders.GetAllDescendantsAsync(id, cancellationToken);
                if (descendants.Any(d => d.Id == request.TargetFolderId.Value))
                    return BadRequest(new { error = "Cannot move folder into its own subfolder" });
            }

            folder.MoveTo(request.TargetFolderId);
            await unitOfWork.SaveChangesAsync(cancellationToken);

            return Ok(new { message = "Folder moved" });
        }

        [HttpDelete("folders/{id:guid}")]
        public async Task<IActionResult> DeleteFolder(
            [FromRoute] Guid id,
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == Guid.Empty) return Unauthorized();

            var folder = await unitOfWork.DriveFolders.GetByIdAsync(id, cancellationToken);
            if (folder == null || folder.OwnerId != userId)
                return NotFound(new { error = "Folder not found" });

            // Recursive soft delete — folder + bütün alt folder-lər + fayllar
            var descendants = await unitOfWork.DriveFolders.GetAllDescendantsAsync(id, cancellationToken);
            var allFolders = new List<DriveFolder> { folder };
            allFolders.AddRange(descendants);

            foreach (var f in allFolders)
            {
                f.Delete();
                var files = await unitOfWork.Files.GetFilesByFolderIdAsync(f.Id, cancellationToken);
                foreach (var file in files)
                    file.Delete("drive-folder-delete");
            }

            // Root folder-dəki fayllar
            var rootFiles = await unitOfWork.Files.GetFilesByFolderIdAsync(id, cancellationToken);
            foreach (var file in rootFiles)
                file.Delete("drive-folder-delete");

            await unitOfWork.SaveChangesAsync(cancellationToken);

            return Ok(new { message = "Folder deleted" });
        }

        // ─── Files ──────────────────────────────────────────────────────────

        [HttpGet("files")]
        public async Task<IActionResult> GetFiles(
            [FromQuery] Guid? folderId,
            [FromQuery] string? sortBy,
            [FromQuery] string? sortOrder,
            [FromQuery] string? search,
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == Guid.Empty) return Unauthorized();

            var files = await unitOfWork.Files.GetDriveFilesAsync(
                userId, folderId, sortBy, sortOrder, search, cancellationToken);

            var dtos = files.Select(f => new DriveFileDto(
                f.Id, f.OriginalFileName, f.ContentType, f.FileSizeInBytes,
                f.FileType, f.FolderId, f.Width, f.Height,
                FileUrlHelper.ToServeUrl(f.Id)!,
                f.CreatedAtUtc)).ToList();

            return Ok(dtos);
        }

        [HttpPost("upload")]
        [RequestSizeLimit(100 * 1024 * 1024)]
        public async Task<IActionResult> UploadDriveFile(
            [FromForm] UploadFileRequest request,
            [FromQuery] Guid? folderId,
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == Guid.Empty) return Unauthorized();

            // Quota yoxlaması
            var currentUsage = await unitOfWork.Files.GetDriveUsageAsync(userId, cancellationToken);
            if (currentUsage + request.File.Length > DriveQuotaBytes)
                return BadRequest(new { error = "Storage quota exceeded. Limit: 3 GB" });

            // Folder yoxlaması
            if (folderId.HasValue)
            {
                var folderExists = await unitOfWork.DriveFolders.ExistsAsync(
                    folderId.Value, userId, cancellationToken);
                if (!folderExists)
                    return BadRequest(new { error = "Folder not found" });
            }

            var (companyId, companySlug) = GetCompanyClaims();

            var result = await mediator.Send(
                new UploadFileCommand(request.File, userId, companyId, companySlug),
                cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            // Drive faylı olaraq işarələ
            var fileMetadata = await unitOfWork.Files.GetByIdAsync(result.Value!.FileId, cancellationToken);
            if (fileMetadata != null)
            {
                fileMetadata.MarkAsDriveFile(folderId);
                await unitOfWork.SaveChangesAsync(cancellationToken);
            }

            return Ok(result.Value);
        }

        [HttpPut("files/{id:guid}/rename")]
        public async Task<IActionResult> RenameFile(
            [FromRoute] Guid id,
            [FromBody] RenameFileRequest request,
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == Guid.Empty) return Unauthorized();

            var file = await unitOfWork.Files.GetByIdAsync(id, cancellationToken);
            if (file == null || file.UploadedBy != userId || !file.IsDriveFile)
                return NotFound(new { error = "File not found" });

            file.RenameOriginal(request.Name);
            await unitOfWork.SaveChangesAsync(cancellationToken);

            return Ok(new { message = "File renamed" });
        }

        [HttpPut("files/{id:guid}/move")]
        public async Task<IActionResult> MoveFile(
            [FromRoute] Guid id,
            [FromBody] MoveRequest request,
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == Guid.Empty) return Unauthorized();

            var file = await unitOfWork.Files.GetByIdAsync(id, cancellationToken);
            if (file == null || file.UploadedBy != userId || !file.IsDriveFile)
                return NotFound(new { error = "File not found" });

            if (request.TargetFolderId.HasValue)
            {
                var folderExists = await unitOfWork.DriveFolders.ExistsAsync(
                    request.TargetFolderId.Value, userId, cancellationToken);
                if (!folderExists)
                    return BadRequest(new { error = "Target folder not found" });
            }

            file.MoveToFolder(request.TargetFolderId);
            await unitOfWork.SaveChangesAsync(cancellationToken);

            return Ok(new { message = "File moved" });
        }

        [HttpDelete("files/{id:guid}")]
        public async Task<IActionResult> DeleteFile(
            [FromRoute] Guid id,
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == Guid.Empty) return Unauthorized();

            var file = await unitOfWork.Files.GetByIdAsync(id, cancellationToken);
            if (file == null || file.UploadedBy != userId || !file.IsDriveFile)
                return NotFound(new { error = "File not found" });

            file.Delete("drive-user-delete");
            await unitOfWork.SaveChangesAsync(cancellationToken);

            return Ok(new { message = "File deleted" });
        }

        // ─── Recycle Bin ────────────────────────────────────────────────────

        [HttpGet("trash")]
        public async Task<IActionResult> GetTrash(CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == Guid.Empty) return Unauthorized();

            var deletedFolders = await unitOfWork.DriveFolders.GetDeletedFoldersAsync(userId, cancellationToken);
            var deletedFiles = await unitOfWork.Files.GetDeletedDriveFilesAsync(userId, cancellationToken);

            var items = new List<DriveTrashItemDto>();

            items.AddRange(deletedFolders.Select(f => new DriveTrashItemDto(
                f.Id, f.Name, "folder", null, f.DeletedAtUtc)));
            items.AddRange(deletedFiles.Select(f => new DriveTrashItemDto(
                f.Id, f.OriginalFileName, "file", f.FileSizeInBytes, f.DeletedAtUtc)));

            return Ok(items.OrderByDescending(i => i.DeletedAtUtc));
        }

        [HttpPut("trash/{id:guid}/restore")]
        public async Task<IActionResult> RestoreFromTrash(
            [FromRoute] Guid id,
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == Guid.Empty) return Unauthorized();

            // Folder-dirsə
            var folder = await unitOfWork.DriveFolders.GetByIdAsync(id, cancellationToken);
            if (folder != null && folder.OwnerId == userId && folder.IsDeleted)
            {
                folder.Restore();
                await unitOfWork.SaveChangesAsync(cancellationToken);
                return Ok(new { message = "Folder restored" });
            }

            // Fayl-dırsa
            var file = await unitOfWork.Files.GetByIdAsync(id, cancellationToken);
            if (file != null && file.UploadedBy == userId && file.IsDeleted && file.IsDriveFile)
            {
                file.Restore();
                await unitOfWork.SaveChangesAsync(cancellationToken);
                return Ok(new { message = "File restored" });
            }

            return NotFound(new { error = "Item not found in trash" });
        }

        [HttpDelete("trash/{id:guid}")]
        public async Task<IActionResult> PermanentDelete(
            [FromRoute] Guid id,
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == Guid.Empty) return Unauthorized();

            var file = await unitOfWork.Files.GetByIdAsync(id, cancellationToken);
            if (file != null && file.UploadedBy == userId && file.IsDeleted && file.IsDriveFile)
            {
                await fileStorageService.DeleteFileAsync(file.StoragePath, cancellationToken);
                await unitOfWork.Files.DeleteAsync(file, cancellationToken);
                await unitOfWork.SaveChangesAsync(cancellationToken);
                return Ok(new { message = "File permanently deleted" });
            }

            return NotFound(new { error = "Item not found in trash" });
        }

        [HttpDelete("trash")]
        public async Task<IActionResult> EmptyTrash(CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == Guid.Empty) return Unauthorized();

            var deletedFiles = await unitOfWork.Files.GetDeletedDriveFilesAsync(userId, cancellationToken);
            foreach (var file in deletedFiles)
            {
                try { await fileStorageService.DeleteFileAsync(file.StoragePath, cancellationToken); }
                catch (Exception ex) { logger.LogWarning(ex, "Failed to delete file from disk: {Path}", file.StoragePath); }
                await unitOfWork.Files.DeleteAsync(file, cancellationToken);
            }

            await unitOfWork.SaveChangesAsync(cancellationToken);
            return Ok(new { message = "Trash emptied", deletedCount = deletedFiles.Count });
        }

        // ─── Quota ──────────────────────────────────────────────────────────

        [HttpGet("quota")]
        public async Task<IActionResult> GetQuota(CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == Guid.Empty) return Unauthorized();

            var usedBytes = await unitOfWork.Files.GetDriveUsageAsync(userId, cancellationToken);
            var percentage = (int)Math.Round((double)usedBytes / DriveQuotaBytes * 100);

            return Ok(new DriveQuotaDto(
                usedBytes,
                DriveQuotaBytes,
                Math.Round(usedBytes / 1_048_576.0, 2),
                Math.Round(DriveQuotaBytes / 1_048_576.0, 2),
                Math.Min(percentage, 100)));
        }

        // ─── Helpers ────────────────────────────────────────────────────────

        private Guid GetCurrentUserId()
        {
            var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return !string.IsNullOrEmpty(claim) && Guid.TryParse(claim, out var id) ? id : Guid.Empty;
        }

        private (Guid? CompanyId, string? CompanySlug) GetCompanyClaims()
        {
            var companyIdValue = User.FindFirst("companyId")?.Value;
            Guid? companyId = Guid.TryParse(companyIdValue, out var parsed) ? parsed : null;
            var companySlug = User.FindFirst("companySlug")?.Value;
            return (companyId, string.IsNullOrEmpty(companySlug) ? null : companySlug);
        }
    }

    // Request DTOs
    public record CreateFolderRequest(string Name, Guid? ParentFolderId = null);
    public record RenameFolderRequest(string Name);
    public record RenameFileRequest(string Name);
    public record MoveRequest(Guid? TargetFolderId);
}
