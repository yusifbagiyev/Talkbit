namespace ChatApp.Modules.Identity.Application.DTOs.Responses
{
    public record PositionDto(
        Guid Id,
        string Name,
        string? Description,
        Guid? DepartmentId,
        string? DepartmentName,
        int UserCount,
        DateTime CreatedAtUtc);
}
