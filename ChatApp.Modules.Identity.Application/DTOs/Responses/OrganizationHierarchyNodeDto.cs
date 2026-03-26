using System.Text.Json.Serialization;

namespace ChatApp.Modules.Identity.Application.DTOs.Responses
{
    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum NodeType
    {
        Department,
        User,
        Company
    }

    public record OrganizationHierarchyNodeDto(
        NodeType Type,
        Guid Id,
        string Name,
        int Level,

        // Department-specific properties
        Guid? ParentDepartmentId,
        string? HeadOfDepartmentName,
        Guid? HeadOfDepartmentId,
        int UserCount,

        // User-specific properties
        string? Email,
        string? Role,
        bool IsActive,
        string? AvatarUrl,
        string? PositionName,
        Guid? DepartmentId,
        DateTime? CreatedAtUtc,

        // Tree structure
        List<OrganizationHierarchyNodeDto> Children,

        // Supervisor & Subordinate info
        int SubordinateCount = 0,
        string? SupervisorName = null,
        bool IsDepartmentHead = false,
        Guid? CompanyId = null
    );
}
