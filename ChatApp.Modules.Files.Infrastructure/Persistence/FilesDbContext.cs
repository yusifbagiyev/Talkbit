using ChatApp.Modules.Files.Application.DTOs.Requests;
using ChatApp.Modules.Files.Domain.Entities;
using ChatApp.Modules.Files.Infrastructure.Persistence.Configurations;
using Microsoft.EntityFrameworkCore;

namespace ChatApp.Modules.Files.Infrastructure.Persistence
{
    public class FilesDbContext:DbContext
    {
        public FilesDbContext(DbContextOptions<FilesDbContext> options):base(options)
        {
        }

        public DbSet<FileMetadata> FileMetadata=>Set<FileMetadata>();
        public DbSet<DriveFolder> DriveFolders => Set<DriveFolder>();

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // Apply Files module configurations
            modelBuilder.ApplyConfiguration(new FileMetadataConfiguration());
            modelBuilder.ApplyConfiguration(new DriveFolderConfiguration());

            // Map Identity module's users table(read only for queries)
            modelBuilder.Entity<UserReadModel>(entity =>
            {
                entity.ToTable("users");
                entity.HasKey(x => x.Id);
                entity.Property(x => x.Id).HasColumnName("id");
                entity.Property(x => x.FirstName).HasColumnName("first_name");
                entity.Property(x => x.LastName).HasColumnName("last_name");
                entity.Property(x => x.Email).HasColumnName("email");
                entity.Ignore(x => x.FullName);

                // Mark as query only
                entity.ToTable(tb => tb.ExcludeFromMigrations());
            });
        }
    }
}