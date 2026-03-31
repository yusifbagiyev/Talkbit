# Backend Task: Employee Drive Module

**From**: Product Owner
**To**: Backend Developer
**Date**: 2026-03-31
**Priority**: P1
**Depends On**: UI/UX spec — `2026-03-31_1700_drive-module-uiux.md`

---

## Xülasə

Mövcud Files modulunu genişləndirərək Drive funksionallığı əlavə et. Hər istifadəçinin şəxsi fayl saxlama sahəsi — 3GB limit, folder dəstəyi, recycle bin (30 gün soft delete). Yeni modul yaratmağa ehtiyac yoxdur — Files modulu genişləndirilir.

**Mövcud resurslar:**
- `FileMetadata` entity — artıq `IsDeleted`, `DeletedAtUtc`, `DeletedBy` dəstəkləyir
- `UploadFileCommand` — artıq `companies/{companyId}/users/{userId}/drive` path-ə yönləndirir (line 340)
- `ServeFile` / `Avatar` authenticated endpoint-ləri hazırdır

---

## 1. Yeni Entity: DriveFolder

```csharp
public class DriveFolder : Entity
{
    public string Name { get; private set; }
    public Guid OwnerId { get; private set; }           // User ID
    public Guid? CompanyId { get; private set; }
    public Guid? ParentFolderId { get; private set; }    // null = root
    public DateTime CreatedAtUtc { get; private set; }
    public DateTime? UpdatedAtUtc { get; private set; }
    public bool IsDeleted { get; private set; }
    public DateTime? DeletedAtUtc { get; private set; }
}
```

---

## 2. FileMetadata Genişləndirilməsi

Mövcud `FileMetadata` entity-ə əlavə:
- `Guid? FolderId` — hansı drive folder-dədir (null = root)
- `bool IsDriveFile` — drive faylıdır (mesaj fayllarından fərqləndirmək üçün)

---

## 3. API Endpoint-ləri

### Folders
| Method | Endpoint | Təsvir |
|--------|----------|--------|
| GET | `/api/drive/folders?parentId={id}` | Folder-in uşaqlarını al (null = root) |
| POST | `/api/drive/folders` | Yeni folder yarat |
| PUT | `/api/drive/folders/{id}` | Folder adını dəyiş |
| PUT | `/api/drive/folders/{id}/move` | Folder-i başqa folder-ə köçür |
| DELETE | `/api/drive/folders/{id}` | Folder-i recycle bin-ə göndər |

### Files
| Method | Endpoint | Təsvir |
|--------|----------|--------|
| GET | `/api/drive/files?folderId={id}` | Folder-dəki faylları al (null = root) |
| POST | `/api/drive/upload` | Drive-a fayl yüklə (compression yoxdur) |
| PUT | `/api/drive/files/{id}/rename` | Fayl adını dəyiş |
| PUT | `/api/drive/files/{id}/move` | Faylı başqa folder-ə köçür |
| DELETE | `/api/drive/files/{id}` | Faylı recycle bin-ə göndər |

### Recycle Bin
| Method | Endpoint | Təsvir |
|--------|----------|--------|
| GET | `/api/drive/trash` | Silinmiş fayllar/folder-lər (30 gün) |
| PUT | `/api/drive/trash/{id}/restore` | Faylı/folder-i bərpa et |
| DELETE | `/api/drive/trash/{id}` | Permanent sil |
| DELETE | `/api/drive/trash` | Recycle bin-i boşalt |

### Quota
| Method | Endpoint | Təsvir |
|--------|----------|--------|
| GET | `/api/drive/quota` | İstifadə olunan / limit (bytes) |

---

## 4. Əsas Qaydalar

- **Privacy**: Bütün endpoint-lər yalnız `OwnerId == currentUserId` fayllarını qaytarır. Heç bir istifadəçi başqasının drive-ını görə bilməz.
- **Quota**: Upload zamanı yoxla — `currentUsage + newFileSize <= 3GB`. Aşarsa 400 Bad Request.
- **No compression**: Drive faylları compress olunmur — original halı ilə saxlanılır.
- **Soft delete**: Delete → `IsDeleted = true`, `DeletedAtUtc = now`. 30 gündən sonra background job ilə permanent sil (və ya manual empty trash).
- **Folder delete**: Recursive — folder silinəndə içindəki bütün fayllar və sub-folder-lər də recycle bin-ə düşür.
- **Storage path**: `companies/{companyId}/users/{userId}/drive/{folderId}/filename`

---

## 5. Sort & Filter

`GET /api/drive/files` query parameters:
- `sortBy`: `name`, `date`, `size`, `type` (default: `date`)
- `sortOrder`: `asc`, `desc` (default: `desc`)
- `search`: fayl/folder adında axtarış

---

## 6. Permissions

Yeni permission: `Drive.Access` — drive-a giriş icazəsi. Default olaraq bütün active user-lara verilir.

---

## Acceptance Criteria

- [ ] Drive folder CRUD işləyir (create, rename, move, delete)
- [ ] Drive fayl upload/rename/move/delete işləyir
- [ ] Yalnız öz fayllarını görür (privacy)
- [ ] 3GB quota enforcement — aşanda 400 qaytarır
- [ ] Recycle bin — 30 gün saxlayır, restore işləyir
- [ ] Sort & search işləyir
- [ ] Fayllar compress olunmur
