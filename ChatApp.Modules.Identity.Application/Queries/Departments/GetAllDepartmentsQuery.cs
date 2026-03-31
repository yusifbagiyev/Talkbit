using ChatApp.Modules.Identity.Application.DTOs.Responses;
using ChatApp.Modules.Identity.Application.Interfaces;
using ChatApp.Shared.Kernel.Common;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace ChatApp.Modules.Identity.Application.Queries.Departments
{
    public record GetAllDepartmentsQuery(
        Guid? CompanyId,
        bool IsSuperAdmin) : IRequest<Result<IEnumerable<DepartmentDto>>>;

    public class GetAllDepartmentsQueryHandler(
        IUnitOfWork unitOfWork,
        ILogger<GetAllDepartmentsQueryHandler> logger) : IRequestHandler<GetAllDepartmentsQuery, Result<IEnumerable<DepartmentDto>>>
    {
        public async Task<Result<IEnumerable<DepartmentDto>>> Handle(
            GetAllDepartmentsQuery query,
            CancellationToken cancellationToken)
        {
            try
            {
                var departments = await unitOfWork.Departments
                    .Where(d => query.IsSuperAdmin || d.CompanyId == query.CompanyId)
                    .Select(d => new DepartmentDto(
                        d.Id,
                        d.CompanyId,
                        d.Name,
                        d.ParentDepartmentId,
                        d.ParentDepartment != null ? d.ParentDepartment.Name : null,
                        d.HeadOfDepartmentId,
                        d.HeadOfDepartment != null ? d.HeadOfDepartment.FullName : null,
                        d.AvatarUrl,
                        d.CreatedAtUtc))
                    .AsNoTracking()
                    .ToListAsync(cancellationToken);

                var result = departments.Select(d => d with { AvatarUrl = FileUrlHelper.ToAvatarUrl(d.AvatarUrl) }).ToList();
                return Result.Success<IEnumerable<DepartmentDto>>(result);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error retrieving all departments");
                return Result.Failure<IEnumerable<DepartmentDto>>("An error occurred while retrieving departments");
            }
        }
    }
}
