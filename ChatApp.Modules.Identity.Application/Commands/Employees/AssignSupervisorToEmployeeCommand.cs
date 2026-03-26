using ChatApp.Modules.Identity.Application.Interfaces;
using ChatApp.Shared.Kernel.Common;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace ChatApp.Modules.Identity.Application.Commands.Employees
{
    public record AssignSupervisorToEmployeeCommand(
        Guid UserId,
        Guid SupervisorId,
        Guid? CallerCompanyId = null,
        bool IsSuperAdmin = false
    ) : IRequest<Result>;

    public class AssignSupervisorToEmployeeCommandValidator : AbstractValidator<AssignSupervisorToEmployeeCommand>
    {
        public AssignSupervisorToEmployeeCommandValidator()
        {
            RuleFor(x => x.UserId)
                .NotEmpty().WithMessage("User ID is required");

            RuleFor(x => x.SupervisorId)
                .NotEmpty().WithMessage("Supervisor ID is required");

            RuleFor(x => x)
                .Must(x => x.UserId != x.SupervisorId)
                .WithMessage("User cannot be their own supervisor");
        }
    }

    public class AssignSupervisorToEmployeeCommandHandler(
        IUnitOfWork unitOfWork,
        ILogger<AssignSupervisorToEmployeeCommandHandler> logger) : IRequestHandler<AssignSupervisorToEmployeeCommand, Result>
    {
        public async Task<Result> Handle(
            AssignSupervisorToEmployeeCommand command,
            CancellationToken cancellationToken)
        {
            try
            {
                // İşçini SupervisorLinks ilə yüklə (idempotency yoxlaması üçün)
                var user = await unitOfWork.Users
                    .Include(u => u.Employee!.SupervisorLinks)
                    .FirstOrDefaultAsync(u => u.Id == command.UserId, cancellationToken);

                if (user == null)
                    return Result.Failure("User not found");

                if (!command.IsSuperAdmin && user.CompanyId != command.CallerCompanyId)
                    return Result.Failure("Access denied");

                if (user.Employee == null)
                    return Result.Failure("User does not have an employee record");

                // Rəhbəri User + Employee ilə yüklə
                var supervisorUser = await unitOfWork.Users
                    .Include(u => u.Employee!.SupervisorLinks)
                    .FirstOrDefaultAsync(u => u.Id == command.SupervisorId, cancellationToken);

                if (supervisorUser == null)
                    return Result.Failure("Supervisor not found");

                if (supervisorUser.Employee == null)
                    return Result.Failure("Supervisor does not have an employee record");

                if (!supervisorUser.IsActive)
                    return Result.Failure("Cannot assign inactive user as supervisor");

                // Şirkət izolyasiyası — fərqli şirkətdən rəhbər təyin edilə bilməz
                if (user.CompanyId != supervisorUser.CompanyId)
                    return Result.Failure("Cannot assign supervisor from a different company");

                // Dairəvi rəhbərlik yoxlanışı — A→B isə B→A ola bilməz
                var isCircular = supervisorUser.Employee.SupervisorLinks
                    .Any(s => s.SupervisorEmployeeId == user.Employee.Id);
                if (isCircular)
                    return Result.Failure("Circular supervision detected: supervisor is already a subordinate of this employee");

                // Many-to-many: idempotent əlavə
                user.Employee.AddSupervisor(supervisorUser.Employee.Id);
                await unitOfWork.SaveChangesAsync(cancellationToken);

                logger.LogInformation(
                    "Supervisor {SupervisorId} assigned to employee {UserId}",
                    command.SupervisorId,
                    command.UserId);

                return Result.Success();
            }
            catch (Exception ex)
            {
                logger.LogError(
                    ex,
                    "Error assigning supervisor {SupervisorId} to employee {UserId}",
                    command.SupervisorId,
                    command.UserId);
                return Result.Failure("An error occurred while assigning supervisor");
            }
        }
    }
}
