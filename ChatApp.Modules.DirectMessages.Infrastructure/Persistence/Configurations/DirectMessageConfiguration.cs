using ChatApp.Modules.DirectMessages.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ChatApp.Modules.DirectMessages.Infrastructure.Persistence.Configurations
{
    public class DirectMessageConfiguration : IEntityTypeConfiguration<DirectMessage>
    {
        public void Configure(EntityTypeBuilder<DirectMessage> builder)
        {
            builder.ToTable("direct_messages");

            builder.HasKey(m => m.Id);

            builder.Property(m => m.Id)
                .HasColumnName("id");

            builder.Property(m => m.ConversationId)
                .HasColumnName("conversation_id")
                .IsRequired();

            builder.Property(m => m.SenderId)
                .HasColumnName("sender_id")
                .IsRequired();

            builder.Property(m => m.ReceiverId)
                .HasColumnName("receiver_id")
                .IsRequired();

            builder.Property(m => m.Content)
                .HasColumnName("content")
                .IsRequired()
                .HasMaxLength(10000);

            builder.Property(m => m.FileId)
                .HasColumnName("file_id")
                .HasMaxLength(500);

            builder.Property(m => m.IsEdited)
                .HasColumnName("is_edited")
                .IsRequired()
                .HasDefaultValue(false);

            builder.Property(m => m.IsDeleted)
                .HasColumnName("is_deleted")
                .IsRequired()
                .HasDefaultValue(false);

            builder.Property(m => m.IsRead)
                .HasColumnName("is_read")
                .IsRequired()
                .HasDefaultValue(false);

            builder.Property(m => m.ReadAtUtc)
                .HasColumnName("read_at_utc")
                .HasColumnType("timestamp with time zone");

            builder.Property(m => m.EditedAtUtc)
                .HasColumnName("edited_at_utc")
                .HasColumnType("timestamp with time zone");

            builder.Property(m => m.DeletedAtUtc)
                .HasColumnName("deleted_at_utc")
                .HasColumnType("timestamp with time zone");

            builder.Property(m => m.CreatedAtUtc)
                .HasColumnName("created_at_utc")
                .HasColumnType("timestamp with time zone")
                .IsRequired();

            builder.Property(m => m.UpdatedAtUtc)
                .HasColumnName("updated_at_utc")
                .HasColumnType("timestamp with time zone")
                .IsRequired();

            builder.Property(m => m.ReplyToMessageId)
                .HasColumnName("reply_to_message_id");

            builder.Property(m => m.IsForwarded)
                .HasColumnName("is_forwarded")
                .IsRequired()
                .HasDefaultValue(false);

            builder.Property(m => m.IsPinned)
                .HasColumnName("is_pinned")
                .IsRequired()
                .HasDefaultValue(false);

            builder.Property(m => m.PinnedAtUtc)
                .HasColumnName("pinned_at_utc")
                .HasColumnType("timestamp with time zone");

            builder.Property(m => m.PinnedBy)
                .HasColumnName("pinned_by");

            // Indexes for performance
            builder.HasIndex(m => m.ConversationId)
                .HasDatabaseName("ix_direct_messages_conversation_id");

            builder.HasIndex(m => m.SenderId)
                .HasDatabaseName("ix_direct_messages_sender_id");

            builder.HasIndex(m => m.ReceiverId)
                .HasDatabaseName("ix_direct_messages_receiver_id");

            builder.HasIndex(m => new { m.ConversationId, m.CreatedAtUtc })
                .HasDatabaseName("ix_direct_messages_conversation_created");

            builder.HasIndex(m => new { m.ReceiverId, m.IsRead })
                .HasDatabaseName("ix_direct_messages_receiver_read");

            // Pinned messages üçün composite index (GetPinnedMessages performance)
            builder.HasIndex(m => new { m.ConversationId, m.IsPinned })
                .HasDatabaseName("ix_direct_messages_conversation_pinned");

            builder.HasIndex(m => new { m.ConversationId, m.ReceiverId, m.IsRead })
                .HasDatabaseName("ix_direct_messages_conversation_receiver_read");

            // Relationships
            builder.HasMany(m => m.Reactions)
                .WithOne(r => r.Message)
                .HasForeignKey(r => r.MessageId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}