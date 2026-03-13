using ChatApp.Modules.Channels.Application.DTOs.Responses;
using ChatApp.Modules.Channels.Domain.Entities;
using ChatApp.Modules.Channels.Infrastructure.Persistence.Configurations;
using ChatApp.Modules.Files.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace ChatApp.Modules.Channels.Infrastructure.Persistence
{
    public class ChannelsDbContext : DbContext
    {
        public ChannelsDbContext(DbContextOptions<ChannelsDbContext> options) : base(options)
        {
        }

        // Channels tables
        public DbSet<Channel> Channels => Set<Channel>();
        public DbSet<ChannelMember> ChannelMembers => Set<ChannelMember>();
        public DbSet<ChannelMessage> ChannelMessages => Set<ChannelMessage>();
        public DbSet<ChannelMessageReaction> ChannelMessageReactions => Set<ChannelMessageReaction>();
        public DbSet<ChannelMessageRead> ChannelMessageReads => Set<ChannelMessageRead>();
        public DbSet<ChannelMessageMention> ChannelMessageMentions => Set<ChannelMessageMention>();
        public DbSet<UserFavoriteChannelMessage> UserFavoriteChannelMessages => Set<UserFavoriteChannelMessage>();

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // Apply Channels module configurations
            modelBuilder.ApplyConfiguration(new ChannelConfiguration());
            modelBuilder.ApplyConfiguration(new ChannelMemberConfiguration());
            modelBuilder.ApplyConfiguration(new ChannelMessageConfiguration());
            modelBuilder.ApplyConfiguration(new ChannelMessageReactionConfiguration());
            modelBuilder.ApplyConfiguration(new ChannelMessageReadConfiguration());
            modelBuilder.ApplyConfiguration(new ChannelMessageMentionConfiguration());
            modelBuilder.ApplyConfiguration(new UserFavoriteChannelMessageConfiguration());

            // Map Identity module's users table (read-only for queries)
            // This allows us to join with users without creating dependency on Identity module
            modelBuilder.Entity<UserReadModel>(entity =>
            {
                entity.ToTable("users"); // Identity module's table
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Id).HasColumnName("id");
                entity.Property(e => e.FirstName).HasColumnName("first_name");
                entity.Property(e => e.LastName).HasColumnName("last_name");
                entity.Property(e => e.Email).HasColumnName("email");
                entity.Property(e => e.AvatarUrl).HasColumnName("avatar_url");

                // Ignore computed property
                entity.Ignore(e => e.FullName);

                // Mark as query-only (no tracking, no inserts/updates)
                // EF Core migrations yaratdıqda users cədvəlini yenidən yaratmağa cəhd edər və bu, ya xətaya, ya da təkrarlanan cədvəl yaranmasına səbəb olar.
                entity.ToTable(tb => tb.ExcludeFromMigrations());
            });

            // Map Files module's file_metadata table (read-only for queries)
            // This allows us to join with files without creating dependency on Files module
            modelBuilder.Entity<FileMetadata>(entity =>
            {
                entity.ToTable("file_metadata"); // Files module's table
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