using ChatApp.Modules.Identity.Application.Interfaces;
using ChatApp.Shared.Kernel.Common;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace ChatApp.Modules.Identity.Application.Commands.Companies
{
    public record UpdateCompanyCommand(
        Guid CompanyId,
        string Name,
        string? LogoUrl,
        string? Description
    ) : IRequest<Result>;

    public class UpdateCompanyCommandValidator : AbstractValidator<UpdateCompanyCommand>
    {
        public UpdateCompanyCommandValidator()
        {
            RuleFor(x => x.CompanyId)
                .NotEmpty().WithMessage("Company ID is required");

            RuleFor(x => x.Name)
                .NotEmpty().WithMessage("Company name is required")
                .MaximumLength(200).WithMessage("Company name must not exceed 200 characters");

            When(x => !string.IsNullOrWhiteSpace(x.LogoUrl), () =>
            {
                RuleFor(x => x.LogoUrl)
                    .MaximumLength(500).WithMessage("Logo URL must not exceed 500 characters");
            });

            When(x => !string.IsNullOrWhiteSpace(x.Description), () =>
            {
                RuleFor(x => x.Description)
                    .MaximumLength(1000).WithMessage("Description must not exceed 1000 characters");
            });
        }
    }

    public class UpdateCompanyCommandHandler(
        IUnitOfWork unitOfWork,
        ILogger<UpdateCompanyCommand> logger) : IRequestHandler<UpdateCompanyCommand, Result>
    {
        public async Task<Result> Handle(
            UpdateCompanyCommand command,
            CancellationToken cancellationToken = default)
        {
            try
            {
                var company = await unitOfWork.Companies
                    .FirstOrDefaultAsync(c => c.Id == command.CompanyId, cancellationToken);

                if (company is null)
                    return Result.Failure("Company not found");

                // Eyni adla başqa şirkətin olub-olmadığını yoxla
                if (await unitOfWork.Companies.AnyAsync(
                    c => c.Name == command.Name && c.Id != command.CompanyId, cancellationToken))
                    return Result.Failure("A company with this name already exists");

                company.UpdateName(command.Name);
                company.UpdateLogo(command.LogoUrl);
                company.UpdateDescription(command.Description);

                await unitOfWork.SaveChangesAsync(cancellationToken);

                logger.LogInformation("Company {CompanyId} updated", command.CompanyId);
                return Result.Success();
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error updating company {CompanyId}", command.CompanyId);
                return Result.Failure("An error occurred while updating the company");
            }
        }
    }
}
