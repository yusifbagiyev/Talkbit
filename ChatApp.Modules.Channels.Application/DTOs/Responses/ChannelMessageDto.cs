using ChatApp.Shared.Kernel;

namespace ChatApp.Modules.Channels.Application.DTOs.Responses
{
    public record ChannelMessageDto(
        Guid Id,
        Guid ChannelId,
        Guid SenderId,
        string SenderEmail,
        string SenderFullName,
        string? SenderAvatarUrl,
        string Content,
        string? FileId,
        string? FileName,
        string? FileContentType,
        long? FileSizeInBytes,
        string? FileUrl,           // Statik fayl URL-i (API call əvəzinə)
        string? ThumbnailUrl,      // Şəkil thumbnail URL-i
        int? FileWidth,            // Şəkil genişliyi (layout shift önləmək üçün)
        int? FileHeight,           // Şəkil hündürlüyü
        bool IsEdited,
        bool IsDeleted,
        bool IsPinned,
        int ReactionCount,
        DateTime CreatedAtUtc,
        DateTime? EditedAtUtc,
        DateTime? PinnedAtUtc,
        Guid? ReplyToMessageId,
        string? ReplyToContent,
        string? ReplyToSenderName,
        string? ReplyToFileId,
        string? ReplyToFileName,
        string? ReplyToFileContentType,
        string? ReplyToFileUrl,        // Reply mesajının fayl URL-i
        string? ReplyToThumbnailUrl,   // Reply mesajının thumbnail URL-i
        bool IsForwarded,
        int ReadByCount = 0,
        int TotalMemberCount = 0,
        List<Guid>? ReadBy = null,
        List<ChannelMessageReactionDto>? Reactions = null,
        List<ChannelMessageMentionDto>? Mentions = null,
        MessageStatus Status = MessageStatus.Sent,
        Guid? TempId = null
    );
}