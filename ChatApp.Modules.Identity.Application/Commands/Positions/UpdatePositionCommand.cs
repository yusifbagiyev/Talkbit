using ChatApp.Modules.Identity.Application.Interfaces;
using ChatApp.Shared.Kernel.Common;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace ChatApp.Modules.Identity.Application.Commands.Positions
{
    public record UpdatePositionCommand(
        Guid PositionId,
        string? Name,
        Guid? DepartmentId,
        string? Description,
        Guid? CallerCompanyId = null,
        bool IsSuperAdmin = false
    ) : IRequest<Result>;

    public class UpdatePositionCommandValidator : AbstractValidator<UpdatePositionCommand>
    {
        public UpdatePositionCommandValidator()
        {
            RuleFor(x => x.PositionId)
                .NotEmpty().WithMessage("Position ID is required");

            When(x => !string.IsNullOrWhiteSpace(x.Name), () =>
            {
                RuleFor(x => x.Name)
                    .MaximumLength(150).WithMessage("Position name must not exceed 150 characters");
            });

            When(x => !string.IsNullOrWhiteSpace(x.Description), () =>
            {
                RuleFor(x => x.Description)
                    .MaximumLength(500).WithMessage("Description must not exceed 500 characters");
            });
        }
    }

    public class UpdatePositionCommandHandler(
        IUnitOfWork unitOfWork,
        ILogger<UpdatePositionCommandHandler> logger) : IRequestHandler<UpdatePositionCommand, Result>
    {
        public async Task<Result> Handle(
            UpdatePositionCommand command,
            CancellationToken cancellationToken)
        {
            try
            {
                var position = await unitOfWork.Positions
                    .Include(p => p.Department)
                    .FirstOrDefaultAsync(p => p.Id == command.PositionId, cancellationToken);

                if (position == null)
                    return Result.Failure("Position not found");

                // Mövcut departmentin şirkəti ilə caller-in şirkətini müqayisə et
                if (!command.IsSuperAdmin && position.Department?.CompanyId != command.CallerCompanyId)
                    return Result.Failure("Access denied");

                if (command.DepartmentId.HasValue)
                {
                    var dept = await unitOfWork.Departments
                        .FirstOrDefaultAsync(d => d.Id == command.DepartmentId.Value, cancellationToken);
                    if (dept == null)
                        return Result.Failure("Department not found");
                    if (!command.IsSuperAdmin && dept.CompanyId != command.CallerCompanyId)
                        return Result.Failure("Department does not belong to your company");
                }

                if (!string.IsNullOrWhiteSpace(command.Name))
                {
                    var newDepartmentId = command.DepartmentId ?? position.DepartmentId;
                    var isDuplicate = await unitOfWork.Positions
                        .AnyAsync(p => p.Id != command.PositionId
                                      && p.Name == command.Name
                                      && p.DepartmentId == newDepartmentId, cancellationToken);
                    if (isDuplicate)
                        return Result.Failure("A position with this name already exists in this department");
                }

                position.UpdateDetails(
                    command.Name ?? position.Name,
                    command.DepartmentId.HasValue ? command.DepartmentId : position.DepartmentId,
                    command.Description ?? position.Description);

                await unitOfWork.SaveChangesAsync(cancellationToken);

                logger.LogInformation("Position {PositionId} updated successfully", command.PositionId);
                return Result.Success();
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error updating position {PositionId}", command.PositionId);
                return Result.Failure("An error occurred while updating the position");
            }
        }
    }
}
