using ChatApp.Modules.Identity.Application.Interfaces;
using ChatApp.Modules.Identity.Domain.Constants;
using ChatApp.Modules.Identity.Domain.Entities;
using ChatApp.Shared.Kernel.Common;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace ChatApp.Modules.Identity.Application.Commands.Users
{
    public record AssignPermissionToUserCommand(
        Guid UserId,
        string PermissionName,
        Guid? CallerCompanyId = null,
        bool IsSuperAdmin = false
    ) : IRequest<Result>;

    public class AssignPermissionToUserCommandValidator : AbstractValidator<AssignPermissionToUserCommand>
    {
        public AssignPermissionToUserCommandValidator()
        {
            RuleFor(x => x.UserId)
                .NotEmpty().WithMessage("User ID is required");

            RuleFor(x => x.PermissionName)
                .NotEmpty().WithMessage("Permission name is required")
                .Must(name => Permissions.GetAll().Contains(name)).WithMessage("Invalid permission name");
        }
    }

    public class AssignPermissionToUserCommandHandler(
        IUnitOfWork unitOfWork,
        ILogger<AssignPermissionToUserCommandHandler> logger) : IRequestHandler<AssignPermissionToUserCommand, Result>
    {
        public async Task<Result> Handle(
            AssignPermissionToUserCommand command,
            CancellationToken cancellationToken)
        {
            try
            {
                var user = await unitOfWork.Users
                    .Include(u => u.UserPermissions)
                    .FirstOrDefaultAsync(u => u.Id == command.UserId, cancellationToken);

                if (user == null)
                    return Result.Failure("User not found");

                if (!command.IsSuperAdmin && user.CompanyId != command.CallerCompanyId)
                    return Result.Failure("Access denied");

                if (!user.IsActive)
                    return Result.Failure("Cannot assign permission to inactive user");

                if (user.UserPermissions.Any(up => up.PermissionName == command.PermissionName))
                    return Result.Failure($"User already has the permission '{command.PermissionName}'");

                var userPermission = new UserPermission(command.UserId, command.PermissionName);
                await unitOfWork.UserPermissions.AddAsync(userPermission, cancellationToken);
                await unitOfWork.SaveChangesAsync(cancellationToken);

                logger.LogInformation(
                    "Permission {PermissionName} assigned to user {UserId}",
                    command.PermissionName, command.UserId);

                return Result.Success();
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error assigning permission {PermissionName} to user {UserId}",
                    command.PermissionName, command.UserId);
                return Result.Failure("An error occurred while assigning permission");
            }
        }
    }
}
