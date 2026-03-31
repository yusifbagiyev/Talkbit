# Backend Task: SearchRepository Avatar URL Transform

**From**: Product Owner
**To**: Backend Developer
**Date**: 2026-03-31
**Priority**: P0 — File security proxy task-ının son hissəsi

---

## Problem

SearchRepository-də 2 yerdə avatar URL birbaşa DB-dən oxunur və `FileUrlHelper.ToAvatarUrl()` transform olunmadan DTO-ya yazılır.

---

## Düzəlişlər

**Fayl:** `ChatApp.Modules.Search.Infrastructure/Repositories/SearchRepository.cs`

### 1. Line 85 — Channel message search

```
r.SenderAvatarUrl
```
→
```
FileUrlHelper.ToAvatarUrl(r.SenderAvatarUrl)
```

### 2. Line 174 — DM search

```
item.Sender.AvatarUrl
```
→
```
FileUrlHelper.ToAvatarUrl(item.Sender.AvatarUrl)
```

---

## Qeyd

- Hər iki yer materialization sonrasıdır (`.ToListAsync()` artıq çağırılıb) — EF LINQ problemi yoxdur
- `using ChatApp.Shared.Kernel.Common;` əlavə etməyi unutma
