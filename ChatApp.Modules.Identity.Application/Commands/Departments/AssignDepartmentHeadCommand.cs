using ChatApp.Modules.Identity.Application.Interfaces;
using ChatApp.Shared.Kernel.Common;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace ChatApp.Modules.Identity.Application.Commands.Departments
{
    public record AssignDepartmentHeadCommand(
        Guid DepartmentId,
        Guid UserId,
        Guid? CallerCompanyId = null,
        bool IsSuperAdmin = false
    ) : IRequest<Result>;

    public class AssignDepartmentHeadCommandValidator : AbstractValidator<AssignDepartmentHeadCommand>
    {
        public AssignDepartmentHeadCommandValidator()
        {
            RuleFor(x => x.DepartmentId)
                .NotEmpty().WithMessage("Department ID is required");

            RuleFor(x => x.UserId)
                .NotEmpty().WithMessage("User ID is required");
        }
    }

    public class AssignDepartmentHeadCommandHandler(
        IUnitOfWork unitOfWork,
        ILogger<AssignDepartmentHeadCommandHandler> logger) : IRequestHandler<AssignDepartmentHeadCommand, Result>
    {
        public async Task<Result> Handle(
            AssignDepartmentHeadCommand command,
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

                var user = await unitOfWork.Users
                    .FirstOrDefaultAsync(u => u.Id == command.UserId, cancellationToken);

                if (user == null)
                    return Result.Failure("User not found");

                if (!command.IsSuperAdmin && user.CompanyId != command.CallerCompanyId)
                    return Result.Failure("User does not belong to your company");

                if (!user.IsActive)
                    return Result.Failure("Cannot assign inactive user as department head");

                // SupervisorLinks include — AddSupervisor idempotency üçün
                var headEmployee = await unitOfWork.Employees
                    .Include(e => e.SupervisorLinks)
                    .FirstOrDefaultAsync(e => e.UserId == command.UserId, cancellationToken);

                if (headEmployee == null)
                    return Result.Failure("Employee record not found for user");

                // Assign head on the department
                department.AssignHead(command.UserId);

                // Move the head to this department (head must be in the department, not a sub-department)
                if (headEmployee.DepartmentId != command.DepartmentId)
                    headEmployee.AssignToDepartment(command.DepartmentId);

                // === Auto Supervisor Logic ===

                // 1. Determine the new head's supervisor:
                //    - If subdepartment → supervisor = parent department head's Employee.Id
                //    - If top-level department → supervisor = Head of Company's Employee.Id
                Guid? headSupervisorId = null;

                if (department.ParentDepartmentId != null)
                {
                    // Find parent department's head
                    var parentDept = await unitOfWork.Departments
                        .FirstOrDefaultAsync(d => d.Id == department.ParentDepartmentId, cancellationToken);

                    if (parentDept?.HeadOfDepartmentId != null)
                    {
                        var parentHeadEmp = await unitOfWork.Employees
                            .FirstOrDefaultAsync(e => e.UserId == parentDept.HeadOfDepartmentId, cancellationToken);
                        headSupervisorId = parentHeadEmp?.Id;
                    }
                }

                if (headSupervisorId == null)
                {
                    // Fallback: find Head of Company
                    var company = await unitOfWork.Companies.FirstOrDefaultAsync(cancellationToken);
                    if (company?.HeadOfCompanyId != null)
                    {
                        var companyHeadEmp = await unitOfWork.Employees
                            .FirstOrDefaultAsync(e => e.UserId == company.HeadOfCompanyId, cancellationToken);
                        // Don't set self as supervisor
                        if (companyHeadEmp != null && companyHeadEmp.Id != headEmployee.Id)
                            headSupervisorId = companyHeadEmp.Id;
                    }
                }

                if (headSupervisorId != null)
                    headEmployee.AddSupervisor(headSupervisorId.Value);

                // 2. All department members (except the new head) get the new head as supervisor
                var deptEmployees = await unitOfWork.Employees
                    .Include(e => e.SupervisorLinks)
                    .Where(e => e.DepartmentId == command.DepartmentId && e.UserId != command.UserId)
                    .ToListAsync(cancellationToken);

                foreach (var emp in deptEmployees)
                {
                    emp.AddSupervisor(headEmployee.Id);
                }

                // 3. Subdepartment heads get the new head as supervisor
                var subDepts = await unitOfWork.Departments
                    .Where(d => d.ParentDepartmentId == command.DepartmentId && d.HeadOfDepartmentId != null)
                    .ToListAsync(cancellationToken);

                foreach (var subDept in subDepts)
                {
                    var subHeadEmp = await unitOfWork.Employees
                        .Include(e => e.SupervisorLinks)
                        .FirstOrDefaultAsync(e => e.UserId == subDept.HeadOfDepartmentId, cancellationToken);
                    if (subHeadEmp != null)
                        subHeadEmp.AddSupervisor(headEmployee.Id);
                }

                await unitOfWork.SaveChangesAsync(cancellationToken);

                logger.LogInformation(
                    "User {UserId} assigned as head of department {DepartmentId} with {SubCount} subordinates auto-assigned",
                    command.UserId,
                    command.DepartmentId,
                    deptEmployees.Count + subDepts.Count);

                return Result.Success();
            }
            catch (Exception ex)
            {
                logger.LogError(
                    ex,
                    "Error assigning user {UserId} as head of department {DepartmentId}",
                    command.UserId,
                    command.DepartmentId);
                return Result.Failure("An error occurred while assigning department head");
            }
        }
    }
}