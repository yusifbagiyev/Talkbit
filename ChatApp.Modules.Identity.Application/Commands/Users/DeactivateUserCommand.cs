using ChatApp.Modules.Identity.Application.Interfaces;
using ChatApp.Shared.Kernel.Common;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace ChatApp.Modules.Identity.Application.Commands.Users
{
    public record DeactivateUserCommand(
        Guid UserId,
        Guid? CallerCompanyId = null,
        bool IsSuperAdmin = false
    ) : IRequest<Result>;

    public class DeactivateUserCommandValidator : AbstractValidator<DeactivateUserCommand>
    {
        public DeactivateUserCommandValidator()
        {
            RuleFor(x => x.UserId)
                .NotEmpty().WithMessage("User ID is required");
        }
    }

    public class DeactivateUserCommandHandler(
        IUnitOfWork unitOfWork,
        ILogger<DeactivateUserCommandHandler> logger) : IRequestHandler<DeactivateUserCommand, Result>
    {
        public async Task<Result> Handle(
            DeactivateUserCommand request,
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

                if (!user.IsActive)
                    return Result.Success("User already is deactivated");

                user.Deactivate();
                unitOfWork.Users.Update(user);
                await unitOfWork.SaveChangesAsync(cancellationToken);

                return Result.Success();
            }
            catch (Exception ex)
            {
                logger?.LogError(ex, "Error deactivating user {UserId}", request.UserId);
                return Result.Failure(ex.Message);
            }
        }
    }
}
