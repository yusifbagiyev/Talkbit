using ChatApp.Shared.Kernel.Interfaces;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Logging;
using System.Security.Cryptography;
using System.Text.Json;

namespace ChatApp.Shared.Infrastructure.Session;

/// <summary>
/// Redis-backed session store for BFF pattern.
/// Sessions survive server restarts.
/// If Redis is unavailable at runtime, operations fail gracefully (no crash).
/// - Read operations return null → user appears unauthenticated
/// - Write operations are silently skipped → login will fail with a clear error
/// Redis must be available for normal operation; this is only crash protection.
/// </summary>
public class RedisSessionStore : ISessionStore
{
    private readonly IDistributedCache _cache;
    private readonly ILogger<RedisSessionStore> _logger;
    private static readonly JsonSerializerOptions _jsonOptions = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    public RedisSessionStore(IDistributedCache cache, ILogger<RedisSessionStore> logger)
    {
        _cache = cache;
        _logger = logger;
    }

    public async Task<string> CreateSessionAsync(Guid userId, string accessToken, string refreshToken, TimeSpan accessTokenLifetime, TimeSpan refreshTokenLifetime)
    {
        var sessionId = GenerateOpaqueId();

        var sessionData = new SessionData
        {
            UserId = userId,
            AccessToken = accessToken,
            RefreshToken = refreshToken,
            AccessTokenExpiresAt = DateTime.UtcNow.Add(accessTokenLifetime),
            RefreshTokenExpiresAt = DateTime.UtcNow.Add(refreshTokenLifetime)
        };

        var options = new DistributedCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = refreshTokenLifetime
        };

        try
        {
            await _cache.SetStringAsync(SessionKey(sessionId), JsonSerializer.Serialize(sessionData, _jsonOptions), options);
            await AddSessionToUserAsync(userId, sessionId, refreshTokenLifetime);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Redis unavailable — failed to create session for user {UserId}", userId);
            throw; // Login must fail if session can't be stored
        }

        return sessionId;
    }

    public async Task<string?> GetAccessTokenAsync(string sessionId)
    {
        var data = await GetSessionDataAsync(sessionId);

        if (data != null && data.AccessTokenExpiresAt > DateTime.UtcNow)
            return data.AccessToken;

        return null;
    }

    public async Task<string?> GetRefreshTokenAsync(string sessionId)
    {
        var data = await GetSessionDataAsync(sessionId);

        if (data != null && data.RefreshTokenExpiresAt > DateTime.UtcNow)
            return data.RefreshToken;

        return null;
    }

    public async Task UpdateTokensAsync(string sessionId, string newAccessToken, string newRefreshToken, TimeSpan accessTokenLifetime, TimeSpan refreshTokenLifetime)
    {
        try
        {
            var data = await GetSessionDataAsync(sessionId);

            if (data != null)
            {
                data.AccessToken = newAccessToken;
                data.RefreshToken = newRefreshToken;
                data.AccessTokenExpiresAt = DateTime.UtcNow.Add(accessTokenLifetime);
                data.RefreshTokenExpiresAt = DateTime.UtcNow.Add(refreshTokenLifetime);

                var options = new DistributedCacheEntryOptions
                {
                    AbsoluteExpirationRelativeToNow = refreshTokenLifetime
                };

                await _cache.SetStringAsync(SessionKey(sessionId), JsonSerializer.Serialize(data, _jsonOptions), options);

                // Sliding expiration: user_sessions TTL-ini də yenilə
                await RefreshUserSessionsTtlAsync(data.UserId, refreshTokenLifetime);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Redis unavailable — failed to update tokens for session");
        }
    }

    public async Task RemoveSessionAsync(string sessionId)
    {
        try
        {
            var data = await GetSessionDataAsync(sessionId);

            if (data != null)
            {
                await _cache.RemoveAsync(SessionKey(sessionId));
                await RemoveSessionFromUserAsync(data.UserId, sessionId);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Redis unavailable — failed to remove session");
        }
    }

    public async Task RemoveAllUserSessionsAsync(Guid userId)
    {
        try
        {
            var sessions = await GetUserSessionsAsync(userId);

            if (sessions != null)
            {
                foreach (var sid in sessions)
                {
                    await _cache.RemoveAsync(SessionKey(sid));
                }

                await _cache.RemoveAsync(UserSessionsKey(userId));
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Redis unavailable — failed to remove all sessions for user {UserId}", userId);
        }
    }

    private async Task<SessionData?> GetSessionDataAsync(string sessionId)
    {
        try
        {
            var json = await _cache.GetStringAsync(SessionKey(sessionId));

            if (string.IsNullOrEmpty(json))
                return null;

            return JsonSerializer.Deserialize<SessionData>(json, _jsonOptions);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Redis unavailable — failed to read session data");
            return null;
        }
    }

    private async Task<HashSet<string>?> GetUserSessionsAsync(Guid userId)
    {
        try
        {
            var json = await _cache.GetStringAsync(UserSessionsKey(userId));

            if (string.IsNullOrEmpty(json))
                return null;

            return JsonSerializer.Deserialize<HashSet<string>>(json, _jsonOptions);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Redis unavailable — failed to read user sessions for {UserId}", userId);
            return null;
        }
    }

    private async Task AddSessionToUserAsync(Guid userId, string sessionId, TimeSpan lifetime)
    {
        var sessions = await GetUserSessionsAsync(userId) ?? [];
        sessions.Add(sessionId);

        var options = new DistributedCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = lifetime
        };

        await _cache.SetStringAsync(UserSessionsKey(userId), JsonSerializer.Serialize(sessions, _jsonOptions), options);
    }

    private async Task RefreshUserSessionsTtlAsync(Guid userId, TimeSpan lifetime)
    {
        var sessions = await GetUserSessionsAsync(userId);
        if (sessions != null && sessions.Count > 0)
        {
            var options = new DistributedCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = lifetime
            };
            await _cache.SetStringAsync(UserSessionsKey(userId), JsonSerializer.Serialize(sessions, _jsonOptions), options);
        }
    }

    private async Task RemoveSessionFromUserAsync(Guid userId, string sessionId)
    {
        var sessions = await GetUserSessionsAsync(userId);

        if (sessions != null)
        {
            sessions.Remove(sessionId);

            if (sessions.Count > 0)
            {
                await _cache.SetStringAsync(UserSessionsKey(userId), JsonSerializer.Serialize(sessions, _jsonOptions));
            }
            else
            {
                await _cache.RemoveAsync(UserSessionsKey(userId));
            }
        }
    }

    private static string GenerateOpaqueId()
    {
        return Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
            .Replace("+", "-")
            .Replace("/", "_")
            .TrimEnd('=');
    }

    private static string SessionKey(string sessionId) => $"session:{sessionId}";
    private static string UserSessionsKey(Guid userId) => $"user_sessions:{userId}";

    private class SessionData
    {
        public Guid UserId { get; set; }
        public string AccessToken { get; set; } = default!;
        public string RefreshToken { get; set; } = default!;
        public DateTime AccessTokenExpiresAt { get; set; }
        public DateTime RefreshTokenExpiresAt { get; set; }
    }
}
