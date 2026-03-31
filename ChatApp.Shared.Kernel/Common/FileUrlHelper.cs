namespace ChatApp.Shared.Kernel.Common;

/// <summary>
/// fileId-dən authenticated serve/avatar URL yaradır.
/// Frontend bu URL-lərdən authenticated fetch + blob URL pattern ilə istifadə edir.
/// </summary>
public static class FileUrlHelper
{
    private const string ServePrefix = "/api/files/serve/";
    private const string AvatarPrefix = "/api/files/avatar/";

    public static string? ToServeUrl(Guid? fileId)
    {
        if (!fileId.HasValue || fileId == Guid.Empty)
            return null;

        return $"{ServePrefix}{fileId}";
    }

    public static string? ToServeUrl(string? fileId)
    {
        if (string.IsNullOrEmpty(fileId))
            return null;

        return $"{ServePrefix}{fileId}";
    }

    public static string? ToAvatarUrl(Guid? fileId)
    {
        if (!fileId.HasValue || fileId == Guid.Empty)
            return null;

        return $"{AvatarPrefix}{fileId}";
    }

    /// <summary>
    /// Avatar URL transform — idempotent.
    /// Yeni format (/api/files/avatar/{id}) → dəyişməz qaytarır.
    /// GUID string → /api/files/avatar/{guid} yaradır.
    /// Köhnə format (/uploads/... və ya http://...) → dəyişmədən qaytarır.
    /// </summary>
    public static string? ToAvatarUrl(string? input)
    {
        if (string.IsNullOrEmpty(input))
            return null;

        // Artıq yeni formatdadır — idempotent
        if (input.StartsWith("/api/files/"))
            return input;

        // GUID fileId olaraq gəlirsə
        if (Guid.TryParse(input, out _))
            return $"{AvatarPrefix}{input}";

        // Köhnə format — dəyişmədən qaytar (UseStaticFiles silinib, frontend handle edəcək)
        return input;
    }
}
