using ChatApp.Modules.Identity.Application.Interfaces;
using ChatApp.Modules.Identity.Domain.Events;
using ChatApp.Modules.Identity.Domain.Services;
using ChatApp.Shared.Kernel.Common;
using ChatApp.Shared.Kernel.Exceptions;
using ChatApp.Shared.Kernel.Interfaces;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace ChatApp.Modules.Identity.Application.Commands.Users
{
    public record AdminChangePasswordCommand(
        Guid UserId,
        string NewPassword,
        string ConfirmNewPassword,
        Guid? CallerCompanyId = null,
        bool IsSuperAdmin = false
    ) : IRequest<Result>;

    public class AdminChangePasswordComamndValidator : AbstractValidator<AdminChangePasswordCommand>
    {
        public AdminChangePasswordComamndValidator()
        {
            RuleFor(x => x.UserId)
                .NotEmpty().WithMessage("User ID is required");

            RuleFor(x => x.NewPassword)
                .NotEmpty().WithMessage("New password is required")
                .MinimumLength(8).WithMessage("New password must be at least 8 characters")
                .MaximumLength(100).WithMessage("New password must not exceed 100 characters")
                .Matches(@"[A-Z]").WithMessage("New password must contain at least one uppercase letter")
                .Matches(@"[a-z]").WithMessage("New password must contain at least one lowercase letter")
                .Matches(@"[0-9]").WithMessage("New password must contain at least one number")
                .Matches(@"[\W_]").WithMessage("New password must contain at least one special character");

            RuleFor(x => x.ConfirmNewPassword)
                .NotEmpty().WithMessage("Password confirmation is required")
                .Equal(x => x.NewPassword).WithMessage("Passwords do not match");
        }
    }

    public class AdminChangePasswordCommandHandler(
        IUnitOfWork unitOfWork,
        IPasswordHasher passwordHasher,
        IEventBus eventBus,
        ILogger<AdminChangePasswordCommandHandler> logger) : IRequestHandler<AdminChangePasswordCommand, Result>
    {
        public async Task<Result> Handle(
            AdminChangePasswordCommand request,
            CancellationToken cancellationToken = default)
        {
            try
            {
                var user = await unitOfWork.Users
                    .FirstOrDefaultAsync(r => r.Id == request.UserId, cancellationToken)
                        ?? throw new NotFoundException($"User with ID {request.UserId} not found");

                if (!request.IsSuperAdmin && user.CompanyId != request.CallerCompanyId)
                    return Result.Failure("Access denied");

                var newPasswordHash = passwordHasher.Hash(request.NewPassword);
                user.ChangePassword(newPasswordHash);
                unitOfWork.Users.Update(user);
                await unitOfWork.SaveChangesAsync(cancellationToken);

                await eventBus.PublishAsync(new UserPasswordChangedEvent(user.Id), cancellationToken);

                logger?.LogInformation("Admin changed the password of the user {UserId} successfully", request.UserId);
                return Result.Success();
            }
            catch (NotFoundException ex)
            {
                logger?.LogError(ex, "User {UserId} not found", request.UserId);
                return Result.Failure(ex.Message);
            }
            catch (Exception ex)
            {
                logger?.LogError(ex, "Error changing password for user {UserId} by Admin", request.UserId);
                return Result.Failure("An error occurred while changing user password by Admin");
            }
        }
    }
}
