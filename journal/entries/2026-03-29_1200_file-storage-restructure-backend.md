# Backend Task: File Storage Path Restructure

**From**: Product Owner
**To**: Backend Developer
**Date**: 2026-03-29
**Priority**: P1

---

## Xülasə

`DetermineStorageDirectory()` metodu yanlış path-lər generate edir. Yenidən yazılmalıdır. `drive/` yalnız gələcək personal storage üçündür — conversation faylları ora düşməməlidir.

---

## Təsdiqlənmiş Folder Strukturu

```
company/{companyId}/
├── avatar/                              ← Company avatar
├── departments/{deptId}/                ← Department avatar
└── users/{userId}/
    ├── avatar/                          ← Profile picture
    ├── drive/                           ← YALNIZ gələcək personal file storage
    ├── images/
    │   ├── direct_messages/{convId}/    ← DM-dəki şəkillər/video/audio
    │   └── channel_messages/{chId}/     ← Channel-dakı şəkillər/video/audio
    └── files/
        ├── direct_messages/{convId}/    ← DM-dəki sənədlər
        └── channel_messages/{chId}/     ← Channel-dakı sənədlər
```

---

## Dəyişiklik 1: DetermineStorageDirectory() Yenidən Yaz

**Fayl:** `ChatApp.Modules.Files.Application/Commands/UploadFile/UploadFileCommand.cs`

Mövcud metodu (təxminən line 287-332) tamamilə dəyişdir:

```csharp
private static string DetermineStorageDirectory(
    Guid uploadedBy,
    Guid? companyId,
    bool isProfilePicture,
    bool isCompanyAvatar,
    bool isChannelAvatar,
    Guid? channelAvatarTargetId,
    FileType fileType,
    Guid? channelId,
    Guid? conversationId,
    bool isDepartmentAvatar = false,
    Guid? departmentId = null)
{
    // companyId null olmamalıdır (SuperAdmin xaricində)
    var companySegment = companyId.HasValue
        ? $"company/{companyId}"
        : throw new InvalidOperationException("CompanyId is required for file storage");

    // 1. Company avatar
    if (isCompanyAvatar)
        return $"{companySegment}/avatar";

    // 2. Department avatar
    if (isDepartmentAvatar)
        return departmentId.HasValue
            ? $"{companySegment}/departments/{departmentId}"
            : $"{companySegment}/departments/avatars";

    // 3. User profile picture
    if (isProfilePicture)
        return $"{companySegment}/users/{uploadedBy}/avatar";

    // 4. Channel avatar — channel-ın öz folder-ində saxla
    if (isChannelAvatar && channelAvatarTargetId.HasValue)
        return $"{companySegment}/users/{uploadedBy}/avatar";

    // 5. Media (image/video/audio) vs File (document/other)
    var isMedia = fileType == FileType.Image
               || fileType == FileType.Video
               || fileType == FileType.Audio;
    var typeSegment = isMedia ? "images" : "files";

    // 6. Channel message faylları
    if (channelId.HasValue)
        return $"{companySegment}/users/{uploadedBy}/{typeSegment}/channel_messages/{channelId}";

    // 7. Direct message faylları
    if (conversationId.HasValue)
        return $"{companySegment}/users/{uploadedBy}/{typeSegment}/direct_messages/{conversationId}";

    // 8. Kontekstsiz fayllar — drive (gələcək personal storage)
    return $"{companySegment}/users/{uploadedBy}/drive";
}
```

### Dəyişikliklər:

| Köhnə | Yeni | Səbəb |
|-------|------|-------|
| `$"company/{companyId}"` (null olanda `company/`) | `throw` əgər null | Malformatlanmış path-in qarşısını al |
| `media/channel/{chId}` | `images/channel_messages/{chId}` | Naming convention |
| `files/channel/{chId}` | `files/channel_messages/{chId}` | Naming convention |
| `media/direct_messages/{convId}` | `images/direct_messages/{convId}` | `media` → `images` |

> **Qeyd:** `drive/` path-i qalır amma yalnız heç bir kontekst olmadıqda istifadə olunur. Gələcəkdə Drive feature implement olunanda istifadəçinin personal faylları buraya yüklənəcək.

---

## Dəyişiklik 2: GetStorageStatsAsync — Department/Company Avatarlarını Sayma

**Fayl:** `ChatApp.Modules.Files.Infrastructure/Persistence/Repositories/FileRepository.cs`

`GetStorageStatsAsync` metodu (təxminən line 172-193) hal-hazırda `UploadedBy == userId` filteri ilə bütün faylları sayır — department avatarları da daxil olmaqla.

Department/company avatarlarını istisna et. `StoragePath`-ə əsasən filtr əlavə et:

```csharp
public async Task<(long TotalBytes, int FileCount, int ImageCount, int DocumentCount, int OtherCount)>
    GetStorageStatsAsync(Guid userId, CancellationToken cancellationToken = default)
{
    var result = await _context.FileMetadata
        .Where(f => f.UploadedBy == userId
                  && !f.IsDeleted
                  && !f.StoragePath.Contains("/departments/")   // Department avatarlarını sayma
                  && !f.StoragePath.Contains("/avatar"))        // Company avatarını sayma
        .GroupBy(_ => 1)
        .Select(g => new
        {
            TotalBytes = g.Sum(f => f.FileSizeInBytes),
            FileCount = g.Count(),
            ImageCount = g.Count(f => f.FileType == FileType.Image),
            DocumentCount = g.Count(f => f.FileType == FileType.Document),
            OtherCount = g.Count(f => f.FileType != FileType.Image && f.FileType != FileType.Document)
        })
        .FirstOrDefaultAsync(cancellationToken);

    // ... return logic ...
}
```

> **Qeyd:** `!f.StoragePath.Contains("/avatar")` — bu user-in öz profil şəklini də çıxarar. Əgər profil şəkli sayılmalıdırsa, filteri dəqiqləşdir:
> `&& !f.StoragePath.Contains("/departments/")` — yalnız department avatarlarını çıxar.
> Company avatar isə admin tərəfindən yüklənir — `company/{cId}/avatar/` path-indədir.

---

## Dəyişiklik 3: SuperAdmin Upload — companyId null

SuperAdmin-in `companyId`-si yoxdur. File upload zamanı `companyId` null olduqda exception atılır.

**Həll:** SuperAdmin fayl yükləyə bilməz (və ya yalnız company/department avatar yükləyə bilər — orada companyId route-dan gəlir).

`FilesController.cs`-dəki ümumi upload endpoint-ində (`POST /api/files/upload`):

```csharp
var companyId = GetCallerCompanyId();
if (companyId is null || companyId == Guid.Empty)
    return BadRequest("Company context is required for file upload");
```

> **Qeyd:** Company avatar və department avatar endpoint-lərində `companyId` artıq route-dan gəlir — problem yoxdur. Yalnız ümumi upload endpoint-ində yoxla.

---

## Mövcud Fayllar

Diskdəki köhnə fayllar (`shared/`, `system/`) manual silinəcək — kod onları bir daha yaratmayacaq. DB-dəki `StoragePath` dəyərləri köhnə fayllar üçün dəyişdirilməyəcək — artıq download URL-ləri sabitdir.

Yeni yüklənən fayllar yeni struktura uyğun olacaq.

---

## Test Ssenarisi

1. DM-də şəkil yüklə → `company/{cId}/users/{uId}/images/direct_messages/{convId}/` altına düşməlidir
2. Channel-da sənəd yüklə → `company/{cId}/users/{uId}/files/channel_messages/{chId}/` altına düşməlidir
3. Department avatar yüklə → `company/{cId}/departments/{deptId}/` altına düşməlidir
4. Profile picture yüklə → `company/{cId}/users/{uId}/avatar/` altına düşməlidir
5. User storage stats → department avatarları sayılmamalıdır
6. SuperAdmin ümumi upload → 400 Bad Request
