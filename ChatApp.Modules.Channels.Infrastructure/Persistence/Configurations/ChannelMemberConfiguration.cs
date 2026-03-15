using ChatApp.Modules.Channels.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ChatApp.Modules.Channels.Infrastructure.Persistence.Configurations
{
    public class ChannelMemberConfiguration : IEntityTypeConfiguration<ChannelMember>
    {
        public void Configure(EntityTypeBuilder<ChannelMember> builder)
        {
            builder.ToTable("channel_members");

            builder.HasKey(m => m.Id);

            builder.Property(m => m.Id)
                .HasColumnName("id");

            builder.Property(m => m.ChannelId)
                .HasColumnName("channel_id")
                .IsRequired();

            builder.Property(m => m.UserId)
                .HasColumnName("user_id")
                .IsRequired();

            builder.Property(m => m.Role)
                .HasColumnName("role")
                .HasConversion<string>()
                .IsRequired()
                .HasMaxLength(50);

            builder.Property(m => m.JoinedAtUtc)
                .HasColumnName("joined_at_utc")
                .HasColumnType("timestamp with time zone")
                .IsRequired();

            builder.Property(m => m.CreatedAtUtc)
                .HasColumnName("created_at_utc")
                .HasColumnType("timestamp with time zone")
                .IsRequired();

            builder.Property(m => m.UpdatedAtUtc)
                .HasColumnName("updated_at_utc")
                .HasColumnType("timestamp with time zone")
                .IsRequired();

            builder.Property(m => m.IsPinned)
                .HasColumnName("is_pinned")
                .IsRequired()
                .HasDefaultValue(false);

            builder.Property(m => m.IsMuted)
                .HasColumnName("is_muted")
                .IsRequired()
                .HasDefaultValue(false);

            builder.Property(m => m.IsMarkedReadLater)
                .HasColumnName("is_marked_read_later")
                .IsRequired()
                .HasDefaultValue(false);

            builder.Property(m => m.LastReadLaterMessageId)
                .HasColumnName("last_read_later_message_id");

            builder.Property(m => m.CanViewHistory)
                .HasColumnName("can_view_history")
                .IsRequired()
                .HasDefaultValue(true);

            // Indexes
            builder.HasIndex(m => new { m.ChannelId, m.UserId })
                .IsUnique()
                .HasDatabaseName("ix_channel_members_channel_user");

            builder.HasIndex(m => m.UserId)
                .HasDatabaseName("ix_channel_members_user_id");

            // Conversation list filter — user_id + is_hidden ilə sürətli filtr
            builder.HasIndex(m => new { m.UserId, m.IsHidden })
                .HasDatabaseName("ix_channel_members_userId_isHidden");

        }
    }
}