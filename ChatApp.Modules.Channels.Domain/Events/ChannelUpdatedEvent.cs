using ChatApp.Shared.Kernel.Common;

namespace ChatApp.Modules.Channels.Domain.Events
{
    public record ChannelUpdatedEvent : DomainEvent
    {
        public Guid ChannelId { get; }
        public string Name { get; }
        public string? AvatarUrl { get; }

        public ChannelUpdatedEvent(Guid channelId, string name, string? avatarUrl)
        {
            ChannelId = channelId;
            Name = name;
            AvatarUrl = avatarUrl;
        }
    }
}
