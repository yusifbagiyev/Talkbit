using ChatApp.Modules.Identity.Application.Interfaces;
using ChatApp.Modules.Identity.Domain.Events;
using ChatApp.Shared.Kernel.Common;
using ChatApp.Shared.Kernel.Exceptions;
using ChatApp.Shared.Kernel.Interfaces;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace ChatApp.Modules.Identity.Application.Commands.Users
{
    public record DeleteUserCommand(
        Guid UserId,
        Guid? CallerCompanyId = null,
        bool IsSuperAdmin = false
    ) : IRequest<Result>;

    public class DeleteUserCommandValidator : AbstractValidator<DeleteUserCommand>
    {
        public DeleteUserCommandValidator()
        {
            RuleFor(x => x.UserId)
                .NotEmpty().WithMessage("User ID cannot be empty to delete user");
        }
    }

    public class DeleteUserCommandHandler(
        IUnitOfWork unitOfWork,
        IEventBus eventBus,
        ILogger<DeleteUserCommand> logger) : IRequestHandler<DeleteUserCommand, Result>
    {
        public async Task<Result> Handle(
            DeleteUserCommand request,
            CancellationToken cancellationToken)
        {
            try
            {
                logger?.LogInformation("Deleting user {UserId}", request.UserId);

                var user = await unitOfWork.Users
                    .FirstOrDefaultAsync(r => r.Id == request.UserId, cancellationToken)
                        ?? throw new NotFoundException($"User with ID {request.UserId} not found");

                if (!request.IsSuperAdmin && user.CompanyId != request.CallerCompanyId)
                    return Result.Failure("Access denied");

                unitOfWork.Users.Remove(user);
                await unitOfWork.SaveChangesAsync(cancellationToken);

                await eventBus.PublishAsync(new UserDeletedEvent(user.Id, user.Email), cancellationToken);

                logger?.LogInformation("User {Email} deleted successfully", user.Email);
                return Result.Success();
            }
            catch (Exception ex)
            {
                logger?.LogError(ex, "Error deleting user {UserId}", request.UserId);
                return Result.Failure(ex.Message);
            }
        }
    }
}
