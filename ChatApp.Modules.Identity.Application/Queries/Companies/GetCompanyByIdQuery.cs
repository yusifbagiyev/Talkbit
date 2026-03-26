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
                var company = await unitOfWork.Companies
                    .Include(c => c.HeadOfCompany)
                    .AsNoTracking()
                    .FirstOrDefaultAsync(c => c.Id == query.CompanyId, cancellationToken);

                if (company is null)
                    return Result.Failure<CompanyDetailDto>("Company not found");

                if (!query.IsSuperAdmin && company.Id != query.CallerCompanyId)
                    return Result.Failure<CompanyDetailDto>("Access denied");

                var userCount = await unitOfWork.Users
                    .CountAsync(u => u.CompanyId == company.Id && u.IsActive, cancellationToken);
                var departmentCount = await unitOfWork.Departments
                    .CountAsync(d => d.CompanyId == company.Id, cancellationToken);

                return Result.Success(new CompanyDetailDto(
                    company.Id,
                    company.Name,
                    company.LogoUrl,
                    company.Description,
                    company.IsActive,
                    company.HeadOfCompanyId,
                    company.HeadOfCompany?.FullName,
                    userCount,
                    departmentCount,
                    company.CreatedAtUtc,
                    company.UpdatedAtUtc));
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error retrieving company {CompanyId}", query.CompanyId);
                return Result.Failure<CompanyDetailDto>("An error occurred while retrieving company details");
            }
        }
    }
}
