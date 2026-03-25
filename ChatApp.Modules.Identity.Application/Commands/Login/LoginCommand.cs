using ChatApp.Modules.Identity.Application.DTOs.Responses;
using ChatApp.Modules.Identity.Application.Interfaces;
using ChatApp.Modules.Identity.Domain.Constants;
using ChatApp.Modules.Identity.Domain.Entities;
using ChatApp.Modules.Identity.Domain.Enums;
using ChatApp.Modules.Identity.Domain.Services;
using ChatApp.Shared.Kernel.Common;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace ChatApp.Modules.Identity.Application.Commands.Login
{
    public record LoginCommand(
        string Email,
        string Password,
        bool RememberMe = false
    ) : IRequest<Result<LoginResponse>>;

    public class LoginCommandValidator : AbstractValidator<LoginCommand>
    {
        public LoginCommandValidator()
        {
            RuleFor(x => x.Email)
                .NotEmpty().WithMessage("Email is required")
                .EmailAddress().WithMessage("Invalid email format");

            RuleFor(x => x.Password)
                .NotEmpty().WithMessage("Password is required");
        }
    }

    public class LoginCommandHandler(
        IUnitOfWork unitOfWork,
        IPasswordHasher passwordHasher,
        ITokenGenerator tokenGenerator,
        ILogger<LoginCommand> logger,
        IConfiguration configuration) : IRequestHandler<LoginCommand, Result<LoginResponse>>
    {
        private const int DefaultAccessTokenExpirationMinutes = 30;
        private const int DefaultRefreshTokenExpirationDays = 30;

        public async Task<Result<LoginResponse>> Handle(
            LoginCommand command,
            CancellationToken cancellationToken = default)
        {
            try
            {
                var user = await FindUserWithPermissionsAsync(command.Email, cancellationToken);

                if (user is null)
                {
                    logger?.LogWarning("Login failed: User with email {Email} not found", command.Email);
                    return Result.Failure<LoginResponse>("Invalid email or password");
                }

                var validationResult = ValidateUser(user, command.Password);
                if (!validationResult.IsSuccess)
                    return Result.Failure<LoginResponse>(validationResult.Error!);

                var permissions = await GetUserPermissionsAsync(user, cancellationToken);

                var (accessToken, refreshToken) = await GenerateAndSaveTokensAsync(user, permissions, cancellationToken);

                logger?.LogInformation("Login successful for user {Email}", command.Email);

                var accessTokenExpiration = GetAccessTokenExpirationMinutes();
                return Result.Success(new LoginResponse(
                    accessToken,
                    refreshToken,
                    accessTokenExpiration * 60, // Convert to seconds
                    command.RememberMe));
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error during login for email: {Email}", command.Email);
                return Result.Failure<LoginResponse>("An error occurred during login");
            }
        }

        private async Task<User?> FindUserWithPermissionsAsync(
            string email,
            CancellationToken cancellationToken)
        {
            return await unitOfWork.Users
                .Include(u => u.UserPermissions)
                .FirstOrDefaultAsync(u => u.Email == email, cancellationToken);
        }

        private Result ValidateUser(User user, string password)
        {
            if (!user.IsActive)
            {
                logger.LogWarning("Login failed: User {Email} is not active", user.Email);
                return Result.Failure("Account is deactivated");
            }

            if (!passwordHasher.Verify(password, user.PasswordHash))
            {
                logger.LogWarning("Login failed: Invalid password for {Email}", user.Email);
                return Result.Failure("Invalid email or password");
            }

            return Result.Success();
        }

        private static Task<List<string>> GetUserPermissionsAsync(
            User user,
            CancellationToken cancellationToken)
        {
            // SuperAdmin və Admin — bütün permissionları alır (Admin öz şirkəti daxilində)
            if (user.Role == Role.Admin || user.Role == Role.SuperAdmin)
            {
                return Task.FromResult(Permissions.GetDefaultForRole(user.Role).ToList());
            }

            // Adi istifadəçilər yalnız fərdi permissionlarını alır
            return Task.FromResult(user.UserPermissions
                .Select(up => up.PermissionName)
                .ToList());
        }

        private async Task<(string AccessToken, string RefreshToken)> GenerateAndSaveTokensAsync(
            User user,
            List<string> permissions,
            CancellationToken cancellationToken)
        {
            var accessToken = tokenGenerator.GenerateAccessToken(user, permissions);
            var refreshToken = tokenGenerator.GenerateRefreshToken();

            var refreshTokenEntity = new Domain.Entities.RefreshToken(
                user.Id,
                refreshToken,
                DateTime.UtcNow.AddDays(GetRefreshTokenExpirationDays()));

            await unitOfWork.RefreshTokens.AddAsync(refreshTokenEntity, cancellationToken);
            await unitOfWork.SaveChangesAsync(cancellationToken);

            return (accessToken, refreshToken);
        }

        private int GetAccessTokenExpirationMinutes() =>
            int.TryParse(configuration["JwtSettings:AccessTokenExpirationMinutes"], out var minutes)
                ? minutes
                : DefaultAccessTokenExpirationMinutes;

        private int GetRefreshTokenExpirationDays() =>
            int.TryParse(configuration["JwtSettings:RefreshTokenExpirationDays"], out var days)
                ? days
                : DefaultRefreshTokenExpirationDays;
    }
}