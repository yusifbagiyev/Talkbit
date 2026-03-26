using ChatApp.Modules.Identity.Application.Interfaces;
using ChatApp.Modules.Identity.Domain.Entities;
using ChatApp.Modules.Identity.Domain.Enums;
using ChatApp.Shared.Kernel.Common;
using ChatApp.Shared.Kernel.Exceptions;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace ChatApp.Modules.Identity.Application.Commands.Users
{
    public record UpdateUserCommand(
        Guid UserId,
        string? FirstName,
        string? LastName,
        string? Email,
        Role? Role,
        Guid? PositionId,
        string? AvatarUrl,
        string? AboutMe,
        DateTime? DateOfBirth,
        string? WorkPhone,
        DateTime? HiringDate,
        Guid? CallerCompanyId = null,
        bool IsSuperAdmin = false
    ) : IRequest<Result>;

    public class UpdateUserCommandValidator : AbstractValidator<UpdateUserCommand>
    {
        public UpdateUserCommandValidator()
        {
            RuleFor(x => x.UserId)
                .NotEmpty().WithMessage("User ID is required");

            When(x => !string.IsNullOrWhiteSpace(x.FirstName), () =>
            {
                RuleFor(x => x.FirstName)
                    .MinimumLength(2).WithMessage("First name must be at least 2 characters")
                    .MaximumLength(100).WithMessage("First name must not exceed 100 characters");
            });

            When(x => !string.IsNullOrWhiteSpace(x.LastName), () =>
            {
                RuleFor(x => x.LastName)
                    .MinimumLength(2).WithMessage("Last name must be at least 2 characters")
                    .MaximumLength(100).WithMessage("Last name must not exceed 100 characters");
            });

            When(x => !string.IsNullOrWhiteSpace(x.Email), () =>
            {
                RuleFor(x => x.Email)
                    .EmailAddress().WithMessage("Invalid email format")
                    .MaximumLength(255).WithMessage("Email must not exceed 255 characters");
            });

            When(x => x.Role.HasValue, () =>
            {
                RuleFor(x => x.Role)
                    .IsInEnum().WithMessage("Invalid role");
            });

            When(x => !string.IsNullOrWhiteSpace(x.AboutMe), () =>
            {
                RuleFor(x => x.AboutMe)
                    .MaximumLength(2000).WithMessage("About me must not exceed 2000 characters");
            });

            When(x => !string.IsNullOrWhiteSpace(x.AvatarUrl), () =>
            {
                RuleFor(x => x.AvatarUrl)
                    .MaximumLength(500).WithMessage("Avatar URL must not exceed 500 characters");
            });

            When(x => !string.IsNullOrWhiteSpace(x.WorkPhone), () =>
            {
                RuleFor(x => x.WorkPhone)
                    .MaximumLength(50).WithMessage("Work phone must not exceed 50 characters");
            });
        }
    }

    public class UpdateUserCommandHandler(
        IUnitOfWork unitOfWork,
        ILogger<UpdateUserCommand> logger) : IRequestHandler<UpdateUserCommand, Result>
    {
        public async Task<Result> Handle(
            UpdateUserCommand request,
            CancellationToken cancellationToken = default)
        {
            try
            {
                logger?.LogInformation("Updating user {UserId}", request.UserId);

                var user = await unitOfWork.Users
                    .Include(u => u.Employee)
                    .FirstOrDefaultAsync(u => u.Id == request.UserId, cancellationToken);

                if (user is null)
                    throw new NotFoundException($"User with ID {request.UserId} not found");

                if (!request.IsSuperAdmin && user.CompanyId != request.CallerCompanyId)
                    return Result.Failure("Access denied");

                // Admin yalnız User rolu verə bilər
                if (request.Role.HasValue && !request.IsSuperAdmin && request.Role.Value != Role.User)
                    return Result.Failure("Admins can only assign the User role");

                if (user.Employee is null)
                    throw new NotFoundException($"Employee record not found for User {request.UserId}");

                await ValidateAndUpdateEmailAsync(user, request.Email, request.UserId, cancellationToken);
                UpdateUserFields(user, user.Employee, request);

                await unitOfWork.SaveChangesAsync(cancellationToken);

                logger?.LogInformation("User {UserId} updated successfully", request.UserId);
                return Result.Success();
            }
            catch (NotFoundException)
            {
                throw;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error updating user {UserId}", request.UserId);
                return Result.Failure("An error occurred while updating the user");
            }
        }

        private async Task ValidateAndUpdateEmailAsync(
            User user,
            string? newEmail,
            Guid userId,
            CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(newEmail) || newEmail == user.Email)
                return;

            var emailExists = await unitOfWork.Users.AnyAsync(
                u => u.Email == newEmail && u.Id != userId,
                cancellationToken);

            if (emailExists)
                throw new InvalidOperationException($"Email {newEmail} is already in use");

            user.UpdateEmail(newEmail);
        }

        private static void UpdateUserFields(User user, Employee employee, UpdateUserCommand request)
        {
            if (!string.IsNullOrWhiteSpace(request.FirstName) && !string.IsNullOrWhiteSpace(request.LastName))
                user.UpdateName(request.FirstName, request.LastName);
            else if (!string.IsNullOrWhiteSpace(request.FirstName))
                user.UpdateName(request.FirstName, user.LastName);
            else if (!string.IsNullOrWhiteSpace(request.LastName))
                user.UpdateName(user.FirstName, request.LastName);

            if (request.Role.HasValue)
                user.ChangeRole(request.Role.Value);

            if (request.AvatarUrl is not null)
                user.UpdateAvatarUrl(string.IsNullOrWhiteSpace(request.AvatarUrl) ? null : request.AvatarUrl);

            if (request.PositionId.HasValue)
                employee.AssignToPosition(request.PositionId == Guid.Empty ? null : request.PositionId);

            if (request.AboutMe is not null)
                employee.UpdateAboutMe(request.AboutMe);

            if (request.DateOfBirth.HasValue)
                employee.UpdateDateOfBirth(request.DateOfBirth);

            if (request.WorkPhone is not null)
                employee.UpdateWorkPhone(request.WorkPhone);

            if (request.HiringDate.HasValue)
                employee.UpdateHiringDate(DateTime.SpecifyKind(request.HiringDate.Value, DateTimeKind.Utc));
        }
    }
}
