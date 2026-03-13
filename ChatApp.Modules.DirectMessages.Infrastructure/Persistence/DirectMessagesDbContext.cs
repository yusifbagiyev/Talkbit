using ChatApp.Modules.DirectMessages.Application.DTOs.Request;
using ChatApp.Modules.DirectMessages.Domain.Entities;
using ChatApp.Modules.DirectMessages.Infrastructure.Persistence.Configurations;
using ChatApp.Modules.Files.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace ChatApp.Modules.DirectMessages.Infrastructure.Persistence
{
    public class DirectMessagesDbContext : DbContext
    {
        public DirectMessagesDbContext(DbContextOptions<DirectMessagesDbContext> options) : base(options)
        {
        }

        public DbSet<DirectConversation> DirectConversations => Set<DirectConversation>();
        public DbSet<DirectConversationMember> DirectConversationMembers => Set<DirectConversationMember>();
        public DbSet<DirectMessage> DirectMessages => Set<DirectMessage>();
        public DbSet<DirectMessageReaction> DirectMessageReactions => Set<DirectMessageReaction>();
        public DbSet<DirectMessageMention> DirectMessageMentions => Set<DirectMessageMention>();
        public DbSet<UserFavoriteMessage> UserFavoriteMessages => Set<UserFavoriteMessage>();

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // Apply DirectMessages module configurations
            modelBuilder.ApplyConfiguration(new DirectConversationConfiguration());
            modelBuilder.ApplyConfiguration(new DirectConversationMemberConfiguration());
            modelBuilder.ApplyConfiguration(new DirectMessageConfiguration());
            modelBuilder.ApplyConfiguration(new DirectMessageReactionConfiguration());
            modelBuilder.ApplyConfiguration(new DirectMessageMentionConfiguration());
            modelBuilder.ApplyConfiguration(new UserFavoriteMessageConfiguration());

            // Map Identity module's users table (read-only for queries)
            modelBuilder.Entity<UserReadModel>(entity =>
            {
                entity.ToTable("users");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.FirstName).HasColumnName("first_name");
                entity.Property(e => e.LastName).HasColumnName("last_name");
                entity.Property(e => e.Email).HasColumnName("email");
                entity.Property(e => e.AvatarUrl).HasColumnName("avatar_url");
                entity.Property(e => e.Role).HasColumnName("role");
                entity.Property(e => e.LastVisit).HasColumnName("last_visit");

                // Ignore computed properties
                entity.Ignore(e => e.FullName);
                entity.Ignore(e => e.RoleName);

                // Mark as query-only (no tracking, no inserts/updates)
                entity.ToTable(tb => tb.ExcludeFromMigrations());
            });

            // Map Identity module's employees table (read-only for queries)
            modelBuilder.Entity<EmployeeReadModel>(entity =>
            {
                entity.ToTable("employees");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.UserId).HasColumnName("user_id");
                entity.Property(e => e.PositionId).HasColumnName("position_id");

                // Mark as query-only (no tracking, no inserts/updates)
                entity.ToTable(tb => tb.ExcludeFromMigrations());
            });

            // Map Identity module's positions table (read-only for queries)
            modelBuilder.Entity<PositionReadModel>(entity =>
            {
                entity.ToTable("positions");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.Name).HasColumnName("name");

                // Mark as query-only (no tracking, no inserts/updates)
                entity.ToTable(tb => tb.ExcludeFromMigrations());
            });

            // Map Files module's file_metadata table (read-only for queries)
            modelBuilder.Entity<FileMetadata>(entity =>
            {
                entity.ToTable("file_metadata");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.OriginalFileName).HasColumnName("original_file_name");
                entity.Property(e => e.ContentType).HasColumnName("content_type");
                entity.Property(e => e.FileSizeInBytes).HasColumnName("file_size_in_bytes");
                entity.Property(e => e.StoragePath).HasColumnName("storage_path");
                entity.Property(e => e.ThumbnailPath).HasColumnName("thumbnail_path");
                entity.Property(e => e.Width).HasColumnName("width");
                entity.Property(e => e.Height).HasColumnName("height");

                // Mark as query-only (no tracking, no inserts/updates)
                entity.ToTable(tb => tb.ExcludeFromMigrations());
            });
        }
    }
}