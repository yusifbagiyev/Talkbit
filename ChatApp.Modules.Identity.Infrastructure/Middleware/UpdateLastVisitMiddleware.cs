using ChatApp.Modules.Identity.Infrastructure.Persistence;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using System.Collections.Concurrent;
using System.Security.Claims;

namespace ChatApp.Modules.Identity.Infrastructure.Middleware
{
    public class UpdateLastVisitMiddleware
    {
        private readonly RequestDelegate _next;
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<UpdateLastVisitMiddleware> _logger;

        private static readonly ConcurrentDictionary<Guid, DateTime> _lastUpdateTimes = new();
        private static readonly TimeSpan _throttleInterval = TimeSpan.FromMinutes(1);

        public UpdateLastVisitMiddleware(
            RequestDelegate next,
            IServiceScopeFactory scopeFactory,
            ILogger<UpdateLastVisitMiddleware> logger)
        {
            _next = next;
            _scopeFactory = scopeFactory;
            _logger = logger;
        }

        public async Task InvokeAsync(HttpContext context)
        {
            await _next(context);

            if (context.User?.Identity?.IsAuthenticated != true || context.Response.StatusCode >= 400)
                return;

            var userIdClaim = context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim) || !Guid.TryParse(userIdClaim, out var userId))
                return;

            var now = DateTime.UtcNow;

            if (_lastUpdateTimes.TryGetValue(userId, out var lastUpdate) &&
                now - lastUpdate < _throttleInterval)
                return;

            _lastUpdateTimes[userId] = now;

            _ = Task.Run(async () =>
            {
                try
                {
                    using var scope = _scopeFactory.CreateScope();
                    var identityContext = scope.ServiceProvider.GetRequiredService<IdentityDbContext>();

                    await identityContext.Users
                        .Where(u => u.Id == userId)
                        .ExecuteUpdateAsync(s => s.SetProperty(
                            u => u.LastVisit, now));
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to update LastVisit for user {UserId}", userId);
                }
            });
        }
    }
}