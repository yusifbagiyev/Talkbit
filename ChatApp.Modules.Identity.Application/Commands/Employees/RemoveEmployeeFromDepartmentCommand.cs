using ChatApp.Modules.Identity.Application.Interfaces;
using ChatApp.Shared.Kernel.Common;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace ChatApp.Modules.Identity.Application.Commands.Employees
{
    public record RemoveEmployeeFromDepartmentCommand(
        Guid UserId,
        Guid? CallerCompanyId = null,
        bool IsSuperAdmin = false) : IRequest<Result>;

    public class RemoveEmployeeFromDepartmentCommandValidator : AbstractValidator<RemoveEmployeeFromDepartmentCommand>
    {
        public RemoveEmployeeFromDepartmentCommandValidator()
        {
            RuleFor(x => x.UserId)
                .NotEmpty().WithMessage("User ID is required");
        }
    }

    public class RemoveEmployeeFromDepartmentCommandHandler(
        IUnitOfWork unitOfWork,
        ILogger<RemoveEmployeeFromDepartmentCommandHandler> logger) : IRequestHandler<RemoveEmployeeFromDepartmentCommand, Result>
    {
        public async Task<Result> Handle(
            RemoveEmployeeFromDepartmentCommand command,
            CancellationToken cancellationToken)
        {
            try
            {
                // Validate user exists and has employee record
                var user = await unitOfWork.Users
                    .Include(u => u.Employee)
                    .FirstOrDefaultAsync(u => u.Id == command.UserId, cancellationToken);

                if (user == null)
                    return Result.Failure("User not found");

                if (!command.IsSuperAdmin && user.CompanyId != command.CallerCompanyId)
                    return Result.Failure("Access denied");

                if (user.Employee == null)
                    return Result.Failure("User does not have an employee record");

                if (user.Employee.DepartmentId == null)
                    return Result.Failure("Employee is not assigned to any department");

                // Remove from department
                user.Employee.RemoveFromDepartment();
                await unitOfWork.SaveChangesAsync(cancellationToken);

                logger.LogInformation(
                    "Employee {UserId} removed from department",
                    command.UserId);

                return Result.Success();
            }
            catch (Exception ex)
            {
                logger.LogError(
                    ex,
                    "Error removing employee {UserId} from department",
                    command.UserId);
                return Result.Failure("An error occurred while removing employee from department");
            }
        }
    }
}