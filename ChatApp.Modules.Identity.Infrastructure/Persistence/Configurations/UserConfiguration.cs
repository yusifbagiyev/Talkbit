using ChatApp.Modules.Identity.Domain.Entities;
using ChatApp.Modules.Identity.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ChatApp.Modules.Identity.Infrastructure.Persistence.Configurations
{
    public class UserConfiguration : IEntityTypeConfiguration<User>
    {
        public void Configure(EntityTypeBuilder<User> builder)
        {
            builder.ToTable("users");

            builder.HasKey(u => u.Id);

            builder.Property(u => u.Id)
                .HasColumnName("id");

            // Required fields
            builder.Property(u => u.FirstName)
                .IsRequired()
                .HasColumnName("first_name")
                .HasMaxLength(100);

            builder.Property(u => u.LastName)
                .IsRequired()
                .HasColumnName("last_name")
                .HasMaxLength(100);

            builder.Property(u => u.Email)
                .IsRequired()
                .HasColumnName("email")
                .HasMaxLength(255);

            builder.Property(u => u.PasswordHash)
                .IsRequired()
                .HasColumnName("password_hash")
                .HasMaxLength(255);

            builder.Property(u => u.IsActive)
                .IsRequired()
                .HasColumnName("is_active")
                .HasDefaultValue(true);

            builder.Property(u => u.Role)
                .IsRequired()
                .HasColumnName("role")
                .HasConversion<int>() // Store enum as integer
                .HasDefaultValue(Role.User);

            builder.Property(u => u.CompanyId)
                .HasColumnName("company_id");

            // Optional fields
            builder.Property(u => u.AvatarUrl)
                .HasColumnName("avatar_url")
                .HasMaxLength(500);

            builder.Property(u => u.LastVisit)
                .HasColumnName("last_visit")
                .HasColumnType("timestamp with time zone");

            builder.Property(u => u.PasswordChangedAt)
                .HasColumnName("password_changed_at")
                .HasColumnType("timestamp with time zone");

            // Timestamps
            builder.Property(u => u.CreatedAtUtc)
                .IsRequired()
                .HasColumnName("created_at_utc")
                .HasColumnType("timestamp with time zone");

            builder.Property(u => u.UpdatedAtUtc)
                .IsRequired()
                .HasColumnName("updated_at_utc")
                .HasColumnType("timestamp with time zone");

            // Computed property (not stored in database)
            builder.Ignore(u => u.FullName);

            // Indexes
            builder.HasIndex(u => u.Email)
                .IsUnique()
                .HasDatabaseName("ix_users_email");

            builder.HasIndex(u => u.IsActive)
                .HasDatabaseName("ix_users_is_active");

            builder.HasIndex(u => u.CompanyId)
                .HasDatabaseName("ix_users_company_id");

            // Relationships

            // Employee (1:1 relationship, configured from Employee side)
            // Navigation property will be populated by Employee.User relationship

            // Managed Departments (User as Head of Department)
            builder.HasMany(u => u.ManagedDepartments)
                .WithOne(d => d.HeadOfDepartment)
                .HasForeignKey(d => d.HeadOfDepartmentId)
                .OnDelete(DeleteBehavior.SetNull);

            // User Permissions
            builder.HasMany(u => u.UserPermissions)
                .WithOne(up => up.User)
                .HasForeignKey(up => up.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}
