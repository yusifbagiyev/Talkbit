using ChatApp.Shared.Kernel;

namespace ChatApp.Modules.DirectMessages.Application.DTOs.Response
{
    public record DirectMessageDto(
        Guid Id,
        Guid ConversationId,
        Guid SenderId,
        string SenderEmail,
        string SenderFullName,
        string? SenderAvatarUrl,
        Guid ReceiverId,
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
        bool IsRead,
        DateTime? ReadAtUtc,
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
        List<DirectMessageReactionDto>? Reactions = null,
        List<MessageMentionDto>? Mentions = null,
        MessageStatus Status = MessageStatus.Sent,
        Guid? TempId = null);

    public record DirectMessageReactionDto(
        string Emoji,
        int Count,
        List<Guid> UserIds);

    public record MessageMentionDto(
        Guid UserId,
        string UserFullName);
}