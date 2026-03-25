using ChatApp.Modules.Identity.Application.DTOs.Responses;
using ChatApp.Modules.Identity.Application.Interfaces;
using ChatApp.Modules.Identity.Domain.Constants;
using ChatApp.Modules.Identity.Domain.Entities;
using ChatApp.Modules.Identity.Domain.Enums;
using ChatApp.Modules.Identity.Domain.Services;
using ChatApp.Shared.Kernel.Common;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace ChatApp.Modules.Identity.Application.Commands.RefreshToken
{
    public record RefreshTokenCommand(string RefreshToken) : IRequest<Result<RefreshTokenResponse>>;

    public class RefreshTokenCommandHandler(
        IUnitOfWork unitOfWork,
        ITokenGenerator tokenGenerator,
        ILogger<RefreshTokenCommand> logger,
        IConfiguration configuration) : IRequestHandler<RefreshTokenCommand, Result<RefreshTokenResponse>>
    {
        private const int DefaultAccessTokenExpirationMinutes = 30;
        private const int DefaultRefreshTokenExpirationDays = 30;

        public async Task<Result<RefreshTokenResponse>> Handle(
            RefreshTokenCommand request,
            CancellationToken cancellationToken = default)
        {
            try
            {
                logger.LogInformation("Refresh token request received");

                var refreshToken = await unitOfWork.RefreshTokens
                    .FirstOrDefaultAsync(rt => rt.Token == request.RefreshToken, cancellationToken);

                if (refreshToken is null || !refreshToken.IsValid())
                {
                    logger?.LogWarning("Invalid or expired refresh token");
                    return Result.Failure<RefreshTokenResponse>("Invalid or expired refresh token");
                }

                var user = await FindUserWithPermissionsAsync(refreshToken.UserId, cancellationToken);

                if (user is null || !user.IsActive)
                {
                    logger.LogWarning("User {UserId} not found or inactive", refreshToken.UserId);
                    return Result.Failure<RefreshTokenResponse>("User not found or inactive");
                }

                var permissions = await GetUserPermissionsAsync(user, cancellationToken);

                var (newAccessToken, newRefreshToken) = await RegenerateTokensAsync(
                    user,
                    permissions,
                    refreshToken,
                    cancellationToken);

                var accessTokenExpiration = GetAccessTokenExpirationMinutes();

                logger?.LogInformation("Tokens refreshed successfully for user {UserId}", user.Id);

                return Result.Success(new RefreshTokenResponse(
                    newAccessToken,
                    newRefreshToken,
                    accessTokenExpiration * 60)); // Convert to seconds
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error refreshing token");
                return Result.Failure<RefreshTokenResponse>("An error occurred while refreshing the token");
            }
        }

        private async Task<User?> FindUserWithPermissionsAsync(
            Guid userId,
            CancellationToken cancellationToken)
        {
            return await unitOfWork.Users
                .Include(u => u.UserPermissions)
                .FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);
        }

        private Task<List<string>> GetUserPermissionsAsync(
            User user,
            CancellationToken cancellationToken)
        {
            // SuperAdmin və Admin — roluna uyğun permissionlar
            if (user.Role == Role.Admin || user.Role == Role.SuperAdmin)
            {
                return Task.FromResult(Permissions.GetDefaultForRole(user.Role).ToList());
            }

            // Adi istifadəçilər yalnız fərdi permissionlarını alır
            return Task.FromResult(user.UserPermissions
                .Select(up => up.PermissionName)
                .ToList());
        }

        private async Task<(string AccessToken, string RefreshToken)> RegenerateTokensAsync(
            User user,
            List<string> permissions,
            Domain.Entities.RefreshToken oldRefreshToken,
            CancellationToken cancellationToken)
        {
            var newAccessToken = tokenGenerator.GenerateAccessToken(user, permissions);
            var newRefreshTokenValue = tokenGenerator.GenerateRefreshToken();

            // Revoke old token
            oldRefreshToken.Revoke();

            // Create new refresh token
            var newRefreshToken = new Domain.Entities.RefreshToken(
                user.Id,
                newRefreshTokenValue,
                DateTime.UtcNow.AddDays(GetRefreshTokenExpirationDays()));

            await unitOfWork.RefreshTokens.AddAsync(newRefreshToken, cancellationToken);
            await unitOfWork.SaveChangesAsync(cancellationToken);

            return (newAccessToken, newRefreshTokenValue);
        }

        private int GetAccessTokenExpirationMinutes() =>
            configuration.GetValue("JwtSettings:AccessTokenExpirationMinutes", DefaultAccessTokenExpirationMinutes);

        private int GetRefreshTokenExpirationDays() =>
            configuration.GetValue("JwtSettings:RefreshTokenExpirationDays", DefaultRefreshTokenExpirationDays);
    }
}