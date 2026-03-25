using ChatApp.Modules.Identity.Application.Interfaces;
using ChatApp.Shared.Kernel.Common;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace ChatApp.Modules.Identity.Application.Commands.Companies
{
    public record CreateCompanyCommand(
        string Name,
        string? LogoUrl,
        string? Description
    ) : IRequest<Result<Guid>>;

    public class CreateCompanyCommandValidator : AbstractValidator<CreateCompanyCommand>
    {
        public CreateCompanyCommandValidator()
        {
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

    public class CreateCompanyCommandHandler(
        IUnitOfWork unitOfWork,
        ILogger<CreateCompanyCommand> logger) : IRequestHandler<CreateCompanyCommand, Result<Guid>>
    {
        public async Task<Result<Guid>> Handle(
            CreateCompanyCommand command,
            CancellationToken cancellationToken = default)
        {
            try
            {
                // Eyni adla şirkətin olub-olmadığını yoxla
                if (await unitOfWork.Companies.AnyAsync(c => c.Name == command.Name, cancellationToken))
                    return Result.Failure<Guid>("A company with this name already exists");

                var company = new Domain.Entities.Company(
                    command.Name,
                    logoUrl: command.LogoUrl,
                    description: command.Description);

                await unitOfWork.Companies.AddAsync(company, cancellationToken);
                await unitOfWork.SaveChangesAsync(cancellationToken);

                logger.LogInformation("Company '{Name}' created with ID {CompanyId}", command.Name, company.Id);
                return Result.Success(company.Id);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error creating company '{Name}'", command.Name);
                return Result.Failure<Guid>("An error occurred while creating the company");
            }
        }
    }
}
