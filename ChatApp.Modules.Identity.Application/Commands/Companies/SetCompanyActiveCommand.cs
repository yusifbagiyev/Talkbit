using ChatApp.Modules.Identity.Application.Interfaces;
using ChatApp.Shared.Kernel.Common;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace ChatApp.Modules.Identity.Application.Commands.Companies
{
    /// <summary>
    /// Şirkəti aktiv/deaktiv edir.
    /// </summary>
    public record SetCompanyActiveCommand(Guid CompanyId, bool IsActive) : IRequest<Result>;

    public class SetCompanyActiveCommandValidator : AbstractValidator<SetCompanyActiveCommand>
    {
        public SetCompanyActiveCommandValidator()
        {
            RuleFor(x => x.CompanyId)
                .NotEmpty().WithMessage("Company ID is required");
        }
    }

    public class SetCompanyActiveCommandHandler(
        IUnitOfWork unitOfWork,
        ILogger<SetCompanyActiveCommand> logger) : IRequestHandler<SetCompanyActiveCommand, Result>
    {
        public async Task<Result> Handle(
            SetCompanyActiveCommand command,
            CancellationToken cancellationToken = default)
        {
            try
            {
                var company = await unitOfWork.Companies
                    .FirstOrDefaultAsync(c => c.Id == command.CompanyId, cancellationToken);

                if (company is null)
                    return Result.Failure("Company not found");

                if (command.IsActive)
                    company.Activate();
                else
                    company.Deactivate();

                await unitOfWork.SaveChangesAsync(cancellationToken);

                logger.LogInformation("Company {CompanyId} status set to {IsActive}", command.CompanyId, command.IsActive);
                return Result.Success();
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error updating company {CompanyId} status", command.CompanyId);
                return Result.Failure("An error occurred while updating the company status");
            }
        }
    }
}
