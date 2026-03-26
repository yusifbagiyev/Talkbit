using ChatApp.Modules.Identity.Application.Interfaces;
using ChatApp.Shared.Kernel.Common;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace ChatApp.Modules.Identity.Application.Commands.Employees
{
    public record AssignEmployeeToDepartmentCommand(
        Guid UserId,
        Guid DepartmentId,
        Guid? SupervisorId = null,
        Guid? HeadOfDepartmentId = null,
        Guid? CallerCompanyId = null,
        bool IsSuperAdmin = false
    ) : IRequest<Result>;

    public class AssignEmployeeToDepartmentCommandValidator : AbstractValidator<AssignEmployeeToDepartmentCommand>
    {
        public AssignEmployeeToDepartmentCommandValidator()
        {
            RuleFor(x => x.UserId)
                .NotEmpty().WithMessage("User ID is required");

            RuleFor(x => x.DepartmentId)
                .NotEmpty().WithMessage("Department ID is required");
        }
    }

    public class AssignEmployeeToDepartmentCommandHandler(
        IUnitOfWork unitOfWork,
        ILogger<AssignEmployeeToDepartmentCommandHandler> logger) : IRequestHandler<AssignEmployeeToDepartmentCommand, Result>
    {
        public async Task<Result> Handle(
            AssignEmployeeToDepartmentCommand command,
            CancellationToken cancellationToken)
        {
            try
            {
                // SupervisorLinks include lazımdır ki, AddSupervisor idempotency düzgün işləsin
                var user = await unitOfWork.Users
                    .Include(u => u.Employee!.SupervisorLinks)
                    .FirstOrDefaultAsync(u => u.Id == command.UserId, cancellationToken);

                if (user == null)
                    return Result.Failure("User not found");

                if (!command.IsSuperAdmin && user.CompanyId != command.CallerCompanyId)
                    return Result.Failure("Access denied");

                if (user.Employee == null)
                    return Result.Failure("User does not have an employee record");

                var department = await unitOfWork.Departments
                    .FirstOrDefaultAsync(d => d.Id == command.DepartmentId, cancellationToken);

                if (department == null)
                    return Result.Failure("Department not found");

                if (!command.IsSuperAdmin && department.CompanyId != command.CallerCompanyId)
                    return Result.Failure("Department does not belong to your company");

                // Validate head of department if provided
                if (command.HeadOfDepartmentId.HasValue)
                {
                    var headOfDepartment = await unitOfWork.Users
                        .FirstOrDefaultAsync(u => u.Id == command.HeadOfDepartmentId.Value, cancellationToken);

                    if (headOfDepartment == null)
                        return Result.Failure("Head of department not found");
                }

                user.Employee.AssignToDepartment(command.DepartmentId, command.HeadOfDepartmentId);

                // SupervisorId verilmişsə many-to-many cədvələ əlavə et
                if (command.SupervisorId.HasValue)
                {
                    var supervisorUser = await unitOfWork.Users
                        .Include(u => u.Employee)
                        .FirstOrDefaultAsync(u => u.Id == command.SupervisorId.Value, cancellationToken);

                    if (supervisorUser?.Employee == null)
                        return Result.Failure("Supervisor not found");

                    user.Employee.AddSupervisor(supervisorUser.Employee.Id);
                }

                await unitOfWork.SaveChangesAsync(cancellationToken);

                logger?.LogInformation(
                    "Employee {UserId} assigned to department {DepartmentId}",
                    command.UserId,
                    command.DepartmentId);

                return Result.Success();
            }
            catch (Exception ex)
            {
                logger?.LogError(
                    ex,
                    "Error assigning employee {UserId} to department {DepartmentId}",
                    command.UserId,
                    command.DepartmentId);
                return Result.Failure("An error occurred while assigning employee to department");
            }
        }
    }
}