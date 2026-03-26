using ChatApp.Modules.Identity.Application.Interfaces;
using ChatApp.Modules.Identity.Domain.Entities;
using ChatApp.Shared.Kernel.Common;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace ChatApp.Modules.Identity.Application.Commands.Departments
{
    public record CreateDepartmentCommand(
        string Name,
        Guid? CallerCompanyId,
        Guid? ParentDepartmentId
    ) : IRequest<Result<Guid>>;

    public class CreateDepartmentCommandValidator : AbstractValidator<CreateDepartmentCommand>
    {
        public CreateDepartmentCommandValidator()
        {
            RuleFor(x => x.Name)
                .NotEmpty().WithMessage("Department name is required")
                .MaximumLength(150).WithMessage("Department name must not exceed 150 characters");

            RuleFor(x => x.CallerCompanyId)
                .NotEmpty().WithMessage("Company ID is required");
        }
    }

    public class CreateDepartmentCommandHandler(
        IUnitOfWork unitOfWork,
        ILogger<CreateDepartmentCommandHandler> logger) : IRequestHandler<CreateDepartmentCommand, Result<Guid>>
    {
        public async Task<Result<Guid>> Handle(
            CreateDepartmentCommand command,
            CancellationToken cancellationToken)
        {
            try
            {
                if (!command.CallerCompanyId.HasValue)
                    return Result.Failure<Guid>("Company ID is required");

                var companyExists = await unitOfWork.Companies
                    .AnyAsync(c => c.Id == command.CallerCompanyId.Value, cancellationToken);
                if (!companyExists)
                    return Result.Failure<Guid>("Company not found");

                if (command.ParentDepartmentId.HasValue)
                {
                    var parent = await unitOfWork.Departments
                        .FirstOrDefaultAsync(d => d.Id == command.ParentDepartmentId.Value, cancellationToken);
                    if (parent == null)
                        return Result.Failure<Guid>("Parent department not found");
                    if (parent.CompanyId != command.CallerCompanyId.Value)
                        return Result.Failure<Guid>("Parent department does not belong to your company");
                }

                // Eyni şirkət daxilində ad tekrarını yoxla
                var isDuplicate = await unitOfWork.Departments
                    .AnyAsync(d => d.Name == command.Name && d.CompanyId == command.CallerCompanyId.Value, cancellationToken);
                if (isDuplicate)
                    return Result.Failure<Guid>("A department with this name already exists in your company");

                var department = command.ParentDepartmentId.HasValue
                    ? new Department(command.Name, command.CallerCompanyId.Value, command.ParentDepartmentId.Value)
                    : new Department(command.Name, command.CallerCompanyId.Value);

                await unitOfWork.Departments.AddAsync(department, cancellationToken);
                await unitOfWork.SaveChangesAsync(cancellationToken);

                logger.LogInformation("Department {DepartmentName} created with ID {DepartmentId}",
                    department.Name, department.Id);

                return Result.Success(department.Id);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error creating department {DepartmentName}", command.Name);
                return Result.Failure<Guid>("An error occurred while creating the department");
            }
        }
    }
}
