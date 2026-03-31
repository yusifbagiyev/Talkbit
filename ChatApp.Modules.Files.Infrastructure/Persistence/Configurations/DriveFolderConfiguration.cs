using ChatApp.Modules.Files.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ChatApp.Modules.Files.Infrastructure.Persistence.Configurations
{
    public class DriveFolderConfiguration : IEntityTypeConfiguration<DriveFolder>
    {
        public void Configure(EntityTypeBuilder<DriveFolder> builder)
        {
            builder.ToTable("drive_folders");

            builder.HasKey(f => f.Id);

            builder.Property(f => f.Id)
                .HasColumnName("id");

            builder.Property(f => f.Name)
                .HasColumnName("name")
                .IsRequired()
                .HasMaxLength(255);

            builder.Property(f => f.OwnerId)
                .HasColumnName("owner_id")
                .IsRequired();

            builder.Property(f => f.CompanyId)
                .HasColumnName("company_id");

            builder.Property(f => f.ParentFolderId)
                .HasColumnName("parent_folder_id");

            builder.Property(f => f.IsDeleted)
                .HasColumnName("is_deleted")
                .IsRequired()
                .HasDefaultValue(false);

            builder.Property(f => f.DeletedAtUtc)
                .HasColumnName("deleted_at_utc")
                .HasColumnType("timestamp with time zone");

            builder.Property(f => f.CreatedAtUtc)
                .HasColumnName("created_at_utc")
                .HasColumnType("timestamp with time zone")
                .IsRequired();

            builder.Property(f => f.UpdatedAtUtc)
                .HasColumnName("updated_at_utc")
                .HasColumnType("timestamp with time zone")
                .IsRequired();

            // Self-referencing relationship — folder hierarchy
            builder.HasOne(f => f.ParentFolder)
                .WithMany(f => f.SubFolders)
                .HasForeignKey(f => f.ParentFolderId)
                .OnDelete(DeleteBehavior.Restrict);

            // Folder → Files relationship
            builder.HasMany(f => f.Files)
                .WithOne()
                .HasForeignKey(f => f.FolderId)
                .OnDelete(DeleteBehavior.SetNull);

            // Indexes
            builder.HasIndex(f => f.OwnerId)
                .HasDatabaseName("ix_drive_folders_owner_id");

            builder.HasIndex(f => new { f.OwnerId, f.ParentFolderId })
                .HasDatabaseName("ix_drive_folders_owner_parent");

            builder.HasIndex(f => f.IsDeleted)
                .HasDatabaseName("ix_drive_folders_is_deleted");
        }
    }
}
