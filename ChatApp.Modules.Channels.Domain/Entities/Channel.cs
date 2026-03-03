using ChatApp.Modules.Channels.Domain.Enums;
using ChatApp.Shared.Kernel.Common;

namespace ChatApp.Modules.Channels.Domain.Entities
{
    public class Channel : Entity
    {
        public string Name { get; private set; } = null!;
        public string? Description { get; private set; }
        public ChannelType Type { get; private set; }
        public Guid CreatedBy { get; private set; }
        public string? AvatarUrl { get; private set; }

        // Navigation properties
        private readonly List<ChannelMember> _members = [];
        public IReadOnlyCollection<ChannelMember> Members => _members.AsReadOnly();

        private readonly List<ChannelMessage> _messages = [];
        public IReadOnlyCollection<ChannelMessage> Messages => _messages.AsReadOnly();

        private Channel() : base() { }

        public Channel(
            string name,
            string? description,
            ChannelType type,
            Guid createdBy) : base()
        {
            if (string.IsNullOrWhiteSpace(name))
                throw new ArgumentException("Channel name cannot be empty", nameof(name));

            if (name.Length > 100)
                throw new ArgumentException("Channel name cannot exceed 100 characters", nameof(name));

            Name = name;
            Description = description;
            Type = type;
            CreatedBy = createdBy;

            // Creator automatically becomes owner
            var ownerMember = new ChannelMember(Id, createdBy, MemberRole.Owner);
            _members.Add(ownerMember);
        }

        public void UpdateName(string newName)
        {
            if (string.IsNullOrWhiteSpace(newName))
                throw new ArgumentException("Channel name cannot be empty", nameof(newName));

            if (newName.Length > 100)
                throw new ArgumentException("Channel name cannot exceed 100 characters", nameof(newName));

            Name = newName;
            UpdateTimestamp();
        }

        public void UpdateDescription(string? newDescription)
        {
            if (newDescription?.Length > 500)
                throw new ArgumentException("Description cannot exceed 500 characters", nameof(newDescription));

            Description = newDescription;
            UpdateTimestamp();
        }

        public void UpdateAvatarUrl(string? avatarUrl)
        {
            AvatarUrl = avatarUrl;
            UpdateTimestamp();
        }

        public void ChangeType(ChannelType newType)
        {
            Type = newType;
            UpdateTimestamp();
        }

        /// <summary>
        /// Üzv əlavə etmə qaydalarını yoxlayır — entity dəyişdirmədən.
        /// </summary>
        public void ValidateAddMember(Guid userId, Guid addedByUserId)
        {
            if (Type == ChannelType.Private)
            {
                var addedBy = _members.FirstOrDefault(m => m.UserId == addedByUserId);
                if (addedBy == null || (addedBy.Role != MemberRole.Admin && addedBy.Role != MemberRole.Owner))
                    throw new InvalidOperationException("Only Admin or Owner can add members to a private channel");
            }

            if (_members.Any(m => m.UserId == userId))
                throw new InvalidOperationException("User is already a member of this channel");
        }

        public void RemoveMember(Guid userId)
        {
            var member = _members.FirstOrDefault(m => m.UserId == userId)
                ?? throw new InvalidOperationException("User is not a member of this channel");

            if (member.Role == MemberRole.Owner)
                throw new InvalidOperationException("Cannot remove channel owner");

            _members.Remove(member);
            UpdateTimestamp();
        }

        public void UpdateMemberRole(Guid userId, MemberRole newRole)
        {
            var member = _members.FirstOrDefault(m => m.UserId == userId) 
                ?? throw new InvalidOperationException("User is not a member of this channel");

            if (member.Role == MemberRole.Owner && newRole != MemberRole.Owner)
                throw new InvalidOperationException("Cannot change owner role. Transfer ownership first.");

            member.UpdateRole(newRole);
            UpdateTimestamp();
        }

        public void TransferOwnership(Guid currentOwnerId, Guid newOwnerId)
        {
            var currentOwner = _members.FirstOrDefault(m => m.UserId == currentOwnerId && m.Role == MemberRole.Owner) 
                ?? throw new InvalidOperationException("Current owner not found");

            var newOwner = _members.FirstOrDefault(m => m.UserId == newOwnerId)
                ?? throw new InvalidOperationException("New owner must be a member of the channel");

            currentOwner.UpdateRole(MemberRole.Admin);
            newOwner.UpdateRole(MemberRole.Owner);
            UpdateTimestamp();
        }

        public bool UserHasAccessToChannel(Guid userId)
        {
            return _members.Any(m => m.UserId == userId);
        }
    }
}