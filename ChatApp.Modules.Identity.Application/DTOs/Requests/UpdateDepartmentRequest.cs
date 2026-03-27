namespace ChatApp.Modules.Identity.Application.DTOs.Requests
{
    public record UpdateDepartmentRequest(
        string? Name = null,
        Guid? ParentDepartmentId = null,
        string? AvatarUrl = null);
}
