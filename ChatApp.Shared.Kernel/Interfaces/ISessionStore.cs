namespace ChatApp.Shared.Kernel.Interfaces;

/// <summary>
/// Stores opaque session ID → real JWT token mapping (BFF pattern)
/// Cookie holds only the opaque session ID, never the real token
/// </summary>
public interface ISessionStore
{
    /// <summary>
    /// Creates a new session with opaque ID mapped to access + refresh tokens
    /// </summary>
    Task<string> CreateSessionAsync(Guid userId, string accessToken, string refreshToken, TimeSpan accessTokenLifetime, TimeSpan refreshTokenLifetime);

    /// <summary>
    /// Gets the access token by opaque session ID
    /// </summary>
    Task<string?> GetAccessTokenAsync(string sessionId);

    /// <summary>
    /// Gets the refresh token by opaque session ID
    /// </summary>
    Task<string?> GetRefreshTokenAsync(string sessionId);

    /// <summary>
    /// Updates tokens for an existing session (used during token rotation)
    /// </summary>
    Task UpdateTokensAsync(string sessionId, string newAccessToken, string newRefreshToken, TimeSpan accessTokenLifetime, TimeSpan refreshTokenLifetime);

    /// <summary>
    /// Removes a session (used during logout)
    /// </summary>
    Task RemoveSessionAsync(string sessionId);

    /// <summary>
    /// Removes all sessions for a user (used during login to invalidate old sessions)
    /// </summary>
    Task RemoveAllUserSessionsAsync(Guid userId);
}
