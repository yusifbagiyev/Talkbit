using ChatApp.Modules.Files.Domain.Enums;
using ChatApp.Shared.Kernel.Common;

namespace ChatApp.Modules.Files.Domain.Entities
{
    public class FileMetadata:Entity
    {
        public string FileName { get; private set; } = string.Empty;
        public string OriginalFileName { get; private set; }=string.Empty;
        public string ContentType { get; private set; } = string.Empty;
        public long FileSizeInBytes { get;private set; }
        public FileType FileType { get; private set; }
        public string StoragePath { get; private set; } = string.Empty;
        public Guid UploadedBy { get; private set; }
        public Guid? CompanyId { get; private set; }
        public Guid? FolderId { get; private set; }
        public bool IsDriveFile { get; private set; }
        public bool IsDeleted { get; private set; }
        public DateTime? DeletedAtUtc { get; private set; }
        public string? DeletedBy { get; private set; }


        // Optional For Image
        public int? Width { get; private set; }
        public int? Height { get; private set; }

        private FileMetadata() { }


        public FileMetadata(
            string fileName,
            string originalFileName,
            string contentType,
            long fileSizeInBytes,
            FileType fileType,
            string storagePath,
            Guid uploadedBy,
            Guid? companyId = null)
        {
            if (string.IsNullOrWhiteSpace(fileName))
                throw new ArgumentException("File name cannot be empty", nameof(fileName));

            if (string.IsNullOrWhiteSpace(originalFileName))
                throw new ArgumentException("Original file name cannot be empty", nameof(originalFileName));

            if (string.IsNullOrWhiteSpace(contentType))
                throw new ArgumentException("Content type cannot be empty", nameof(contentType));

            if (fileSizeInBytes <= 0)
                throw new ArgumentException("File size must be greater than 0", nameof(fileSizeInBytes));

            if (string.IsNullOrWhiteSpace(storagePath))
                throw new ArgumentException("Storage path cannot be empty", nameof(storagePath));

            FileName = fileName;
            OriginalFileName = originalFileName;
            ContentType = contentType;
            FileSizeInBytes = fileSizeInBytes;
            FileType = fileType;
            StoragePath = storagePath;
            UploadedBy = uploadedBy;
            CompanyId = companyId;
            IsDeleted = false;
        }


        public void SetImageDimensions(int width,int height)
        {
            if (FileType != FileType.Image)
                throw new InvalidOperationException("Cannot set dimensions for non-image files");

            Width=width;
            Height=height;
            UpdatedAtUtc=DateTime.UtcNow;
        }


        public void UpdateAfterCompression(long newFileSize, string newContentType)
        {
            if (newFileSize <= 0)
                throw new ArgumentException("File size must be greater than 0", nameof(newFileSize));
            FileSizeInBytes = newFileSize;
            ContentType = newContentType;
            UpdatedAtUtc = DateTime.UtcNow;
        }


        public void Delete(string deletedBy)
        {
            IsDeleted=true;
            DeletedAtUtc=DateTime.UtcNow;
            DeletedBy = deletedBy;
            UpdatedAtUtc= DateTime.UtcNow;
        }

        public void Restore()
        {
            IsDeleted = false;
            DeletedAtUtc = null;
            DeletedBy = null;
            UpdatedAtUtc = DateTime.UtcNow;
        }

        public void MarkAsDriveFile(Guid? folderId = null)
        {
            IsDriveFile = true;
            FolderId = folderId;
            UpdatedAtUtc = DateTime.UtcNow;
        }

        public void MoveToFolder(Guid? folderId)
        {
            FolderId = folderId;
            UpdatedAtUtc = DateTime.UtcNow;
        }

        public void RenameOriginal(string newName)
        {
            if (string.IsNullOrWhiteSpace(newName))
                throw new ArgumentException("File name cannot be empty", nameof(newName));

            OriginalFileName = newName.Trim();
            UpdatedAtUtc = DateTime.UtcNow;
        }
    }
}