using ChatApp.Modules.Identity.Domain.Constants;
using ChatApp.Modules.Identity.Domain.Enums;
using ChatApp.Shared.Kernel.Common;

namespace ChatApp.Modules.Identity.Domain.Entities
{
    /// <summary>
    /// User entity — sistem istifadəçilərini təmsil edir.
    /// Hər istifadəçi bir şirkətə aiddir (SuperAdmin istisna — CompanyId null ola bilər).
    /// </summary>
    public class User : Entity
    {
        // Required fields (NOT NULL)
        public string FirstName { get; private set; } = null!;
        public string LastName { get; private set; } = null!;
        public string Email { get; private set; } = null!;
        public string PasswordHash { get; private set; } = null!;
        public bool IsActive { get; private set; } = true;

        // 3 səviyyəli rol sistemi: User, Admin, SuperAdmin
        public Role Role { get; private set; } = Role.User;

        // Şirkət əlaqəsi — SuperAdmin üçün nullable
        public Guid? CompanyId { get; private set; }
        public Company? Company { get; private set; }

        // Optional fields (NULLABLE)
        public string? AvatarUrl { get; private set; }
        public DateTime? LastVisit { get; private set; }
        public DateTime? PasswordChangedAt { get; private set; }

        // Employee relationship (1:1 mandatory)
        public Employee? Employee { get; private set; }

        // Navigation properties
        private readonly List<Department> _managedDepartments = [];
        private readonly List<UserPermission> _userPermissions = [];

        public IReadOnlyCollection<Department> ManagedDepartments => _managedDepartments.AsReadOnly();
        public IReadOnlyCollection<UserPermission> UserPermissions => _userPermissions.AsReadOnly();

        public string FullName => $"{FirstName} {LastName}";

        // Private constructor for EF Core
        private User() : base() { }

        /// <summary>
        /// Creates a user with basic authentication and profile information.
        /// Employee record should be created separately.
        /// </summary>
        public User(
            string firstName,
            string lastName,
            string email,
            string passwordHash,
            Role role = Role.User,
            string? avatarUrl = null,
            Guid? companyId = null) : base()
        {
            if (string.IsNullOrWhiteSpace(firstName))
                throw new ArgumentException("First name cannot be empty", nameof(firstName));

            if (string.IsNullOrWhiteSpace(lastName))
                throw new ArgumentException("Last name cannot be empty", nameof(lastName));

            if (string.IsNullOrWhiteSpace(email))
                throw new ArgumentException("Email cannot be empty", nameof(email));

            if (string.IsNullOrWhiteSpace(passwordHash))
                throw new ArgumentException("Password hash cannot be empty", nameof(passwordHash));

            FirstName = firstName;
            LastName = lastName;
            Email = email;
            PasswordHash = passwordHash;
            Role = role;
            AvatarUrl = avatarUrl;
            CompanyId = companyId;
            IsActive = true;

            // Auto-assign default permissions based on role
            AssignDefaultPermissions();
        }

        /// <summary>
        /// Assigns default permissions based on the user's role.
        /// Called automatically during user creation.
        /// </summary>
        private void AssignDefaultPermissions()
        {
            var defaultPermissions = Permissions.GetDefaultForRole(Role);
            foreach (var permissionName in defaultPermissions)
            {
                _userPermissions.Add(new UserPermission(Id, permissionName));
            }
        }

        #region Update Methods

        public void UpdateName(string firstName, string lastName)
        {
            if (string.IsNullOrWhiteSpace(firstName))
                throw new ArgumentException("First name cannot be empty", nameof(firstName));

            if (string.IsNullOrWhiteSpace(lastName))
                throw new ArgumentException("Last name cannot be empty", nameof(lastName));

            FirstName = firstName;
            LastName = lastName;
            UpdateTimestamp();
        }

        public void UpdateEmail(string newEmail)
        {
            if (string.IsNullOrWhiteSpace(newEmail))
                throw new ArgumentException("Email cannot be empty", nameof(newEmail));

            Email = newEmail;
            UpdateTimestamp();
        }

        public void ChangePassword(string newPasswordHash)
        {
            if (string.IsNullOrWhiteSpace(newPasswordHash))
                throw new ArgumentException("Password hash cannot be empty", nameof(newPasswordHash));

            PasswordHash = newPasswordHash;
            PasswordChangedAt = DateTime.UtcNow;
            UpdateTimestamp();
        }

        public void UpdateAvatarUrl(string? avatarUrl)
        {
            AvatarUrl = avatarUrl;
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

        public void AssignToCompany(Guid companyId)
        {
            if (companyId == Guid.Empty)
                throw new ArgumentException("Company ID cannot be empty", nameof(companyId));

            CompanyId = companyId;
            UpdateTimestamp();
        }

        public void RemoveFromCompany()
        {
            CompanyId = null;
            UpdateTimestamp();
        }

        #endregion

        #region Role and Permission Management

        public void ChangeRole(Role newRole)
        {
            Role = newRole;
            UpdateTimestamp();
        }

        public void AssignPermission(UserPermission userPermission)
        {
            if (_userPermissions.Any(up => up.PermissionName == userPermission.PermissionName))
                throw new InvalidOperationException("User already has this permission");

            _userPermissions.Add(userPermission);
            UpdateTimestamp();
        }

        public void RemovePermission(string permissionName)
        {
            var userPermission = _userPermissions.FirstOrDefault(up => up.PermissionName == permissionName);
            if (userPermission != null)
            {
                _userPermissions.Remove(userPermission);
                UpdateTimestamp();
            }
        }

        #endregion
    }
}