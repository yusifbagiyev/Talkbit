using ChatApp.Modules.Channels.Domain.Enums;

namespace ChatApp.Modules.Channels.Application.DTOs.Responses
{
    public record ChannelMemberDto(
        Guid Id,
        Guid ChannelId,
        Guid UserId,
        string Email,
        string FullName,
        string? AvatarUrl,
        MemberRole Role,
        DateTime JoinedAtUtc,
        Guid? LastReadLaterMessageId
    );
}