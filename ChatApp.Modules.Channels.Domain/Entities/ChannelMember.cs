using ChatApp.Modules.Channels.Domain.Enums;
using ChatApp.Shared.Kernel.Common;

namespace ChatApp.Modules.Channels.Domain.Entities
{
    public class ChannelMember : Entity
    {
        public Guid ChannelId { get; private set; }
        public Guid UserId { get; private set; }
        public MemberRole Role { get; private set; }
        public DateTime JoinedAtUtc { get; private set; }
        public Guid? LastReadLaterMessageId { get; private set; }

        // Conversation-level preferences
        public bool IsPinned { get; private set; }
        public bool IsMuted { get; private set; }
        public bool IsMarkedReadLater { get; private set; }
        public bool IsHidden { get; private set; }
        public bool CanViewHistory { get; private set; }

        // Navigation properties
        public Channel Channel { get; private set; } = null!;

        private ChannelMember() : base() { }

        public ChannelMember(Guid channelId, Guid userId, MemberRole role, bool canViewHistory = true) : base()
        {
            ChannelId = channelId;
            UserId = userId;
            Role = role;
            JoinedAtUtc = DateTime.UtcNow;
            CanViewHistory = canViewHistory;
        }

        public void UpdateRole(MemberRole newRole)
        {
            Role = newRole;
            UpdateTimestamp();
        }

        public void MarkMessageAsLater(Guid messageId)
        {
            LastReadLaterMessageId = messageId;
            UpdateTimestamp();
        }

        public void UnmarkMessageAsLater()
        {
            LastReadLaterMessageId = null;
            UpdateTimestamp();
        }

        public void TogglePin()
        {
            IsPinned = !IsPinned;
            UpdateTimestamp();
        }

        public void ToggleMute()
        {
            IsMuted = !IsMuted;
            UpdateTimestamp();
        }

        public void MarkConversationAsReadLater()
        {
            IsMarkedReadLater = true;
            UpdateTimestamp();
        }

        public void UnmarkConversationAsReadLater()
        {
            IsMarkedReadLater = false;
            UpdateTimestamp();
        }

        public void Hide()
        {
            IsHidden = true;
            UpdateTimestamp();
        }

        public void Unhide()
        {
            IsHidden = false;
            UpdateTimestamp();
        }
    }
}