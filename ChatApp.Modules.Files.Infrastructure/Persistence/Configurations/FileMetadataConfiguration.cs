using ChatApp.Modules.Files.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ChatApp.Modules.Files.Infrastructure.Persistence.Configurations
{
    public class FileMetadataConfiguration:IEntityTypeConfiguration<FileMetadata>
    {
        public void Configure(EntityTypeBuilder<FileMetadata> builder)
        {
            builder.ToTable("file_metadata");

            builder.HasKey(f => f.Id);

            builder.Property(f => f.Id)
                .HasColumnName("id");

            builder.Property(f => f.FileName)
                .HasColumnName("filename")
                .IsRequired()
                .HasMaxLength(500);

            builder.Property(f => f.OriginalFileName)
                .HasColumnName("original_file_name")
                .IsRequired()
                .HasMaxLength(500);

            builder.Property(f => f.ContentType)
                .HasColumnName("content_type")
                .IsRequired()
                .HasMaxLength(200);

            builder.Property(f => f.FileSizeInBytes)
                .HasColumnName("file_size_in_bytes")
                .IsRequired();

            builder.Property(f => f.FileType)
                .HasColumnName("file_type")
                .HasConversion<string>()
                .IsRequired()
                .HasMaxLength(50);

            builder.Property(f => f.StoragePath)
                .HasColumnName("storage_path")
                .IsRequired()
                .HasMaxLength(1000);

            builder.Property(f => f.UploadedBy)
                .HasColumnName("uploaded_by")
                .IsRequired();

            builder.Property(f => f.CompanyId)
                .HasColumnName("company_id");

            builder.Property(f => f.FolderId)
                .HasColumnName("folder_id");

            builder.Property(f => f.IsDriveFile)
                .HasColumnName("is_drive_file")
                .IsRequired()
                .HasDefaultValue(false);

            builder.Property(f => f.IsDeleted)
                .HasColumnName("is_deleted")
                .IsRequired()
                .HasDefaultValue(false);

            builder.Property(f => f.DeletedAtUtc)
                .HasColumnName("deleted_at_utc")
                .HasColumnType("timestamp with time zone");

            builder.Property(f => f.DeletedBy)
                .HasColumnName("deleted_by")
                .HasMaxLength(100);


            builder.Property(f => f.Width)
                .HasColumnName("width");


            builder.Property(f => f.Height)
                .HasColumnName("height");


            builder.Property(f => f.CreatedAtUtc)
                .HasColumnName("created_at_utc")
                .HasColumnType("timestamp with time zone")
                .IsRequired();


            builder.Property(f => f.UpdatedAtUtc)
                .HasColumnName("updated_at_utc")
                .HasColumnType("timestamp with time zone")
                .IsRequired();


            // Indexes for performance
            builder.HasIndex(f => f.UploadedBy)
                .HasDatabaseName("ix_file_metadata_uploaded_by");

            builder.HasIndex(f => f.CompanyId)
                .HasDatabaseName("ix_file_metadata_company_id");

            builder.HasIndex(f => f.FileType)
                .HasDatabaseName("ix_file_metadata_file_type");

            builder.HasIndex(f => f.CreatedAtUtc)
                .HasDatabaseName("ix_file_metadata_created_at");

            builder.HasIndex(f => f.IsDeleted)
                .HasDatabaseName("ix_file_metadata_is_deleted");

            builder.HasIndex(f => new { f.UploadedBy, f.CreatedAtUtc })
                .HasDatabaseName("ix_file_metadata_uploaded_by_created");

            builder.HasIndex(f => f.FolderId)
                .HasDatabaseName("ix_file_metadata_folder_id");

            builder.HasIndex(f => new { f.UploadedBy, f.IsDriveFile })
                .HasDatabaseName("ix_file_metadata_uploaded_by_drive");
        }
    }
}