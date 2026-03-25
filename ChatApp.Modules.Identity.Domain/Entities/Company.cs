using ChatApp.Shared.Kernel.Common;

namespace ChatApp.Modules.Identity.Domain.Entities
{
    /// <summary>
    /// Company entity — şirkəti təmsil edir.
    /// Departamentlər şirkətə aiddir. Hər şirkətin bir rəhbəri var.
    /// Multi-company arxitekturasında tam izolyasiya təmin edir.
    /// </summary>
    public class Company : Entity
    {
        public string Name { get; private set; } = null!;
        public string? LogoUrl { get; private set; }
        public string? Description { get; private set; }
        public bool IsActive { get; private set; } = true;

        // Head of Company (User reference)
        public Guid? HeadOfCompanyId { get; private set; }
        public User? HeadOfCompany { get; private set; }

        // Navigation Properties
        private readonly List<Department> _departments = [];
        private readonly List<User> _users = [];
        public IReadOnlyCollection<Department> Departments => _departments.AsReadOnly();
        public IReadOnlyCollection<User> Users => _users.AsReadOnly();

        // Private constructor for EF Core
        private Company() : base() { }

        public Company(string name, Guid? headOfCompanyId = null, string? logoUrl = null, string? description = null) : base()
        {
            if (string.IsNullOrWhiteSpace(name))
                throw new ArgumentException("Company name cannot be empty", nameof(name));

            Name = name;
            HeadOfCompanyId = headOfCompanyId;
            LogoUrl = logoUrl;
            Description = description;
            IsActive = true;
        }

        public void UpdateName(string newName)
        {
            if (string.IsNullOrWhiteSpace(newName))
                throw new ArgumentException("Company name cannot be empty", nameof(newName));

            Name = newName;
            UpdateTimestamp();
        }

        public void UpdateLogo(string? logoUrl)
        {
            LogoUrl = logoUrl;
            UpdateTimestamp();
        }

        public void UpdateDescription(string? description)
        {
            Description = description;
            UpdateTimestamp();
        }

        public void Activate()
        {
            IsActive = true;
            UpdateTimestamp();
        }

        public void Deactivate()
        {
            IsActive = false;
            UpdateTimestamp();
        }

        public void AssignHead(Guid headOfCompanyId)
        {
            if (headOfCompanyId == Guid.Empty)
                throw new ArgumentException("Head of company ID cannot be empty", nameof(headOfCompanyId));

            HeadOfCompanyId = headOfCompanyId;
            UpdateTimestamp();
        }

        public void RemoveHead()
        {
            HeadOfCompanyId = null;
            UpdateTimestamp();
        }
    }
}