namespace ChatApp.Modules.Identity.Application.DTOs.Requests
{
    public record CreateDepartmentRequest(
        string Name,
        Guid? ParentDepartmentId = null,
        Guid? CompanyId = null,
        string? AvatarUrl = null);
}
