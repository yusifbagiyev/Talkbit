using ChatApp.Modules.Identity.Application.DTOs.Responses;
using ChatApp.Modules.Identity.Application.Interfaces;
using ChatApp.Shared.Kernel.Common;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace ChatApp.Modules.Identity.Application.Queries.GetPositions
{
    public record GetPositionsByDepartmentQuery(
        Guid DepartmentId,
        Guid? CallerCompanyId,
        bool IsSuperAdmin) : IRequest<Result<List<PositionDto>>>;

    public class GetPositionsByDepartmentQueryHandler(
        IUnitOfWork unitOfWork,
        ILogger<GetPositionsByDepartmentQueryHandler> logger) : IRequestHandler<GetPositionsByDepartmentQuery, Result<List<PositionDto>>>
    {
        public async Task<Result<List<PositionDto>>> Handle(
            GetPositionsByDepartmentQuery query,
            CancellationToken cancellationToken)
        {
            try
            {
                var deptCompanyId = await unitOfWork.Departments
                    .Where(d => d.Id == query.DepartmentId)
                    .Select(d => (Guid?)d.CompanyId)
                    .FirstOrDefaultAsync(cancellationToken);

                if (deptCompanyId == null)
                    return Result.Failure<List<PositionDto>>("Department not found");

                if (!query.IsSuperAdmin && deptCompanyId != query.CallerCompanyId)
                    return Result.Failure<List<PositionDto>>("Access denied");

                var positions = await unitOfWork.Positions
                    .Where(p => p.DepartmentId == query.DepartmentId)
                    .OrderBy(p => p.Name)
                    .Select(p => new PositionDto(
                        p.Id,
                        p.Name,
                        p.Description,
                        p.DepartmentId,
                        p.Department != null ? p.Department.Name : null,
                        p.CreatedAtUtc))
                    .AsNoTracking()
                    .ToListAsync(cancellationToken);

                return Result.Success(positions);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error retrieving positions for department {DepartmentId}", query.DepartmentId);
                return Result.Failure<List<PositionDto>>("An error occurred while retrieving positions");
            }
        }
    }
}
