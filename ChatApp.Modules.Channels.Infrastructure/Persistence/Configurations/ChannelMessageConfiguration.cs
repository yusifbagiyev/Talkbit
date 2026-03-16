using ChatApp.Modules.Channels.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ChatApp.Modules.Channels.Infrastructure.Persistence.Configurations
{
    public class ChannelMessageConfiguration : IEntityTypeConfiguration<ChannelMessage>
    {
        public void Configure(EntityTypeBuilder<ChannelMessage> builder)
        {
            builder.ToTable("channel_messages");

            builder.HasKey(m => m.Id);

            builder.Property(m => m.Id)
                .HasColumnName("id");

            builder.Property(m => m.ChannelId)
                .HasColumnName("channel_id")
                .IsRequired();

            builder.Property(m => m.SenderId)
                .HasColumnName("sender_id")
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

            builder.Property(m => m.IsPinned)
                .HasColumnName("is_pinned")
                .IsRequired()
                .HasDefaultValue(false);

            builder.Property(m => m.EditedAtUtc)
                .HasColumnName("edited_at_utc")
                .HasColumnType("timestamp with time zone");

            builder.Property(m => m.DeletedAtUtc)
                .HasColumnName("deleted_at_utc")
                .HasColumnType("timestamp with time zone");

            builder.Property(m => m.PinnedAtUtc)
                .HasColumnName("pinned_at_utc")
                .HasColumnType("timestamp with time zone");

            builder.Property(m => m.PinnedBy)
                .HasColumnName("pinned_by");

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

            // Indexes for performance
            builder.HasIndex(m => m.ChannelId)
                .HasDatabaseName("ix_channel_messages_channel_id");

            builder.HasIndex(m => m.SenderId)
                .HasDatabaseName("ix_channel_messages_sender_id");

            builder.HasIndex(m => new { m.ChannelId, m.CreatedAtUtc })
                .HasDatabaseName("ix_channel_messages_channel_created");

            builder.HasIndex(m => new { m.ChannelId, m.IsPinned })
                .HasDatabaseName("ix_channel_messages_channel_pinned");

            builder.HasIndex(m => new { m.ChannelId, m.IsDeleted, m.CreatedAtUtc })
                .HasDatabaseName("ix_channel_messages_channel_deleted_created");

            // Relationships
            builder.HasMany(m => m.Reactions)
                .WithOne(r => r.Message)
                .HasForeignKey(r => r.MessageId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasMany(m => m.Reads)
                .WithOne(r => r.Message)
                .HasForeignKey(r => r.MessageId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}