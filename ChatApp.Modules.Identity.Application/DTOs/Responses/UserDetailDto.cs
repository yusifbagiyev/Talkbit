namespace ChatApp.Modules.Identity.Application.DTOs.Responses
{
    /// <summary>
    /// Complete user information for detail views and profile pages
    /// Includes all user data, organizational structure, and permissions
    /// </summary>
    /// <summary>
    /// İstifadəçi detalları. Role field-indən isAdmin/isSuperAdmin derive olunur.
    /// </summary>
    public record UserDetailDto(
        Guid Id,
        string FirstName,
        string LastName,
        string Email,
        string Role,
        string? Position,
        Guid? PositionId,
        string? AvatarUrl,
        string? AboutMe,
        DateTime? DateOfBirth,
        string? WorkPhone,
        DateTime? HiringDate,
        DateTime? LastVisit,
        bool IsActive,
        Guid? DepartmentId,
        string? DepartmentName,
        Guid? SupervisorId,
        string? SupervisorName,
        string? SupervisorAvatarUrl,
        string? SupervisorPosition,
        bool IsHeadOfDepartment,
        string? HeadOfDepartmentName,
        List<SubordinateDto> Subordinates,
        List<string> Permissions,
        DateTime CreatedAtUtc,
        DateTime UpdatedAtUtc,
        DateTime? PasswordChangedAt)
    {
        public string FullName => $"{FirstName} {LastName}";
    };

    public record SubordinateDto(
        Guid Id,
        string FullName,
        string? Position,
        string? AvatarUrl,
        bool IsActive);
}