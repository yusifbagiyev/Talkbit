using ChatApp.Modules.DirectMessages.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ChatApp.Modules.DirectMessages.Infrastructure.Persistence.Configurations
{
    public class DirectConversationMemberConfiguration : IEntityTypeConfiguration<DirectConversationMember>
    {
        public void Configure(EntityTypeBuilder<DirectConversationMember> builder)
        {
            builder.ToTable("direct_conversation_members");

            builder.HasKey(m => m.Id);

            builder.Property(m => m.Id)
                .HasColumnName("id");

            builder.Property(m => m.ConversationId)
                .IsRequired()
                .HasColumnName("conversation_id");

            builder.Property(m => m.UserId)
                .IsRequired()
                .HasColumnName("user_id");

            builder.Property(m => m.IsActive)
                .IsRequired()
                .HasDefaultValue(true)
                .HasColumnName("is_active");

            builder.Property(m => m.IsPinned)
                .IsRequired()
                .HasDefaultValue(false)
                .HasColumnName("is_pinned");

            builder.Property(m => m.IsMuted)
                .IsRequired()
                .HasDefaultValue(false)
                .HasColumnName("is_muted");

            builder.Property(m => m.IsMarkedReadLater)
                .IsRequired()
                .HasDefaultValue(false)
                .HasColumnName("is_marked_read_later");

            builder.Property(m => m.LastReadLaterMessageId)
                .IsRequired(false)
                .HasColumnName("last_read_later_message_id");

            builder.Property(m => m.IsHidden)
                .IsRequired()
                .HasDefaultValue(false)
                .HasColumnName("is_hidden");

            // Indexes
            builder.HasIndex(m => new { m.ConversationId, m.UserId })
                .IsUnique();

            builder.HasIndex(m => m.UserId);

            builder.HasIndex(m => new { m.UserId, m.IsActive });

            // Conversation list filter — user_id + is_active + is_hidden ilə sürətli filtr
            builder.HasIndex(m => new { m.UserId, m.IsActive, m.IsHidden })
                .HasDatabaseName("ix_dm_members_userId_isActive_isHidden");

            // Relationship
            builder.HasOne(m => m.Conversation)
                .WithMany(c => c.Members)
                .HasForeignKey(m => m.ConversationId)
                .OnDelete(DeleteBehavior.Cascade);

            // Timestamps
            builder.Property(m => m.CreatedAtUtc)
                .IsRequired()
                .HasColumnName("created_at_utc");

            builder.Property(m => m.UpdatedAtUtc)
                .IsRequired()
                .HasColumnName("updated_at_utc");
        }
    }
}
