using ChatApp.Modules.Identity.Application.Interfaces;
using ChatApp.Shared.Kernel.Common;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace ChatApp.Modules.Identity.Application.Commands.Companies
{
    /// <summary>
    /// Soft delete — şirkəti deaktiv edir, silmir.
    /// </summary>
    public record DeleteCompanyCommand(Guid CompanyId) : IRequest<Result>;

    public class DeleteCompanyCommandValidator : AbstractValidator<DeleteCompanyCommand>
    {
        public DeleteCompanyCommandValidator()
        {
            RuleFor(x => x.CompanyId)
                .NotEmpty().WithMessage("Company ID is required");
        }
    }

    public class DeleteCompanyCommandHandler(
        IUnitOfWork unitOfWork,
        ILogger<DeleteCompanyCommand> logger) : IRequestHandler<DeleteCompanyCommand, Result>
    {
        public async Task<Result> Handle(
            DeleteCompanyCommand command,
            CancellationToken cancellationToken = default)
        {
            try
            {
                var company = await unitOfWork.Companies
                    .FirstOrDefaultAsync(c => c.Id == command.CompanyId, cancellationToken);

                if (company is null)
                    return Result.Failure("Company not found");

                company.Deactivate();
                await unitOfWork.SaveChangesAsync(cancellationToken);

                logger.LogInformation("Company {CompanyId} deactivated (soft delete)", command.CompanyId);
                return Result.Success();
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error deactivating company {CompanyId}", command.CompanyId);
                return Result.Failure("An error occurred while deactivating the company");
            }
        }
    }
}
