namespace ChatApp.Modules.Identity.Application.DTOs.Responses
{
    /// <summary>
    /// Şirkət siyahısı üçün qısa DTO — SuperAdmin panelində istifadə olunur.
    /// </summary>
    public record CompanyDto(
        Guid Id,
        string Name,
        string? LogoUrl,
        bool IsActive,
        int UserCount,
        string? AdminName,
        DateTime CreatedAtUtc);

    /// <summary>
    /// Şirkət detalları üçün genişləndirilmiş DTO.
    /// </summary>
    public record CompanyDetailDto(
        Guid Id,
        string Name,
        string? LogoUrl,
        string? Description,
        bool IsActive,
        Guid? HeadOfCompanyId,
        string? HeadOfCompanyName,
        int UserCount,
        int DepartmentCount,
        DateTime CreatedAtUtc,
        DateTime UpdatedAtUtc);
}
