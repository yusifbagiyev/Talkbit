# Backend Task: User Detail Page Support

**From**: Product Owner
**To**: Backend Developer
**Date**: 2026-03-27
**Priority**: P1

---

## Xülasə

Frontend üçün 2 yeni endpoint lazımdır:
1. `GET /api/identity/permissions` — bütün mövcud permission adları
2. `GET /api/files/storage/{userId}` — istifadəçinin fayl tutumu statistikası

---

## 1. GET /api/identity/permissions

**Controller**: `IdentityController` (yoxdursa `UsersController`-da əlavə et, ayrıca controller yarat)
**Auth**: `[RequirePermission("Permissions.Read")]`

Mövcud `Permissions.GetAll()` metodunu istifadə edərək bütün permission adlarını module-a görə qruplaşdırılmış şəkildə qaytarır.

### Response Shape

```json
[
  {
    "module": "Users",
    "permissions": ["Users.Create", "Users.Read", "Users.Update", "Users.Delete"]
  },
  {
    "module": "Permissions",
    "permissions": ["Permissions.Read", "Permissions.Assign", "Permissions.Revoke"]
  },
  {
    "module": "Messages",
    "permissions": ["Messages.Send", "Messages.Read", "Messages.Edit", "Messages.Delete"]
  },
  {
    "module": "Files",
    "permissions": ["Files.Upload", "Files.Download", "Files.Delete"]
  },
  {
    "module": "Channels",
    "permissions": ["Channels.Create", "Channels.Read", "Channels.Delete"]
  },
  {
    "module": "Companies",
    "permissions": ["Companies.Create", "Companies.Read", "Companies.Update", "Companies.Delete"]
  }
]
```

### Implementation

```csharp
[HttpGet("permissions")]
[RequirePermission("Permissions.Read")]
[ProducesResponseType(typeof(List<PermissionGroupDto>), StatusCodes.Status200OK)]
public IActionResult GetAllPermissions()
{
    var all = Permissions.GetAll();
    var grouped = all
        .GroupBy(p => p.Split('.')[0])
        .Select(g => new PermissionGroupDto(g.Key, g.ToList()))
        .ToList();
    return Ok(grouped);
}
```

```csharp
public record PermissionGroupDto(string Module, List<string> Permissions);
```

Yeni endpoint üçün `UsersController`-a əlavə et (ayrıca route: `GET /api/users/permissions`).

---

## 2. GET /api/files/storage/{userId}

**Controller**: `FilesController`
**Auth**: `[RequirePermission("Users.Read")]` (Admin öz şirkətinin istifadəçilərini görə bilər)

`FileMetadata` cədvəlindən həmin `userId`-a aid faylların ümumi ölçüsünü və sayını qaytarır.

### Response Shape

```json
{
  "userId": "guid",
  "totalBytes": 52428800,
  "totalMb": 50.0,
  "fileCount": 23,
  "imageCount": 12,
  "documentCount": 8,
  "otherCount": 3
}
```

### Implementation

```csharp
[HttpGet("storage/{userId:guid}")]
[RequirePermission("Users.Read")]
public async Task<IActionResult> GetUserStorageStats(
    [FromRoute] Guid userId,
    CancellationToken cancellationToken)
{
    var files = await _unitOfWork.Files
        .Where(f => f.UploadedBy == userId && !f.IsDeleted)
        .ToListAsync(cancellationToken);

    var totalBytes = files.Sum(f => f.FileSizeInBytes);
    var result = new UserStorageDto(
        UserId: userId,
        TotalBytes: totalBytes,
        TotalMb: Math.Round(totalBytes / 1_048_576.0, 2),
        FileCount: files.Count,
        ImageCount: files.Count(f => f.FileType == FileType.Image),
        DocumentCount: files.Count(f => f.FileType == FileType.Document),
        OtherCount: files.Count(f => f.FileType != FileType.Image && f.FileType != FileType.Document)
    );
    return Ok(result);
}
```

```csharp
public record UserStorageDto(
    Guid UserId,
    long TotalBytes,
    double TotalMb,
    int FileCount,
    int ImageCount,
    int DocumentCount,
    int OtherCount);
```

`IUnitOfWork`-da `Files` property-si varsa birbaşa istifadə et. Yoxdursa `IFileRepository` inject et.

---

## Qeydlər

- `GET /api/users/{userId}` artıq `UserDetailDto`-nu qaytarır: `Supervisors`, `Subordinates`, `Permissions`, `LastVisit`, `PasswordChangedAt` — **əlavə endpoint lazım deyil**.
- `GET /api/users/{userId}/storage` yox, `GET /api/files/storage/{userId}` — Files module-a aid.
- `GET /api/users/permissions` — bu endpoint yeni olacaq.
