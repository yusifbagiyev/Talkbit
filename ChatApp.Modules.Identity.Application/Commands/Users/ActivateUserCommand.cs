using ChatApp.Modules.Identity.Application.Interfaces;
using ChatApp.Shared.Kernel.Common;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace ChatApp.Modules.Identity.Application.Commands.Users
{
    public record ActivateUserCommand(
        Guid UserId,
        Guid? CallerCompanyId = null,
        bool IsSuperAdmin = false
    ) : IRequest<Result>;

    public class ActivateUserCommandValidator : AbstractValidator<ActivateUserCommand>
    {
        public ActivateUserCommandValidator()
        {
            RuleFor(x => x.UserId)
                .NotEmpty().WithMessage("User ID is required");
        }
    }

    public class ActivateUserCommandHandler(
        IUnitOfWork unitOfWork,
        ILogger<ActivateUserCommandHandler> logger) : IRequestHandler<ActivateUserCommand, Result>
    {
        public async Task<Result> Handle(
            ActivateUserCommand request,
            CancellationToken cancellationToken)
        {
            try
            {
                var user = await unitOfWork.Users
                    .FirstOrDefaultAsync(r => r.Id == request.UserId, cancellationToken);

                if (user == null)
                    return Result.Failure($"User with this ID {request.UserId} not found");

                if (!request.IsSuperAdmin && user.CompanyId != request.CallerCompanyId)
                    return Result.Failure("Access denied");

                if (user.IsActive)
                    return Result.Success("User already is active");

                user.Activate();
                unitOfWork.Users.Update(user);
                await unitOfWork.SaveChangesAsync(cancellationToken);

                return Result.Success();
            }
            catch (Exception ex)
            {
                logger?.LogError(ex, "Error activating user {UserId}", request.UserId);
                return Result.Failure(ex.Message);
            }
        }
    }
}
