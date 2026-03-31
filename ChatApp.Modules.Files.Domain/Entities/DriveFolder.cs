using ChatApp.Shared.Kernel.Common;

namespace ChatApp.Modules.Files.Domain.Entities
{
    public class DriveFolder : Entity
    {
        public string Name { get; private set; } = null!;
        public Guid OwnerId { get; private set; }
        public Guid? CompanyId { get; private set; }
        public Guid? ParentFolderId { get; private set; }
        public bool IsDeleted { get; private set; }
        public DateTime? DeletedAtUtc { get; private set; }

        // Navigation
        public DriveFolder? ParentFolder { get; private set; }
        public ICollection<DriveFolder> SubFolders { get; private set; } = [];
        public ICollection<FileMetadata> Files { get; private set; } = [];

        private DriveFolder() { }

        public DriveFolder(string name, Guid ownerId, Guid? companyId, Guid? parentFolderId = null)
        {
            if (string.IsNullOrWhiteSpace(name))
                throw new ArgumentException("Folder name cannot be empty", nameof(name));

            Name = name.Trim();
            OwnerId = ownerId;
            CompanyId = companyId;
            ParentFolderId = parentFolderId;
            IsDeleted = false;
        }

        public void Rename(string newName)
        {
            if (string.IsNullOrWhiteSpace(newName))
                throw new ArgumentException("Folder name cannot be empty", nameof(newName));

            Name = newName.Trim();
            UpdatedAtUtc = DateTime.UtcNow;
        }

        public void MoveTo(Guid? newParentFolderId)
        {
            ParentFolderId = newParentFolderId;
            UpdatedAtUtc = DateTime.UtcNow;
        }

        public void Delete()
        {
            IsDeleted = true;
            DeletedAtUtc = DateTime.UtcNow;
            UpdatedAtUtc = DateTime.UtcNow;
        }

        public void Restore()
        {
            IsDeleted = false;
            DeletedAtUtc = null;
            UpdatedAtUtc = DateTime.UtcNow;
        }
    }
}
