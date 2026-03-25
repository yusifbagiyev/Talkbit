using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Logging;
using System.Security.Claims;

namespace ChatApp.Shared.Infrastructure.Authorization
{
    public class PermissionAuthorizationHandler:AuthorizationHandler<PermissionRequirement>
    {
        private readonly ILogger<PermissionAuthorizationHandler> _logger;
        public PermissionAuthorizationHandler(ILogger<PermissionAuthorizationHandler> logger)
        {
            _logger = logger;
        }

        protected override Task HandleRequirementAsync(
            AuthorizationHandlerContext context, 
            PermissionRequirement requirement)
        {
            // Check if user is authenticated
            if (context.User?.Identity?.IsAuthenticated != true)
            {
                _logger?.LogWarning("User is not authenticated. Permission: {Permission}", requirement.PermissionName);
                return Task.CompletedTask;
            }

            // Get user ID for logging purposes
            var userId=context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value??"Unknown";

            // SuperAdmin bütün permission yoxlamalarını bypass edir
            var roleClaim = context.User.FindFirst("role")?.Value;
            if (roleClaim == "SuperAdmin")
            {
                context.Succeed(requirement);
                return Task.CompletedTask;
            }

            // Get all permission claims from the JWT token
            // When we generated the JWT, we added multiple claims with the type "permission"
            var permissions = context.User.FindAll("permission").Select(c => c.Value).ToList();

            // Check if the user has the required permission
            if (permissions.Contains(requirement.PermissionName))
            {
                context.Succeed(requirement);
            }
            else
            {
                _logger.LogWarning(
                    "User {UserId} does not have required permission {Permission}. User permissions: {UserPermissions}",
                    userId,
                    requirement.PermissionName,
                    string.Join(", ", permissions));
            }
            return Task.CompletedTask;
        }
    }
}