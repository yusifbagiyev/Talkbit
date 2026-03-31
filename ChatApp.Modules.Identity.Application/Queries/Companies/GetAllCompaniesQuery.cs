using ChatApp.Modules.Identity.Application.DTOs.Responses;
using ChatApp.Modules.Identity.Application.Interfaces;
using ChatApp.Shared.Kernel.Common;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace ChatApp.Modules.Identity.Application.Queries.Companies
{
    /// <summary>
    /// Bütün şirkətlərin səhifələnmiş siyahısı — yalnız SuperAdmin.
    /// </summary>
    public record GetAllCompaniesQuery(
        int PageNumber = 1,
        int PageSize = 20,
        string? SearchTerm = null,
        bool? IsActive = null
    ) : IRequest<Result<PagedResult<CompanyDto>>>;

    public class GetAllCompaniesQueryHandler(
        IUnitOfWork unitOfWork,
        ILogger<GetAllCompaniesQueryHandler> logger)
        : IRequestHandler<GetAllCompaniesQuery, Result<PagedResult<CompanyDto>>>
    {
        private const int MaxPageSize = 50;

        public async Task<Result<PagedResult<CompanyDto>>> Handle(
            GetAllCompaniesQuery query,
            CancellationToken cancellationToken = default)
        {
            try
            {
                var pageSize = Math.Min(query.PageSize, MaxPageSize);
                var skip = (query.PageNumber - 1) * pageSize;

                var companiesQuery = unitOfWork.Companies.AsNoTracking().AsQueryable();

                // Aktiv/deaktiv filtr
                if (query.IsActive.HasValue)
                    companiesQuery = companiesQuery.Where(c => c.IsActive == query.IsActive.Value);

                // Axtarış
                if (!string.IsNullOrWhiteSpace(query.SearchTerm))
                {
                    var term = query.SearchTerm.ToLower();
                    companiesQuery = companiesQuery.Where(c => c.Name.ToLower().Contains(term));
                }

                var totalCount = await companiesQuery.CountAsync(cancellationToken);

                var companies = await companiesQuery
                    .OrderBy(c => c.Name)
                    .Skip(skip)
                    .Take(pageSize)
                    .Select(c => new CompanyDto(
                        c.Id,
                        c.Name,
                        c.LogoUrl,
                        c.Description,
                        c.IsActive,
                        c.Users.Count(u => u.IsActive),
                        c.HeadOfCompany != null ? c.HeadOfCompany.FirstName + " " + c.HeadOfCompany.LastName : null,
                        c.CreatedAtUtc))
                    .ToListAsync(cancellationToken);

                var result = companies.Select(c => c with { LogoUrl = FileUrlHelper.ToAvatarUrl(c.LogoUrl) }).ToList();
                return Result.Success(PagedResult<CompanyDto>.Create(result, query.PageNumber, pageSize, totalCount));
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error retrieving companies list");
                return Result.Failure<PagedResult<CompanyDto>>("An error occurred while retrieving companies");
            }
        }
    }
}
