using ChatApp.Modules.Identity.Application.Interfaces;
using ChatApp.Shared.Kernel.Common;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace ChatApp.Modules.Identity.Application.Commands.Departments
{
    public record RemoveDepartmentHeadCommand(
        Guid DepartmentId,
        Guid? CallerCompanyId = null,
        bool IsSuperAdmin = false) : IRequest<Result>;

    public class RemoveDepartmentHeadCommandValidator : AbstractValidator<RemoveDepartmentHeadCommand>
    {
        public RemoveDepartmentHeadCommandValidator()
        {
            RuleFor(x => x.DepartmentId)
                .NotEmpty().WithMessage("Department ID is required");
        }
    }

    public class RemoveDepartmentHeadCommandHandler(
        IUnitOfWork unitOfWork,
        ILogger<RemoveDepartmentHeadCommandHandler> logger) : IRequestHandler<RemoveDepartmentHeadCommand, Result>
    {
        public async Task<Result> Handle(
            RemoveDepartmentHeadCommand command,
            CancellationToken cancellationToken)
        {
            try
            {
                var department = await unitOfWork.Departments
                    .FirstOrDefaultAsync(d => d.Id == command.DepartmentId, cancellationToken);

                if (department == null)
                    return Result.Failure("Department not found");

                if (!command.IsSuperAdmin && department.CompanyId != command.CallerCompanyId)
                    return Result.Failure("Access denied");

                if (department.HeadOfDepartmentId == null)
                    return Result.Failure("Department does not have a head assigned");

                var previousHeadUserId = department.HeadOfDepartmentId.Value;

                // === Auto Supervisor Cleanup ===

                // 1. Remove the old head as supervisor from all their subordinates
                var oldHeadEmployee = await unitOfWork.Employees
                    .Include(e => e.SupervisorLinks)
                    .FirstOrDefaultAsync(e => e.UserId == previousHeadUserId, cancellationToken);

                if (oldHeadEmployee != null)
                {
                    // junction table-dən köhnə rəhbərin tabelilərini tap
                    var subordinateEmployeeIds = await unitOfWork.EmployeeSupervisors
                        .Where(es => es.SupervisorEmployeeId == oldHeadEmployee.Id)
                        .Select(es => es.EmployeeId)
                        .ToListAsync(cancellationToken);

                    var subordinates = await unitOfWork.Employees
                        .Include(e => e.SupervisorLinks)
                        .Where(e => subordinateEmployeeIds.Contains(e.Id))
                        .ToListAsync(cancellationToken);

                    foreach (var sub in subordinates)
                    {
                        sub.RemoveSupervisor(oldHeadEmployee.Id);
                    }

                    // 2. Remove all supervisor links from the old head (no longer a department head)
                    foreach (var supervisorId in oldHeadEmployee.SupervisorLinks.Select(sl => sl.SupervisorEmployeeId).ToList())
                    {
                        oldHeadEmployee.RemoveSupervisor(supervisorId);
                    }
                }

                // Remove head from department
                department.RemoveHead();
                await unitOfWork.SaveChangesAsync(cancellationToken);

                logger.LogInformation(
                    "Head removed from department {DepartmentId}, supervisors cleared",
                    command.DepartmentId);

                return Result.Success();
            }
            catch (Exception ex)
            {
                logger.LogError(
                    ex,
                    "Error removing head from department {DepartmentId}",
                    command.DepartmentId);
                return Result.Failure("An error occurred while removing department head");
            }
        }
    }
}