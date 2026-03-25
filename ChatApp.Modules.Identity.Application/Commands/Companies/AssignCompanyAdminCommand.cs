using ChatApp.Modules.Identity.Application.Interfaces;
using ChatApp.Modules.Identity.Domain.Enums;
using ChatApp.Shared.Kernel.Common;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace ChatApp.Modules.Identity.Application.Commands.Companies
{
    /// <summary>
    /// SuperAdmin tərəfindən şirkətə Admin təyin etmək.
    /// İstifadəçini Admin roluna yüksəldir və şirkətə bağlayır.
    /// </summary>
    public record AssignCompanyAdminCommand(
        Guid CompanyId,
        Guid UserId
    ) : IRequest<Result>;

    public class AssignCompanyAdminCommandValidator : AbstractValidator<AssignCompanyAdminCommand>
    {
        public AssignCompanyAdminCommandValidator()
        {
            RuleFor(x => x.CompanyId)
                .NotEmpty().WithMessage("Company ID is required");

            RuleFor(x => x.UserId)
                .NotEmpty().WithMessage("User ID is required");
        }
    }

    public class AssignCompanyAdminCommandHandler(
        IUnitOfWork unitOfWork,
        ILogger<AssignCompanyAdminCommand> logger) : IRequestHandler<AssignCompanyAdminCommand, Result>
    {
        public async Task<Result> Handle(
            AssignCompanyAdminCommand command,
            CancellationToken cancellationToken = default)
        {
            try
            {
                var company = await unitOfWork.Companies
                    .FirstOrDefaultAsync(c => c.Id == command.CompanyId, cancellationToken);

                if (company is null)
                    return Result.Failure("Company not found");

                var user = await unitOfWork.Users
                    .FirstOrDefaultAsync(u => u.Id == command.UserId, cancellationToken);

                if (user is null)
                    return Result.Failure("User not found");

                // İstifadəçi artıq başqa şirkətin admini ola bilməz
                if (user.CompanyId.HasValue && user.CompanyId != command.CompanyId)
                    return Result.Failure("User belongs to a different company");

                user.ChangeRole(Role.Admin);
                user.AssignToCompany(command.CompanyId);

                await unitOfWork.SaveChangesAsync(cancellationToken);

                logger.LogInformation("User {UserId} assigned as Admin to company {CompanyId}",
                    command.UserId, command.CompanyId);
                return Result.Success();
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error assigning admin to company {CompanyId}", command.CompanyId);
                return Result.Failure("An error occurred while assigning company admin");
            }
        }
    }
}
