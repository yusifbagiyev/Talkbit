using ChatApp.Shared.Kernel.Common;

namespace ChatApp.Modules.Channels.Domain.Entities
{
    public class ChannelMessage : Entity
    {
        public Guid ChannelId { get; private set; }
        public Guid SenderId { get; private set; }
        public string Content { get; private set; } = null!;
        public string? FileId { get; private set; } // Reference to file service
        public bool IsEdited { get; private set; }
        public bool IsDeleted { get; private set; }
        public bool IsPinned { get; private set; }
        public DateTime? EditedAtUtc { get; private set; }
        public DateTime? DeletedAtUtc { get; private set; }
        public DateTime? PinnedAtUtc { get; private set; }
        public Guid? PinnedBy { get; private set; }
        public Guid? ReplyToMessageId { get; private set; }
        public bool IsForwarded { get; private set; }

        // Navigation properties
        public Channel Channel { get; private set; } = null!;

        private readonly List<ChannelMessageReaction> _reactions = [];
        public IReadOnlyCollection<ChannelMessageReaction> Reactions => _reactions.AsReadOnly();

        private readonly List<ChannelMessageRead> _reads = [];
        public IReadOnlyCollection<ChannelMessageRead> Reads => _reads.AsReadOnly();

        private readonly List<ChannelMessageMention> _mentions = [];
        public IReadOnlyCollection<ChannelMessageMention> Mentions => _mentions.AsReadOnly();

        private ChannelMessage() : base() { }

        public ChannelMessage(
            Guid channelId,
            Guid senderId,
            string content,
            string? fileId = null,
            Guid? replyToMessageId = null,
            bool isForwarded = false) : base()
        {
            if (string.IsNullOrWhiteSpace(content) && string.IsNullOrWhiteSpace(fileId))
                throw new ArgumentException("Message must have content or file attachment");

            if (content?.Length > 10000)
                throw new ArgumentException("Message content cannot exceed 10000 characters");

            ChannelId = channelId;
            SenderId = senderId;
            Content = content ?? string.Empty;
            FileId = fileId;
            IsEdited = false;
            IsDeleted = false;
            IsPinned = false;
            ReplyToMessageId = replyToMessageId;
            IsForwarded = isForwarded;
        }

        public void Edit(string newContent)
        {
            if (IsDeleted)
                throw new InvalidOperationException("Cannot edit deleted message");

            if (string.IsNullOrWhiteSpace(newContent))
                throw new ArgumentException("Message content cannot be empty", nameof(newContent));

            if (newContent.Length > 10000)
                throw new ArgumentException("Message content cannot exceed 10000 characters");

            // Only mark as edited if content actually changed
            if (Content == newContent)
                return;

            Content = newContent;
            IsEdited = true;
            EditedAtUtc = DateTime.UtcNow;
            UpdateTimestamp();
        }

        // message content will never change. just marked as deleted and will not show to the user
        public void Delete()
        {
            IsDeleted = true;
            DeletedAtUtc = DateTime.UtcNow;
            UpdateTimestamp();
        }

        public void Pin(Guid pinnedBy)
        {
            if (IsDeleted)
                throw new InvalidOperationException("Cannot pin deleted message");

            IsPinned = true;
            PinnedAtUtc = DateTime.UtcNow;
            PinnedBy = pinnedBy;
            UpdateTimestamp();
        }

        public void Unpin()
        {
            IsPinned = false;
            PinnedAtUtc = null;
            PinnedBy = null;
            UpdateTimestamp();
        }

        /// <summary>
        /// Toggles a reaction: removes if same emoji clicked, replaces if different emoji.
        /// User can only have ONE reaction per message (like WhatsApp/Telegram).
        /// Returns (wasAdded, addedReaction, removedReactions)
        /// </summary>
        public (bool WasAdded, ChannelMessageReaction? AddedReaction, ChannelMessageReaction? RemovedReaction) ToggleReaction(
            Guid userId,
            string reactionEmoji)
        {
            // Find user's existing reaction with the same emoji
            var existingSameReaction = _reactions.FirstOrDefault(r => r.UserId == userId && r.Reaction == reactionEmoji);

            if (existingSameReaction != null)
            {
                // Same emoji clicked - remove it (toggle off)
                _reactions.Remove(existingSameReaction);
                return (false, null, existingSameReaction);
            }
            else
            {
                // Different emoji or no reaction - remove ALL user's existing reactions first
                var userExistingReaction = _reactions.Find(r => r.UserId == userId);

                if(userExistingReaction != null)
                {
                    _reactions.Remove(userExistingReaction);
                }

                // Add new reaction
                var newReaction = new ChannelMessageReaction(Id, userId, reactionEmoji);
                _reactions.Add(newReaction);
                return (true, newReaction, userExistingReaction);
            }
        }

        /// <summary>
        /// Adds a mention to the message.
        /// </summary>
        public void AddMention(ChannelMessageMention mention)
        {
            _mentions.Add(mention);
        }
    }
}