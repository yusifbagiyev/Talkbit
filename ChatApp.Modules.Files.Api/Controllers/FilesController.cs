using ChatApp.Modules.Files.Application.Commands.DeleteFile;
using ChatApp.Modules.Files.Application.Commands.UploadFile;
using ChatApp.Modules.Files.Application.DTOs.Requests;
using ChatApp.Modules.Files.Application.DTOs.Responses;
using ChatApp.Modules.Files.Application.Interfaces;
using ChatApp.Modules.Files.Application.Queries.GetFileById;
using ChatApp.Modules.Files.Application.Queries.GetUserFiles;
using ChatApp.Shared.Infrastructure.Authorization;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using System.Security.Claims;

namespace ChatApp.Modules.Files.Api.Controllers
{
    /// <summary>
    /// Controller for file upload, download, and management
    /// </summary>
    [ApiController]
    [Route("api/files")]
    [Authorize]
    public class FilesController : ControllerBase
    {
        private readonly IMediator _mediator;
        private readonly IFileStorageService _fileStorageService;
        private readonly IUnitOfWork _unitOfWork;
        private readonly ILogger<FilesController> _logger;
        private readonly ILinkPreviewService _linkPreviewService;

        public FilesController(
            IMediator mediator,
            IFileStorageService fileStorageService,
            IUnitOfWork unitOfWork,
            ILogger<FilesController> logger,
            ILinkPreviewService linkPreviewService)
        {
            _mediator = mediator;
            _fileStorageService = fileStorageService;
            _unitOfWork = unitOfWork;
            _logger = logger;
            _linkPreviewService = linkPreviewService;
        }



        /// <summary>
        /// Upload a file
        /// </summary>
        [HttpPost("upload")]
        [RequirePermission("Files.Upload")]
        [RequestSizeLimit(100 * 1024 * 1024)] // 100 MB
        [ProducesResponseType(typeof(FileUploadResult), StatusCodes.Status201Created)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> UploadFile(
            [FromForm] UploadFileRequest request,
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == Guid.Empty)
                return Unauthorized();

            var (companyId, companySlug) = GetCompanyClaims();

            if (!companyId.HasValue || companyId == Guid.Empty)
                return BadRequest(new { error = "Company context is required for file upload" });

            var result = await _mediator.Send(
                new UploadFileCommand(
                    request.File,
                    userId,
                    companyId,
                    companySlug,
                    request.ChannelId,
                    request.ConversationId),
                cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            return CreatedAtAction(
                nameof(GetFile),
                new { fileId = result.Value!.FileId },
                result.Value);
        }



        /// <summary>
        /// Upload profile picture (auto-resized to 400x400 thumbnail)
        /// Admins can specify targetUserId to upload for other users
        /// </summary>
        [HttpPost("upload/profile-picture")]
        [RequirePermission("Avatar.Upload")]
        [RequestSizeLimit(10 * 1024 * 1024)] // 10 MB for profile pictures
        [ProducesResponseType(typeof(FileUploadResult), StatusCodes.Status201Created)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> UploadProfilePicture(
            [FromForm] UploadFileRequest request,
            [FromQuery] Guid? targetUserId,
            [FromQuery] string? currentAvatarUrl,
            CancellationToken cancellationToken)
        {
            var currentUserId = GetCurrentUserId();
            if (currentUserId == Guid.Empty)
                return Unauthorized();

            if (!request.File.ContentType.StartsWith("image/"))
                return BadRequest(new { error = "Only image files are allowed for profile pictures" });

            var uploadForUserId = targetUserId ?? currentUserId;

            if (targetUserId.HasValue && targetUserId.Value != currentUserId)
            {
                var roleClaim = User.FindFirst(ClaimTypes.Role)?.Value;
                var isAdmin = roleClaim == "Admin" || roleClaim == "SuperAdmin";

                if (!isAdmin)
                    return StatusCode(StatusCodes.Status403Forbidden, new { Error = "Only administrators can upload avatars for other users" });
            }

            // Köhnə avatar faylını sil
            if (!string.IsNullOrEmpty(currentAvatarUrl))
                await CleanupOldAvatarFileAsync(currentAvatarUrl, cancellationToken);

            var (companyId, companySlug) = GetCompanyClaims();

            var result = await _mediator.Send(
                new UploadFileCommand(
                    request.File,
                    uploadForUserId,
                    companyId,
                    companySlug,
                    null,
                    null,
                    true),  // IsProfilePicture
                cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            return CreatedAtAction(
                nameof(GetFile),
                new { fileId = result.Value!.FileId },
                result.Value);
        }




        /// <summary>
        /// Upload company avatar (stored in company/{companyId}/avatar/)
        /// SuperAdmin only
        /// </summary>
        [HttpPost("upload/company-avatar/{companyId:guid}")]
        [RequirePermission("Files.Upload")]
        [RequestSizeLimit(100 * 1024 * 1024)]
        [ProducesResponseType(typeof(FileUploadResult), StatusCodes.Status201Created)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> UploadCompanyAvatar(
            [FromRoute] Guid companyId,
            [FromForm] UploadFileRequest request,
            CancellationToken cancellationToken)
        {
            var currentUserId = GetCurrentUserId();
            if (currentUserId == Guid.Empty)
                return Unauthorized();

            if (!request.File.ContentType.StartsWith("image/"))
                return BadRequest(new { error = "Only image files are allowed for company avatars" });

            var (_, companySlug) = GetCompanyClaims();

            var result = await _mediator.Send(
                new UploadFileCommand(
                    request.File,
                    currentUserId,
                    companyId,
                    companySlug,
                    null,
                    null,
                    false,
                    false,
                    null,
                    IsCompanyAvatar: true),
                cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            return CreatedAtAction(
                nameof(GetFile),
                new { fileId = result.Value!.FileId },
                result.Value);
        }

        /// <summary>
        /// Upload department avatar (stored in company/{companyId}/departments/{departmentId}/)
        /// </summary>
        [HttpPost("upload/department-avatar/{companyId:guid}")]
        [RequirePermission("Avatar.Upload")]
        [RequestSizeLimit(10 * 1024 * 1024)]
        [ProducesResponseType(typeof(FileUploadResult), StatusCodes.Status201Created)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        public async Task<IActionResult> UploadDepartmentAvatar(
            [FromRoute] Guid companyId,
            [FromForm] UploadFileRequest request,
            [FromQuery] Guid? departmentId,
            [FromQuery] string? currentAvatarUrl,
            CancellationToken cancellationToken)
        {
            var currentUserId = GetCurrentUserId();
            if (currentUserId == Guid.Empty)
                return Unauthorized();

            if (!request.File.ContentType.StartsWith("image/"))
                return BadRequest(new { error = "Only image files are allowed for department avatars" });

            // Köhnə department avatar faylını sil
            if (!string.IsNullOrEmpty(currentAvatarUrl))
                await CleanupOldAvatarFileAsync(currentAvatarUrl, cancellationToken);

            var (_, companySlug) = GetCompanyClaims();

            var result = await _mediator.Send(
                new UploadFileCommand(
                    request.File,
                    currentUserId,
                    companyId,
                    companySlug,
                    IsDepartmentAvatar: true,
                    DepartmentId: departmentId),
                cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            return CreatedAtAction(
                nameof(GetFile),
                new { fileId = result.Value!.FileId },
                result.Value);
        }



        /// <summary>
        /// Upload channel avatar (stored in company/{companyId}/users/{userId}/avatar/)
        /// </summary>
        [HttpPost("upload/channel-avatar/{channelId:guid}")]
        [RequirePermission("Files.Upload")]
        [RequestSizeLimit(100 * 1024 * 1024)] // 100 MB for avatars
        [ProducesResponseType(typeof(FileUploadResult), StatusCodes.Status201Created)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> UploadChannelAvatar(
            [FromRoute] Guid channelId,
            [FromForm] UploadFileRequest request,
            CancellationToken cancellationToken)
        {
            var currentUserId = GetCurrentUserId();
            if (currentUserId == Guid.Empty)
                return Unauthorized();

            // Validate it's an image
            if (!request.File.ContentType.StartsWith("image/"))
            {
                return BadRequest(new { error = "Only image files are allowed for channel avatars" });
            }

            var (companyId, companySlug) = GetCompanyClaims();

            var result = await _mediator.Send(
                new UploadFileCommand(
                    request.File,
                    currentUserId,
                    companyId,
                    companySlug,
                    null,
                    null,
                    false,
                    true,  // IsChannelAvatar
                    channelId),  // ChannelAvatarTargetId
                cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            return CreatedAtAction(
                nameof(GetFile),
                new { fileId = result.Value!.FileId },
                result.Value);
        }



        /// <summary>
        /// Get file metadata by ID
        /// </summary>
        [HttpGet("{fileId:guid}")]
        [RequirePermission("Messages.Read")]
        [ProducesResponseType(typeof(FileDto), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> GetFile(
            [FromRoute] Guid fileId,
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == Guid.Empty)
                return Unauthorized();

            var result = await _mediator.Send(
                new GetFileByIdQuery(fileId, userId),
                cancellationToken);

            if (result.IsFailure)
                return Forbid();

            if (result.Value == null)
                return NotFound(new { error = $"File with ID {fileId} not found" });

            return Ok(result.Value);
        }



        /// <summary>
        /// Download a file
        /// </summary>
        [HttpGet("{fileId:guid}/download")]
        [RequirePermission("Files.Download")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> DownloadFile(
            [FromRoute] Guid fileId,
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == Guid.Empty)
                return Unauthorized();

            var fileMetadata = await _unitOfWork.Files.GetByIdAsync(fileId, cancellationToken);

            if (fileMetadata == null)
                return NotFound(new { error = $"File with ID {fileId} not found" });

            // Check if user has permission to download file (uploader, conversation participant, or channel member)
            var hasPermission = await CheckFileAccessPermissionAsync(fileId, userId, cancellationToken);

            if (!hasPermission)
            {
                _logger?.LogWarning(
                    "User {UserId} attempted to access file {FileId} without permission",
                    userId,
                    fileId);
                return Forbid();
            }

            try
            {
                var fileStream = await _fileStorageService.GetFileStreamAsync(
                    fileMetadata.StoragePath,
                    cancellationToken);

                return File(
                    fileStream,
                    fileMetadata.ContentType,
                    fileMetadata.OriginalFileName,
                    enableRangeProcessing: true);
            }
            catch (FileNotFoundException)
            {
                return NotFound(new { error = "File not found in storage" });
            }
        }



        /// <summary>
        /// Get all files uploaded by current user
        /// </summary>
        [HttpGet("my-files")]
        [RequirePermission("Messages.Read")]
        [ProducesResponseType(typeof(List<FileDto>), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> GetMyFiles(
            [FromQuery] int pageSize = 50,
            [FromQuery] int skip = 0,
            CancellationToken cancellationToken = default)
        {
            var userId = GetCurrentUserId();
            if (userId == Guid.Empty)
                return Unauthorized();

            var result = await _mediator.Send(
                new GetUserFilesQuery(userId, pageSize, skip),
                cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            return Ok(result.Value);
        }



        /// <summary>
        /// Delete a file
        /// </summary>
        [HttpDelete("{fileId:guid}")]
        [RequirePermission("Files.Delete")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        public async Task<IActionResult> DeleteFile(
            [FromRoute] Guid fileId,
            CancellationToken cancellationToken)
        {
            var userId = GetCurrentUserId();
            if (userId == Guid.Empty)
                return Unauthorized();

            var result = await _mediator.Send(
                new DeleteFileCommand(fileId, userId),
                cancellationToken);

            if (result.IsFailure)
                return BadRequest(new { error = result.Error });

            return Ok(new { message = "File deleted successfully" });
        }

        /// <summary>
        /// Get file storage statistics for a user
        /// </summary>
        [HttpGet("storage/{userId:guid}")]
        [RequirePermission("Users.Read")]
        [ProducesResponseType(typeof(UserStorageDto), StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        public async Task<IActionResult> GetUserStorageStats(
            [FromRoute] Guid userId,
            CancellationToken cancellationToken)
        {
            var (totalBytes, fileCount, imageCount, documentCount, otherCount) =
                await _unitOfWork.Files.GetStorageStatsAsync(userId, cancellationToken);

            return Ok(new UserStorageDto(
                UserId: userId,
                TotalBytes: totalBytes,
                TotalMb: Math.Round(totalBytes / 1_048_576.0, 2),
                FileCount: fileCount,
                ImageCount: imageCount,
                DocumentCount: documentCount,
                OtherCount: otherCount));
        }

        private Guid GetCurrentUserId()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

            if (string.IsNullOrEmpty(userIdClaim) || !Guid.TryParse(userIdClaim, out var userId))
            {
                return Guid.Empty;
            }

            return userId;
        }

        private (Guid? CompanyId, string? CompanySlug) GetCompanyClaims()
        {
            var companyIdValue = User.FindFirst("companyId")?.Value;
            Guid? companyId = Guid.TryParse(companyIdValue, out var parsed) ? parsed : null;
            var companySlug = User.FindFirst("companySlug")?.Value;
            return (companyId, string.IsNullOrEmpty(companySlug) ? null : companySlug);
        }


        /// <summary>
        /// Check if user has permission to access a file
        /// User has access if:
        /// 1. They uploaded the file
        /// 2. File is used in a channel they're a member of
        /// 3. File is used in a conversation they're part of
        /// </summary>
        private async Task<bool> CheckFileAccessPermissionAsync(
            Guid fileId,
            Guid userId,
            CancellationToken cancellationToken)
        {
            var file = await _unitOfWork.Files.GetByIdAsync(fileId, cancellationToken);

            if (file == null) return false;

            // Check 1: User is the uploader
            if (file.UploadedBy == userId)
                return true;

            // Check 2: File is used in a channel where user is member
            var isInChannel = await _unitOfWork.Files.IsFileUsedInUserChannelsAsync(
                fileId,
                userId,
                cancellationToken);

            if(isInChannel)
                return true;

            // Check 3: File is used in a conversation where user is participant
            var isInConversation = await _unitOfWork.Files.IsFileUsedInUserConversationsAsync(
                fileId,
                userId,
                cancellationToken);

            return isInConversation;
        }

        /// <summary>
        /// Get link preview metadata for a URL
        /// </summary>
        [HttpGet("link-preview")]
        [RequirePermission("Messages.Read")]
        public async Task<IActionResult> GetLinkPreview(
            [FromQuery] string url,
            CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(url))
                return BadRequest("URL is required");

            var preview = await _linkPreviewService.GetPreviewAsync(url, cancellationToken);
            if (preview is null)
                return NoContent();

            return Ok(preview);
        }

        /// <summary>
        /// Köhnə avatar faylını silir (disk + DB soft delete).
        /// URL-dən filename extract edilir, FileMetadata tapılır, fiziki fayl silinir.
        /// Uğursuz olsa upload-u bloklamır.
        /// </summary>
        private async Task CleanupOldAvatarFileAsync(string avatarUrl, CancellationToken cancellationToken)
        {
            try
            {
                var fileName = avatarUrl.Split('/').Last();
                if (string.IsNullOrEmpty(fileName)) return;

                var fileMetadata = await _unitOfWork.Files.GetActiveByFileNameAsync(fileName, cancellationToken);
                if (fileMetadata is null) return;

                // Soft delete (DB)
                fileMetadata.Delete("avatar-cleanup");
                await _unitOfWork.Files.UpdateAsync(fileMetadata, cancellationToken);

                // Fiziki fayl sil (disk)
                await _fileStorageService.DeleteFileAsync(fileMetadata.StoragePath, cancellationToken);

                await _unitOfWork.SaveChangesAsync(cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to cleanup old avatar file: {AvatarUrl}", avatarUrl);
            }
        }
    }

    public record UserStorageDto(
        Guid UserId,
        long TotalBytes,
        double TotalMb,
        int FileCount,
        int ImageCount,
        int DocumentCount,
        int OtherCount);
}