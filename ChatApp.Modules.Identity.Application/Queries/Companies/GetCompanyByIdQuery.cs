using ChatApp.Modules.Identity.Application.DTOs.Responses;
using ChatApp.Modules.Identity.Application.Interfaces;
using ChatApp.Shared.Kernel.Common;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace ChatApp.Modules.Identity.Application.Queries.Companies
{
    public record GetCompanyByIdQuery(
        Guid CompanyId,
        Guid? CallerCompanyId,
        bool IsSuperAdmin) : IRequest<Result<CompanyDetailDto>>;

    public class GetCompanyByIdQueryHandler(
        IUnitOfWork unitOfWork,
        ILogger<GetCompanyByIdQueryHandler> logger)
        : IRequestHandler<GetCompanyByIdQuery, Result<CompanyDetailDto>>
    {
        public async Task<Result<CompanyDetailDto>> Handle(
            GetCompanyByIdQuery query,
            CancellationToken cancellationToken = default)
        {
            try
            {
                // 3 ayrı sorğu əvəzinə tək proyeksiya sorğusu ilə DB-də aggregasiya
                var result = await unitOfWork.Companies
                    .AsNoTracking()
                    .Where(c => c.Id == query.CompanyId)
                    .Select(c => new
                    {
                        c.Id, c.Name, c.LogoUrl, c.Description, c.IsActive,
                        c.HeadOfCompanyId,
                        HeadName = c.HeadOfCompany != null ? c.HeadOfCompany.FullName : null,
                        UserCount = c.Users.Count(u => u.IsActive),
                        DepartmentCount = c.Departments.Count(),
                        c.CreatedAtUtc, c.UpdatedAtUtc
                    })
                    .FirstOrDefaultAsync(cancellationToken);

                if (result is null)
                    return Result.Failure<CompanyDetailDto>("Company not found");

                if (!query.IsSuperAdmin && result.Id != query.CallerCompanyId)
                    return Result.Failure<CompanyDetailDto>("Access denied");

                return Result.Success(new CompanyDetailDto(
                    result.Id,
                    result.Name,
                    FileUrlHelper.ToAvatarUrl(result.LogoUrl),
                    result.Description,
                    result.IsActive,
                    result.HeadOfCompanyId,
                    result.HeadName,
                    result.UserCount,
                    result.DepartmentCount,
                    result.CreatedAtUtc,
                    result.UpdatedAtUtc));
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error retrieving company {CompanyId}", query.CompanyId);
                return Result.Failure<CompanyDetailDto>("An error occurred while retrieving company details");
            }
        }
    }
}
