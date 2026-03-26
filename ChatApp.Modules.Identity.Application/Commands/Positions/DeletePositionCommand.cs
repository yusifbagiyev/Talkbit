using ChatApp.Modules.Identity.Application.Interfaces;
using ChatApp.Shared.Kernel.Common;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace ChatApp.Modules.Identity.Application.Commands.Positions
{
    public record DeletePositionCommand(
        Guid PositionId,
        Guid? CallerCompanyId = null,
        bool IsSuperAdmin = false) : IRequest<Result>;

    public class DeletePositionCommandHandler(
        IUnitOfWork unitOfWork,
        ILogger<DeletePositionCommandHandler> logger) : IRequestHandler<DeletePositionCommand, Result>
    {
        public async Task<Result> Handle(
            DeletePositionCommand command,
            CancellationToken cancellationToken)
        {
            try
            {
                var position = await unitOfWork.Positions
                    .Include(p => p.Employees)
                    .Include(p => p.Department)
                    .FirstOrDefaultAsync(p => p.Id == command.PositionId, cancellationToken);

                if (position == null)
                    return Result.Failure("Position not found");

                if (!command.IsSuperAdmin && position.Department?.CompanyId != command.CallerCompanyId)
                    return Result.Failure("Access denied");

                if (position.Employees.Any())
                    return Result.Failure($"Cannot delete position. {position.Employees.Count} employee(s) are currently assigned to this position");

                unitOfWork.Positions.Remove(position);
                await unitOfWork.SaveChangesAsync(cancellationToken);

                logger.LogInformation("Position {PositionId} deleted successfully", command.PositionId);
                return Result.Success();
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error deleting position {PositionId}", command.PositionId);
                return Result.Failure("An error occurred while deleting the position");
            }
        }
    }
}
