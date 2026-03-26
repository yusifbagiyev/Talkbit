using ChatApp.Modules.Identity.Application.Interfaces;
using ChatApp.Shared.Kernel.Common;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace ChatApp.Modules.Identity.Application.Commands.Employees
{
    public record RemoveSupervisorFromEmployeeCommand(
        Guid UserId,
        Guid SupervisorId,
        Guid? CallerCompanyId = null,
        bool IsSuperAdmin = false
    ) : IRequest<Result>;

    public class RemoveSupervisorFromEmployeeCommandValidator : AbstractValidator<RemoveSupervisorFromEmployeeCommand>
    {
        public RemoveSupervisorFromEmployeeCommandValidator()
        {
            RuleFor(x => x.UserId)
                .NotEmpty().WithMessage("User ID is required");

            RuleFor(x => x.SupervisorId)
                .NotEmpty().WithMessage("Supervisor ID is required");
        }
    }

    public class RemoveSupervisorFromEmployeeCommandHandler(
        IUnitOfWork unitOfWork,
        ILogger<RemoveSupervisorFromEmployeeCommandHandler> logger) : IRequestHandler<RemoveSupervisorFromEmployeeCommand, Result>
    {
        public async Task<Result> Handle(
            RemoveSupervisorFromEmployeeCommand command,
            CancellationToken cancellationToken)
        {
            try
            {
                var user = await unitOfWork.Users
                    .Include(u => u.Employee!.SupervisorLinks)
                    .FirstOrDefaultAsync(u => u.Id == command.UserId, cancellationToken);

                if (user == null)
                    return Result.Failure("User not found");

                if (!command.IsSuperAdmin && user.CompanyId != command.CallerCompanyId)
                    return Result.Failure("Access denied");

                if (user.Employee == null)
                    return Result.Failure("User does not have an employee record");

                // Silinəcək rəhbərin Employee ID-sini tap
                var supervisorUser = await unitOfWork.Users
                    .Include(u => u.Employee)
                    .FirstOrDefaultAsync(u => u.Id == command.SupervisorId, cancellationToken);

                if (supervisorUser?.Employee == null)
                    return Result.Failure("Supervisor not found");

                var hasLink = user.Employee.SupervisorLinks
                    .Any(s => s.SupervisorEmployeeId == supervisorUser.Employee.Id);

                if (!hasLink)
                    return Result.Failure("This supervisor is not assigned to the employee");

                user.Employee.RemoveSupervisor(supervisorUser.Employee.Id);
                await unitOfWork.SaveChangesAsync(cancellationToken);

                logger.LogInformation(
                    "Supervisor {SupervisorId} removed from employee {UserId}",
                    command.SupervisorId,
                    command.UserId);

                return Result.Success();
            }
            catch (Exception ex)
            {
                logger.LogError(
                    ex,
                    "Error removing supervisor {SupervisorId} from employee {UserId}",
                    command.SupervisorId,
                    command.UserId);
                return Result.Failure("An error occurred while removing supervisor");
            }
        }
    }
}
