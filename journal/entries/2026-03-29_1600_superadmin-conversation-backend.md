# Backend Task: SuperAdmin Conversation + Company Isolation

**From**: Product Owner
**To**: Backend Developer
**Date**: 2026-03-29
**Priority**: P0 — CRITICAL

---

## Problem 1: SuperAdmin Cannot Start Conversations

SuperAdmin `POST /api/conversations` çağıranda `ValidationException` alır:
```
"Cannot start a conversation with a user from a different company"
```

**Kök səbəb:** `StartConversationValidator` — `User1CompanyId == User2CompanyId` tələb edir. SuperAdmin-in companyId-si yoxdur → `Guid.Empty` olur → heç bir company ilə uyğun gəlmir.

### Fix

**File:** `ChatApp.Modules.DirectMessages.Application/Commands/DirectConversations/StartConversationCommand.cs`

Validator-da SuperAdmin-ə istisna əlavə et:

```csharp
RuleFor(x => x)
    .Must(x => x.User1CompanyId == Guid.Empty           // SuperAdmin (no company)
             || x.User1CompanyId == x.User2CompanyId)    // Same company
    .WithMessage("Cannot start a conversation with a user from a different company");
```

`User1CompanyId == Guid.Empty` → SuperAdmin hər kəslə danışa bilər.

---

## Problem 2: Company Isolation — Search Endpoint

`GET /api/users/search` endpoint-i companyId filteri tətbiq etmir. Fərqli company-nin istifadəçiləri axtarışda görünür. Bu ciddi **security** problemidir.

### Fix

**File:** `ChatApp.Modules.Identity.Application/Queries/SearchUsers/SearchUsersQuery.cs` (handler)

Query-yə companyId filteri əlavə et:

```csharp
// SuperAdmin bütün istifadəçiləri görə bilər
// Admin/User yalnız öz company-sinin istifadəçilərini görə bilər
if (callerCompanyId.HasValue && callerCompanyId != Guid.Empty)
{
    query = query.Where(u => u.Employee != null
                          && u.Employee.Department != null
                          && u.Employee.Department.CompanyId == callerCompanyId);
}
```

**Controller-da:** `callerCompanyId`-ni JWT claim-dən al və command/query-yə ötür.

### Yoxlanacaq digər endpoint-lər

Aşağıdakı endpoint-lərin hamısında companyId filteri olmalıdır (SuperAdmin xaricində):

- `GET /api/users` — paginated user list
- `GET /api/users/search` — user search
- `GET /api/users/department-users` — department users
- `GET /api/identity/organization/hierarchy` — hierarchy view
- `GET /api/identity/departments` — departments list
- `GET /api/identity/positions` — positions list

Hər birini yoxla — companyId filteri varsa OK, yoxdursa əlavə et.

---

## Problem 3: Köhnə Faylların 404 Xətası

Storage restructure-dən sonra köhnə faylların `StoragePath`-i DB-də dəyişməyib. Nəticədə:
- `/uploads/system/files/00000000-.../images/...` → 404
- `/uploads/shared/departments/avatars/...` → 404

### Fix

DB-dəki köhnə path-ləri yeni relative path-lərə çevir. Migration əlavə et:

```sql
-- system/ prefix-li path-ləri düzəlt
UPDATE file_metadata
SET storage_path = REPLACE(storage_path, 'system/files/', 'company/00000000-0000-0000-0000-000000000000/users/')
WHERE storage_path LIKE 'system/%';

-- shared/ prefix-li path-ləri düzəlt (department avatarları)
-- Bu faylları uyğun company-yə köçürmək lazımdır — manual araşdırma tələb olunur
```

> **Qeyd:** `system/` və `shared/` folder-ləri artıq kod tərəfindən yaradılmır. Köhnə faylları ya migrate et, ya da diskdən sil (artıq istifadə olunmursa).

---

## Test

1. SuperAdmin → istənilən istifadəçi ilə conversation başlat → 200 OK
2. Admin → öz company-sindəki istifadəçi ilə conversation → 200 OK
3. Admin → fərqli company-nin istifadəçisi ilə conversation → 400 (blocked)
4. Admin → `GET /api/users/search?q=...` → yalnız öz company-sinin istifadəçiləri görünsün
5. User → `GET /api/users/search?q=...` → yalnız öz company-sinin istifadəçiləri görünsün
