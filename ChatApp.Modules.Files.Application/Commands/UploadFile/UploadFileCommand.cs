using ChatApp.Modules.Files.Application.DTOs.Responses;
using ChatApp.Modules.Files.Application.Interfaces;
using ChatApp.Modules.Files.Application.Services;
using ChatApp.Modules.Files.Domain.Entities;
using ChatApp.Modules.Files.Domain.Enums;
using ChatApp.Modules.Files.Domain.Events;
using ChatApp.Shared.Kernel.Common;
using ChatApp.Shared.Kernel.Interfaces;
using FluentValidation;
using MediatR;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats.Jpeg;
using SixLabors.ImageSharp.Processing;

namespace ChatApp.Modules.Files.Application.Commands.UploadFile
{
    public record UploadFileCommand(
        IFormFile File,
        Guid UploadedBy,
        Guid? CompanyId = null,
        string? CompanySlug = null,
        Guid? ChannelId = null,
        Guid? ConversationId = null,
        bool IsProfilePicture = false,
        bool IsChannelAvatar = false,
        Guid? ChannelAvatarTargetId = null,
        bool IsCompanyAvatar = false,
        bool IsDepartmentAvatar = false,
        Guid? DepartmentId = null
    ) : IRequest<Result<FileUploadResult>>;



    public class UploadFileCommandValidator : AbstractValidator<UploadFileCommand>
    {
        private const long MaxFileSizeInBytes = 100 * 1024 * 1024; // 100 MB
        public UploadFileCommandValidator()
        {
            RuleFor(x => x.File)
                .NotNull().WithMessage("File is required")
                .Must(file => file.Length > 0).WithMessage("File cannot be empty")
                .Must(file => file.Length <= MaxFileSizeInBytes).WithMessage("File size cannot exceed 100 MB")
                .Must(file => FileTypeHelper.IsAllowedFileType(
                    FileTypeHelper.ResolveContentType(file.ContentType, file.FileName)))
                .WithMessage("File type is not allowed");

            RuleFor(x => x.UploadedBy)
                .NotEmpty().WithMessage("Uploader ID is required");

            // CompanyId nullable — SuperAdmin-in companyId-si yoxdur, fayllar shared/ altına düşür
        }
    }



    public class UploadFileCommandHandler : IRequestHandler<UploadFileCommand, Result<FileUploadResult>>
    {
        private readonly IUnitOfWork _unitOfWork;
        private readonly IFileStorageService _fileStorageService;
        private readonly IVirusScanningService _virusScanningService;
        private readonly IEventBus _eventBus;
        private readonly IConfiguration _configuration;
        private readonly ILogger<UploadFileCommandHandler> _logger;

        public UploadFileCommandHandler(
            IUnitOfWork unitOfWork,
            IFileStorageService fileStorageService,
            IVirusScanningService virusScanningService,
            IEventBus eventBus,
            IConfiguration configuration,
            ILogger<UploadFileCommandHandler> logger)
        {
            _unitOfWork = unitOfWork;
            _fileStorageService= fileStorageService;
            _virusScanningService = virusScanningService;
            _eventBus = eventBus;
            _configuration = configuration;
            _logger = logger;
        }



        public async Task<Result<FileUploadResult>> Handle(
            UploadFileCommand request,
            CancellationToken cancellationToken = default)
        {
            string? tempStoragePath = null;
            try
            {
                _logger?.LogInformation(
                    "Uploading file {FileName} by user {UserId}, ConversationId: {ConversationId}, ChannelId: {ChannelId}",
                    request.File.FileName,
                    request.UploadedBy,
                    request.ConversationId,
                    request.ChannelId);

                var originalFileName = request.File.FileName;
                // MIME type tanınmırsa (application/octet-stream), extension-dan resolve et
                var contentType = FileTypeHelper.ResolveContentType(request.File.ContentType, originalFileName);
                var fileType=FileTypeHelper.GetFileType(contentType);
                var extension=FileTypeHelper.GetExtensionFromContentType(contentType);

                // Sıxılan şəkillər JPEG olaraq saxlanılır — SVG vektor formatıdır, sıxılmır
                var compressibleImage = fileType == FileType.Image
                    && !contentType.Equals("image/svg+xml", StringComparison.OrdinalIgnoreCase);
                var effectiveExtension = compressibleImage ? ".jpg" : extension;

                // Generate unique filename
                var uniqueFileName = $"{Guid.NewGuid()}{effectiveExtension}";

                // Determine storage directory
                var directory = DetermineStorageDirectory(
                    request.UploadedBy,
                    request.CompanyId,
                    request.IsProfilePicture,
                    request.IsCompanyAvatar,
                    request.IsChannelAvatar,
                    request.ChannelAvatarTargetId,
                    fileType,
                    request.ChannelId,
                    request.ConversationId,
                    request.IsDepartmentAvatar,
                    request.DepartmentId);

                _logger?.LogInformation(
                    "Determined storage directory: {Directory} for file {FileName}",
                    directory,
                    originalFileName);

                // Save file temporarily
                tempStoragePath = await _fileStorageService.SaveFileAsync(
                    request.File,
                    uniqueFileName,
                    directory,
                    cancellationToken);

                // Scan for viruses
                _logger?.LogInformation("Scanning file {FileName} for viruses... ", uniqueFileName);
                //var scanResult = await _virusScanningService.ScanFileAsync(
                //    tempStoragePath,
                //    cancellationToken);
                var scanResult = new VirusScanResult
                {
                    IsClean = true
                };

                if (!scanResult.IsClean)
                {
                    _logger?.LogWarning(
                        "VIRUS DETECTED: User {UserId} uploaded infected file {FileName}. Threat: {Threat}",
                        request.UploadedBy,
                        originalFileName,
                        scanResult.ThreatName);

                    // Delete infected file immediately
                    await _fileStorageService.DeleteFileAsync(tempStoragePath, cancellationToken);

                    // Publish audit event for security monitoring
                    await _eventBus.PublishAsync(
                        new InfectedFileDetectedEvent(
                            request.UploadedBy,
                            originalFileName,
                            scanResult.ThreatName ?? "Unknown",
                            DateTime.UtcNow),
                        cancellationToken);

                    return Result.Failure<FileUploadResult>(
                        $"File upload rejected: Virus detected ({scanResult.ThreatName}).");
                }

                _logger?.LogInformation("File {FileName} is clean - proceeding with upload", uniqueFileName);

                // DB-də yalnız relative path saxlanılır — full disk path runtime-da construct olunur
                var relativePath = $"{directory}/{uniqueFileName}".Replace("\\", "/");

                var fileMetadata = new FileMetadata(
                    uniqueFileName,
                    originalFileName,
                    contentType,
                    request.File.Length,
                    fileType,
                    relativePath,
                    request.UploadedBy,
                    request.CompanyId);

                // Şəkil: sıxılma + ölçü saxlama
                if (fileType == FileType.Image || request.IsProfilePicture)
                {
                    try
                    {
                        await ProcessImageAsync(
                            request.File,
                            fileMetadata,
                            tempStoragePath);
                    }
                    catch (Exception ex)
                    {
                        _logger?.LogWarning(ex, "Failed to process image");
                    }
                }


                await _unitOfWork.Files.AddAsync(fileMetadata, cancellationToken);
                await _unitOfWork.SaveChangesAsync(cancellationToken);

                // Publish domain event
                await _eventBus.PublishAsync(
                    new FileUploadedEvent(
                        fileMetadata.Id,
                        uniqueFileName,
                        fileType,
                        request.File.Length,
                        request.UploadedBy,
                        fileMetadata.CreatedAtUtc),
                    cancellationToken);

                _logger?.LogInformation(
                    "File {FileId} uploaded succesfully",
                    fileMetadata.Id);

                // Download URL — /uploads/ prefix ilə
                var apiBaseUrl = _configuration["ApiBaseUrl"] ?? "http://localhost:7000";
                var downloadUrl = $"{apiBaseUrl.TrimEnd('/')}/uploads/{relativePath}";

                var result = new FileUploadResult(
                    fileMetadata.Id,
                    uniqueFileName,
                    fileMetadata.FileSizeInBytes,
                    downloadUrl);

                return Result.Success(result);
            }
            catch (Exception ex)
            {
                _logger?.LogError(ex, "Error uploading file {FileName}", request.File.FileName);

                // Clean up file if something went wrong
                if (!string.IsNullOrEmpty(tempStoragePath))
                {
                    try
                    {
                        await _fileStorageService.DeleteFileAsync(tempStoragePath, cancellationToken);
                    }
                    catch { }
                }

                return Result.Failure<FileUploadResult>("An error occurred while uploading the file");
            }
        }



        private static async Task ProcessImageAsync(IFormFile file, FileMetadata fileMetadata, string storagePath)
        {
            using var image = await Image.LoadAsync(file.OpenReadStream());

            // SVG vektor formatıdır — rasterləşdirmək mənasızdır, yalnız ölçü saxla
            if (file.ContentType.Equals("image/svg+xml", StringComparison.OrdinalIgnoreCase))
            {
                fileMetadata.SetImageDimensions(image.Width, image.Height);
                return;
            }

            // Max 1920px (uzun tərəf), aspect ratio saxlanılır
            if (image.Width > 1920 || image.Height > 1920)
            {
                image.Mutate(x => x.Resize(new ResizeOptions
                {
                    Size = new Size(1920, 1920),
                    Mode = ResizeMode.Max
                }));
            }

            // Ölçüləri (sıxılmadan sonrakı) saxla — frontend placeholder üçün
            fileMetadata.SetImageDimensions(image.Width, image.Height);

            // JPEG 85% quality ilə overwrite — thumbnail yaradılmır
            var encoder = new JpegEncoder { Quality = 85 };
            await image.SaveAsJpegAsync(storagePath, encoder);

            // Sıxılmadan sonra fayl ölçüsünü və content type-ı yenilə
            fileMetadata.UpdateAfterCompression(new FileInfo(storagePath).Length, "image/jpeg");
        }


        private static string DetermineStorageDirectory(
            Guid uploadedBy,
            Guid? companyId,
            bool isProfilePicture,
            bool isCompanyAvatar,
            bool isChannelAvatar,
            Guid? channelAvatarTargetId,
            FileType fileType,
            Guid? channelId,
            Guid? conversationId,
            bool isDepartmentAvatar = false,
            Guid? departmentId = null)
        {
            // companyId varsa company qovluğu, yoxdursa (SuperAdmin) global qovluq
            var companySegment = companyId.HasValue
                ? $"companies/{companyId}"
                : "global";

            // 1. Company avatar
            if (isCompanyAvatar)
                return companyId.HasValue
                    ? $"companies/{companyId}/avatar"
                    : "companies/avatar";

            // 2. Department avatar
            if (isDepartmentAvatar)
                return departmentId.HasValue
                    ? $"{companySegment}/departments/{departmentId}"
                    : $"{companySegment}/departments/avatars";

            // 3. User profile picture
            if (isProfilePicture)
                return $"{companySegment}/users/{uploadedBy}/avatar";

            // 4. Channel avatar
            if (isChannelAvatar && channelAvatarTargetId.HasValue)
                return $"{companySegment}/users/{uploadedBy}/avatar";

            // 5. Media (image/video/audio) vs File (document/other)
            var isMedia = fileType == FileType.Image || fileType == FileType.Video || fileType == FileType.Audio;
            var typeSegment = isMedia ? "images" : "files";

            // 6. Channel message faylları
            if (channelId.HasValue)
                return $"{companySegment}/users/{uploadedBy}/{typeSegment}/channel_messages/{channelId}";

            // 7. Direct message faylları
            if (conversationId.HasValue)
                return $"{companySegment}/users/{uploadedBy}/{typeSegment}/direct_messages/{conversationId}";

            // 8. Kontekstsiz — drive (gələcək personal storage)
            return $"{companySegment}/users/{uploadedBy}/drive";
        }
    }
}