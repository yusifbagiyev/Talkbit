using ChatApp.Shared.Kernel.Common;

namespace ChatApp.Modules.DirectMessages.Domain.Entities
{
    /// <summary>
    /// Represents a message in a direct conversation
    /// </summary>
    public class DirectMessage : Entity
    {
        public Guid ConversationId { get; private set; }
        public Guid SenderId { get; private set; }
        public Guid ReceiverId { get; private set; }
        public string Content { get; private set; } = string.Empty;
        public string? FileId { get; private set; }
        public bool IsEdited { get; private set; }
        public bool IsDeleted { get; private set; }
        public bool IsRead { get; private set; }
        public DateTime? ReadAtUtc { get; private set; }
        public DateTime? EditedAtUtc {  get; private set; }
        public DateTime? DeletedAtUtc { get; private set; }
        public Guid? ReplyToMessageId { get; private set; }
        public bool IsForwarded { get; private set; }
        public bool IsPinned { get; private set; }
        public DateTime? PinnedAtUtc { get; private set; }
        public Guid? PinnedBy { get; private set; }

        // Navigation properties
        public DirectConversation Conversation { get; private set; } = null!;
        public ICollection<DirectMessageReaction> Reactions { get; private set; } = [];
        public ICollection<DirectMessageMention> Mentions { get; private set; } = [];

        private DirectMessage() { }

        public DirectMessage(
            Guid conversationId,
            Guid senderId,
            Guid receiverId,
            string content,
            string? fileId = null,
            Guid? replyToMessageId = null,
            bool isForwarded = false)
        {
            if(string.IsNullOrWhiteSpace(content) && string.IsNullOrWhiteSpace(fileId))
                throw new ArgumentException("Message must have content or file attachment");

            if (content?.Length > 10000)
                throw new ArgumentException("Message content cannot exceed 10000 characters");

            ConversationId = conversationId;
            SenderId= senderId;
            ReceiverId= receiverId;
            Content = content ?? string.Empty;
            FileId = fileId;
            IsEdited= false;
            IsDeleted= false;
            IsRead= false;
            IsPinned= false;
            ReplyToMessageId = replyToMessageId;
            IsForwarded = isForwarded;
        }


        public void Edit(string newContent)
        {
            if (IsDeleted)
                throw new InvalidOperationException("Cannot edit deleted message");

            if (string.IsNullOrWhiteSpace(newContent))
                throw new ArgumentException("Message content cannot be empty");

            if (newContent.Length > 10000)
                throw new ArgumentException("Message content cannot exceed 10000 characters");

            // Only mark as edited if content actually changed
            if (Content == newContent)
                return;

            Content=newContent;
            IsEdited= true;
            EditedAtUtc=DateTime.UtcNow;
            UpdatedAtUtc= DateTime.UtcNow;
        }


        public void Delete()
        {
            IsDeleted = true;
            DeletedAtUtc= DateTime.UtcNow;
            UpdatedAtUtc=DateTime.UtcNow;
        }


        public void MarkAsRead()
        {
            if (!IsRead)
            {
                IsRead = true;
                ReadAtUtc = DateTime.UtcNow;
                UpdatedAtUtc = DateTime.UtcNow;
            }
        }


        public void AddReaction(DirectMessageReaction reaction)
        {
            // Check if user already reacted with this emoji
            var existing=Reactions.FirstOrDefault(r=>
                r.UserId==reaction.UserId &&
                r.Reaction==reaction.Reaction);

            if (existing != null)
                throw new InvalidOperationException("User already reacted with this emoji");

            Reactions.Add(reaction);
            // Don't update UpdatedAtUtc - reactions are child entities and shouldn't modify parent
        }

        public void RemoveReaction(Guid userId,string reactionEmoji)
        {
            var reaction = Reactions.FirstOrDefault(r =>
                r.UserId == userId &&
                r.Reaction == reactionEmoji);

            if(reaction!= null)
            {
                Reactions.Remove(reaction);
                // Don't update UpdatedAtUtc - reactions are child entities and shouldn't modify parent
            }
        }

        public void Pin(Guid pinnedBy)
        {
            if (IsDeleted)
                throw new InvalidOperationException("Cannot pin deleted message");

            IsPinned = true;
            PinnedAtUtc = DateTime.UtcNow;
            PinnedBy = pinnedBy;
            UpdatedAtUtc = DateTime.UtcNow;
        }

        public void Unpin()
        {
            IsPinned = false;
            PinnedAtUtc = null;
            PinnedBy = null;
            UpdatedAtUtc = DateTime.UtcNow;
        }
    }
}