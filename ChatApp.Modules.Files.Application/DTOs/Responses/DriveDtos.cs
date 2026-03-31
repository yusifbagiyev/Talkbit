using ChatApp.Modules.Files.Domain.Enums;

namespace ChatApp.Modules.Files.Application.DTOs.Responses
{
    public record DriveFolderDto(
        Guid Id,
        string Name,
        Guid? ParentFolderId,
        int ItemCount,
        DateTime CreatedAtUtc,
        DateTime UpdatedAtUtc);

    public record DriveFileDto(
        Guid Id,
        string OriginalFileName,
        string ContentType,
        long FileSizeInBytes,
        FileType FileType,
        Guid? FolderId,
        int? Width,
        int? Height,
        string ServeUrl,
        DateTime CreatedAtUtc);

    public record DriveContentsDto(
        List<DriveFolderDto> Folders,
        List<DriveFileDto> Files);

    public record DriveTrashItemDto(
        Guid Id,
        string Name,
        string Type,
        long? SizeInBytes,
        DateTime? DeletedAtUtc);

    public record DriveQuotaDto(
        long UsedBytes,
        long LimitBytes,
        double UsedMb,
        double LimitMb,
        int Percentage);
}
