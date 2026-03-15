using ChatApp.Modules.Notifications.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ChatApp.Modules.Notifications.Infrastructure.Persistence.Configurations
{
    public class NotificationConfiguration : IEntityTypeConfiguration<Notification>
    {
        public void Configure(EntityTypeBuilder<Notification> builder)
        {
            builder.ToTable("notifications");

            builder.HasKey(n => n.Id);

            builder.Property(n => n.Id)
                .HasColumnName("id");

            builder.Property(n => n.UserId)
                .HasColumnName("user_id")
                .IsRequired();

            builder.Property(n => n.Type)
                .HasColumnName("type")
                .HasConversion<string>()
                .IsRequired()
                .HasMaxLength(50);

            builder.Property(n => n.Channel)
                .HasColumnName("channel")
                .HasConversion<string>()
                .IsRequired()
                .HasMaxLength(50);

            builder.Property(n => n.Status)
                .HasColumnName("status")
                .HasConversion<string>()
                .IsRequired()
                .HasMaxLength(50);

            builder.Property(n => n.Title)
                .HasColumnName("title")
                .IsRequired()
                .HasMaxLength(200);

            builder.Property(n => n.Message)
                .HasColumnName("message")
                .IsRequired()
                .HasMaxLength(1000);

            builder.Property(n => n.ActionUrl)
                .HasColumnName("action_url")
                .HasMaxLength(500);

            builder.Property(n => n.SourceId)
                .HasColumnName("source_id");

            builder.Property(n => n.SenderId)
                .HasColumnName("sender_id");

            builder.Property(n => n.SentAtUtc)
                .HasColumnName("sent_at_utc")
                .HasColumnType("timestamp with time zone");

            builder.Property(n => n.ReadAtUtc)
                .HasColumnName("read_at_utc")
                .HasColumnType("timestamp with time zone");

            builder.Property(n => n.ErrorMessage)
                .HasColumnName("error_message")
                .HasMaxLength(1000);

            builder.Property(n => n.RetryCount)
                .HasColumnName("retry_count")
                .IsRequired()
                .HasDefaultValue(0);

            builder.Property(n => n.CreatedAtUtc)
                .HasColumnName("created_at_utc")
                .HasColumnType("timestamp with time zone")
                .IsRequired();

            builder.Property(n => n.UpdatedAtUtc)
                .HasColumnName("updated_at_utc")
                .HasColumnType("timestamp with time zone")
                .IsRequired();

            // Indexes for performance
            builder.HasIndex(n => n.UserId)
                .HasDatabaseName("ix_notifications_user_id");

            builder.HasIndex(n => n.Status)
                .HasDatabaseName("ix_notifications_status");

            builder.HasIndex(n => new { n.UserId, n.Status })
                .HasDatabaseName("ix_notifications_user_status");

            builder.HasIndex(n => n.CreatedAtUtc)
                .HasDatabaseName("ix_notifications_created_at");

            builder.HasIndex(n => new { n.Channel, n.Status })
                .HasDatabaseName("ix_notifications_channel_status");

            // Unread notifications by user — filtered index (yalnız oxunmamış)
            builder.HasIndex(n => new { n.UserId, n.CreatedAtUtc })
                .HasFilter("status != 4") // 4 = Read
                .IsDescending(false, true)
                .HasDatabaseName("ix_notifications_userId_createdAt_unread");

            // Cleanup job üçün — köhnə oxunmuş/göndərilmiş bildirişləri tapmaq
            builder.HasIndex(n => new { n.CreatedAtUtc, n.Status })
                .HasDatabaseName("ix_notifications_created_status");
        }
    }
}