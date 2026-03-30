using ChatApp.Modules.Identity.Application.DTOs.Responses;
using ChatApp.Modules.Identity.Application.Interfaces;
using ChatApp.Shared.Kernel.Common;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace ChatApp.Modules.Identity.Application.Queries.GetPositions
{
    public record GetAllPositionsQuery(
        Guid? CompanyId,
        bool IsSuperAdmin) : IRequest<Result<List<PositionDto>>>;

    public class GetAllPositionsQueryHandler(
        IUnitOfWork unitOfWork,
        ILogger<GetAllPositionsQueryHandler> logger) : IRequestHandler<GetAllPositionsQuery, Result<List<PositionDto>>>
    {
        public async Task<Result<List<PositionDto>>> Handle(
            GetAllPositionsQuery query,
            CancellationToken cancellationToken)
        {
            try
            {
                var positions = await unitOfWork.Positions
                    .Where(p => query.IsSuperAdmin
                        || p.Department!.CompanyId == query.CompanyId)
                    .OrderBy(p => p.Name)
                    .Select(p => new PositionDto(
                        p.Id,
                        p.Name,
                        p.Description,
                        p.DepartmentId,
                        p.Department != null ? p.Department.Name : null,
                        p.Employees.Count,
                        p.CreatedAtUtc))
                    .AsNoTracking()
                    .ToListAsync(cancellationToken);

                return Result.Success(positions);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error retrieving all positions");
                return Result.Failure<List<PositionDto>>("An error occurred while retrieving positions");
            }
        }
    }
}
