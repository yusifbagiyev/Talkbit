using ChatApp.Modules.Identity.Application.DTOs.Responses;
using ChatApp.Modules.Identity.Application.Interfaces;
using ChatApp.Shared.Kernel.Common;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace ChatApp.Modules.Identity.Application.Queries.Departments
{
    public record GetDepartmentByIdQuery(
        Guid DepartmentId,
        Guid? CallerCompanyId,
        bool IsSuperAdmin) : IRequest<Result<DepartmentDto>>;

    public class GetDepartmentByIdQueryHandler(
        IUnitOfWork unitOfWork,
        ILogger<GetDepartmentByIdQueryHandler> logger) : IRequestHandler<GetDepartmentByIdQuery, Result<DepartmentDto>>
    {
        public async Task<Result<DepartmentDto>> Handle(
            GetDepartmentByIdQuery query,
            CancellationToken cancellationToken)
        {
            try
            {
                var department = await unitOfWork.Departments
                    .Where(d => d.Id == query.DepartmentId
                        && (query.IsSuperAdmin || d.CompanyId == query.CallerCompanyId))
                    .Select(d => new DepartmentDto(
                        d.Id,
                        d.Name,
                        d.ParentDepartmentId,
                        d.ParentDepartment != null ? d.ParentDepartment.Name : null,
                        d.HeadOfDepartmentId,
                        d.HeadOfDepartment != null ? d.HeadOfDepartment.FullName : null,
                        d.CreatedAtUtc))
                    .AsNoTracking()
                    .FirstOrDefaultAsync(cancellationToken);

                if (department == null)
                    return Result.Failure<DepartmentDto>("Department not found");

                return Result.Success(department);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error retrieving department {DepartmentId}", query.DepartmentId);
                return Result.Failure<DepartmentDto>("An error occurred while retrieving the department");
            }
        }
    }
}
