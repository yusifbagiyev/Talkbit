using ChatApp.Modules.Channels.Domain.Enums;

namespace ChatApp.Modules.Channels.Application.DTOs.Responses
{
    public record SharedChannelDto(
        Guid Id,
        string Name,
        string? AvatarUrl,
        ChannelType Type,
        DateTime? LastMessageAtUtc
    );
}
