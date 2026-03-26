using ChatApp.Modules.Identity.Application.Interfaces;
using ChatApp.Modules.Identity.Domain.Entities;
using ChatApp.Shared.Kernel.Common;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace ChatApp.Modules.Identity.Application.Commands.Positions
{
    public record CreatePositionCommand(
        string Name,
        Guid? DepartmentId,
        string? Description,
        Guid? CallerCompanyId = null,
        bool IsSuperAdmin = false
    ) : IRequest<Result<Guid>>;

    public class CreatePositionCommandValidator : AbstractValidator<CreatePositionCommand>
    {
        public CreatePositionCommandValidator()
        {
            RuleFor(x => x.Name)
                .NotEmpty().WithMessage("Position name is required")
                .MaximumLength(150).WithMessage("Position name must not exceed 150 characters");

            When(x => !string.IsNullOrWhiteSpace(x.Description), () =>
            {
                RuleFor(x => x.Description)
                    .MaximumLength(500).WithMessage("Description must not exceed 500 characters");
            });
        }
    }

    public class CreatePositionCommandHandler(
        IUnitOfWork unitOfWork,
        ILogger<CreatePositionCommandHandler> logger) : IRequestHandler<CreatePositionCommand, Result<Guid>>
    {
        public async Task<Result<Guid>> Handle(
            CreatePositionCommand command,
            CancellationToken cancellationToken)
        {
            try
            {
                if (command.DepartmentId.HasValue)
                {
                    var dept = await unitOfWork.Departments
                        .FirstOrDefaultAsync(d => d.Id == command.DepartmentId.Value, cancellationToken);

                    if (dept == null)
                        return Result.Failure<Guid>("Department not found");

                    if (!command.IsSuperAdmin && dept.CompanyId != command.CallerCompanyId)
                        return Result.Failure<Guid>("Department does not belong to your company");
                }

                var isDuplicate = await unitOfWork.Positions
                    .AnyAsync(p => p.Name == command.Name && p.DepartmentId == command.DepartmentId, cancellationToken);
                if (isDuplicate)
                    return Result.Failure<Guid>("A position with this name already exists in this department");

                var position = new Position(command.Name, command.DepartmentId, command.Description);
                await unitOfWork.Positions.AddAsync(position, cancellationToken);
                await unitOfWork.SaveChangesAsync(cancellationToken);

                logger.LogInformation("Position {PositionName} created with ID {PositionId}",
                    position.Name, position.Id);

                return Result.Success(position.Id);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error creating position {PositionName}", command.Name);
                return Result.Failure<Guid>("An error occurred while creating the position");
            }
        }
    }
}
