# Backend Task: Store Relative Path in DB, Not Absolute

**From**: Product Owner
**To**: Backend Developer
**Date**: 2026-03-29
**Priority**: P1 — Security + Architecture

---

## Problem

`file_metadata.storage_path` column stores full absolute disk path:
```
D:\ChatAppUploads\company/33f6ffa4-.../users/25b8d0b0-.../images/direct_messages/0d307fce-.../e0d15034-...jpg
```

This is wrong for multiple reasons:

### Security
- **Internal structure leak** — full disk path exposes server OS, drive layout, directory structure
- **Path traversal risk** — absolute paths in DB increase `../` injection surface
- **Error/log leak** — exceptions and API responses may expose `D:\ChatAppUploads` to clients

### Architecture
- **Not portable** — if storage moves to another drive, Linux server, or cloud (S3), all DB paths break
- **Redundant** — base path (`D:\ChatAppUploads`) is already in `appsettings.json` (`FileStorage:LocalPath`)
- **Mixed slashes** — `\` and `/` mixed in same path (Windows + code-generated)

---

## Solution: Store Only Relative Path

DB should store: `company/{companyId}/users/{userId}/images/direct_messages/{convId}/{fileName}.jpg`

Full disk path is constructed at runtime: `{config.LocalPath}/{storagePath}`
Browser URL is constructed: `/uploads/{storagePath}`

---

## Changes Required

### 1. UploadFileCommand Handler — Save Relative Path

**File:** `ChatApp.Modules.Files.Application/Commands/UploadFile/UploadFileCommand.cs`

Currently `SaveFileAsync` returns the full disk path and that gets stored in `FileMetadata.StoragePath`.

Change: Store only the relative directory + filename:

```csharp
// Current (WRONG):
var fullPath = await _fileStorageService.SaveFileAsync(file, uniqueFileName, directory, ct);
// fullPath = "D:\ChatAppUploads\company\{cId}\users\{uId}\images\..."
// This gets stored in FileMetadata.StoragePath

// New (CORRECT):
await _fileStorageService.SaveFileAsync(file, uniqueFileName, directory, ct);
var relativePath = $"{directory}/{uniqueFileName}".Replace("\\", "/");
// relativePath = "company/{cId}/users/{uId}/images/..."
// Store THIS in FileMetadata.StoragePath
```

FileMetadata creation should use `relativePath`, not `fullPath`.

### 2. LocalFileStorageService — No Change Needed

`SaveFileAsync` still uses full paths internally for disk I/O — that's fine. The change is only in what gets STORED in DB.

### 3. DeleteFileAsync — Construct Full Path at Runtime

**File:** `ChatApp.Modules.Files.Infrastructure/Services/LocalFileStorageService.cs`

When deleting a file, construct full path from config + relative path:

```csharp
public Task DeleteFileAsync(string storagePath, CancellationToken ct = default)
{
    // storagePath is now RELATIVE: "company/{cId}/users/{uId}/..."
    var fullPath = Path.Combine(_baseStoragePath, storagePath);
    if (File.Exists(fullPath))
    {
        File.Delete(fullPath);
    }
    return Task.CompletedTask;
}
```

Check if this is already combining paths or expecting absolute. If it expects absolute, fix it to combine.

### 4. GetFileStreamAsync — Same Pattern

```csharp
public Task<Stream> GetFileStreamAsync(string storagePath, CancellationToken ct = default)
{
    var fullPath = Path.Combine(_baseStoragePath, storagePath);
    // ...
}
```

### 5. Download URL Generation — Already Correct?

**File:** `UploadFileCommand.cs` (around line 221-224)

Currently:
```csharp
var relativePath = $"/uploads/{directory}/{uniqueFileName}".Replace("\\", "/");
var downloadUrl = $"{apiBaseUrl.TrimEnd('/')}{relativePath}";
```

This is correct — download URL uses relative path. Just make sure `StoragePath` in DB matches the relative portion (without `/uploads/` prefix).

### 6. Static File Serving — Verify

**File:** `Program.cs` (static files config)

```csharp
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(fileStoragePath), // D:\ChatAppUploads
    RequestPath = "/uploads",
});
```

This maps `/uploads/company/{cId}/...` to `D:\ChatAppUploads\company/{cId}/...` — works with relative paths. No change needed.

### 7. CleanupOldAvatarFileAsync — Verify Path Handling

**File:** `FilesController.cs`

This method extracts filename from avatar URL and finds FileMetadata. If it uses `StoragePath` to delete the file, make sure it combines with base path:

```csharp
// Old (if using absolute path directly):
await _fileStorageService.DeleteFileAsync(fileMetadata.StoragePath, ct);

// New (if StoragePath is now relative, and DeleteFileAsync already combines):
// No change needed — DeleteFileAsync handles it
```

### 8. Normalize Slashes

All stored paths should use forward slashes only:

```csharp
var relativePath = $"{directory}/{uniqueFileName}".Replace("\\", "/");
```

No `\` should ever appear in DB.

---

## Migration for Existing Data

Existing `storage_path` values need to be converted from absolute to relative:

```csharp
migrationBuilder.Sql(@"
    UPDATE file_metadata
    SET storage_path = REPLACE(
        REPLACE(storage_path, 'D:\ChatAppUploads\', ''),
        '\', '/')
    WHERE storage_path LIKE 'D:\%' OR storage_path LIKE '%\%';
");
```

> **Note:** Check the exact base path in `appsettings.json` before writing migration. Adjust the replace string accordingly. Also handle both `D:\ChatAppUploads\` and `D:\ChatAppUploads/` variants.

---

## Test

1. Upload a file in DM → check `file_metadata.storage_path` in DB → should be `company/{cId}/users/{uId}/images/direct_messages/{convId}/{file}.jpg`
2. File should still be accessible via `http://localhost:7000/uploads/company/{cId}/...`
3. Delete file → physical file should be deleted from disk
4. No absolute path (`D:\`) should appear anywhere in DB
5. No backslashes (`\`) should appear in DB paths

---

## Notes

- `FileStorage:LocalPath` config is the ONLY place the base path exists
- DB stores relative path, runtime constructs full path when needed
- Forward slashes only in DB — cross-platform safe
- Download URLs already use relative paths — this change aligns DB with URLs
