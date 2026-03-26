using ChatApp.Modules.Identity.Application.Interfaces;
using ChatApp.Modules.Identity.Domain.Constants;
using ChatApp.Shared.Kernel.Common;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace ChatApp.Modules.Identity.Application.Commands.Users
{
    public record RemovePermissionFromUserCommand(
        Guid UserId,
        string PermissionName,
        Guid? CallerCompanyId = null,
        bool IsSuperAdmin = false
    ) : IRequest<Result>;

    public class RemovePermissionFromUserCommandValidator : AbstractValidator<RemovePermissionFromUserCommand>
    {
        public RemovePermissionFromUserCommandValidator()
        {
            RuleFor(x => x.UserId)
                .NotEmpty().WithMessage("User ID is required");

            RuleFor(x => x.PermissionName)
                .NotEmpty().WithMessage("Permission name is required")
                .Must(name => Permissions.GetAll().Contains(name)).WithMessage("Invalid permission name");
        }
    }

    public class RemovePermissionFromUserCommandHandler(
        IUnitOfWork unitOfWork,
        ILogger<RemovePermissionFromUserCommandHandler> logger) : IRequestHandler<RemovePermissionFromUserCommand, Result>
    {
        public async Task<Result> Handle(
            RemovePermissionFromUserCommand command,
            CancellationToken cancellationToken)
        {
            try
            {
                var user = await unitOfWork.Users
                    .FirstOrDefaultAsync(u => u.Id == command.UserId, cancellationToken);

                if (user == null)
                    return Result.Failure("User not found");

                if (!command.IsSuperAdmin && user.CompanyId != command.CallerCompanyId)
                    return Result.Failure("Access denied");

                var permission = await unitOfWork.UserPermissions
                    .FirstOrDefaultAsync(up => up.UserId == command.UserId && up.PermissionName == command.PermissionName, cancellationToken);

                if (permission == null)
                    return Result.Failure($"User does not have the permission '{command.PermissionName}'");

                unitOfWork.UserPermissions.Remove(permission);
                await unitOfWork.SaveChangesAsync(cancellationToken);

                logger.LogInformation("Permission {PermissionName} removed from user {UserId}",
                    command.PermissionName, command.UserId);

                return Result.Success();
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error removing permission {PermissionName} from user {UserId}",
                    command.PermissionName, command.UserId);
                return Result.Failure("An error occurred while removing permission");
            }
        }
    }
}
