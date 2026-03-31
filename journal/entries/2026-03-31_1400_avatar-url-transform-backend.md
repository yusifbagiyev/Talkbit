# Backend Task: Avatar URL Transform — FileUrlHelper.ToAvatarUrl() istifadəsi

**From**: Product Owner
**To**: Backend Developer
**Date**: 2026-03-31
**Priority**: P0 — File security proxy task-ının davamı
**Depends On**: `2026-03-31_1200_file-security-proxy-backend.md` (tamamlanıb)

---

## Problem

`FileUrlHelper.ToAvatarUrl()` metodu yaradılıb, amma avatar qaytaran query və repository-lərdə istifadə olunmur. Bütün DTO-lar hələ raw storage path qaytarır. Yeni authenticated endpoint pattern-ə keçid tamamlanmalıdır.

Köhnə DB data-ları ilə bağlı narahat olma — yalnız query-lərdə transform əlavə et.

---

## Dəyişiklik Lazım Olan Yerlər

### 1. Identity Module — User Avatar

| Fayl | Dəyişiklik |
|------|-----------|
| `GetUserQuery.cs` (~line 101) | `user.AvatarUrl` → `FileUrlHelper.ToAvatarUrl(user.AvatarUrl)` |
| `GetCurrentUserQuery.cs` (~line 78) | Eyni transform |
| `SearchUsersQuery.cs` (~line 53) | `u.AvatarUrl` → transform |
| `GetUsersQuery.cs` (~line 53) | Eyni |
| `GetDepartmentUsersQuery.cs` (~line 154) | Eyni |
| SupervisorDto projection | `sl.SupervisorEmployee.User?.AvatarUrl` → transform |
| SubordinateDto projection | `sl.Employee.User?.AvatarUrl` → transform |

### 2. Identity Module — Company Logo

| Fayl | Dəyişiklik |
|------|-----------|
| `GetAllCompaniesQuery.cs` (~line 58) | `c.LogoUrl` → `FileUrlHelper.ToAvatarUrl(c.LogoUrl)` |
| Digər company query-ləri | Eyni pattern |

### 3. Identity Module — Department Avatar

| Fayl | Dəyişiklik |
|------|-----------|
| `GetAllDepartmentsQuery.cs` (~line 34) | `d.AvatarUrl` → `FileUrlHelper.ToAvatarUrl(d.AvatarUrl)` |

### 4. Channels Module

| Fayl | Dəyişiklik |
|------|-----------|
| `ChannelRepository` — member avatarları | `user.AvatarUrl` → transform |
| `ChannelRepository` — last message sender avatar | `lm.AvatarUrl` → transform |
| `ChannelMemberRepository` | `x.user.AvatarUrl` → transform |
| Channel öz avatar-ı | `channel.AvatarUrl` → transform |

### 5. DirectMessages Module

| Fayl | Dəyişiklik |
|------|-----------|
| `DirectConversationRepository` (~line 109) | `user.AvatarUrl` → transform |
| DM sender avatar | Eyni |

### 6. Shared — Unified Conversation List

| Fayl | Dəyişiklik |
|------|-----------|
| `UnifiedConversationListResponse` projection | `AvatarUrl` və `LastMessageSenderAvatarUrl` → transform |

---

## Qeydlər

- `FileUrlHelper.ToAvatarUrl(string?)` metodu artıq mövcuddur — null handle edir
- Köhnə DB data-ları üçün migration lazım deyil — bu hissə gələcəyə qalır
- EF Core LINQ projection-larda `FileUrlHelper` çağırışı server-side evaluate oluna bilmir — `.AsEnumerable()` və ya materializing sonrası transform et
- Əgər LINQ-da problem yaranarsa, DTO mapping-i materialization sonrasına keçir
