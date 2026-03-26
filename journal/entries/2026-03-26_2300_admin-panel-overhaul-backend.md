# Backend Task: Admin Panel Overhaul — Backend Fixes

**From**: Product Owner
**To**: Backend Developer
**Date**: 2026-03-26
**Priority**: P1
**Supersedes**: `2026-03-26_2100_superadmin-fix-backend.md`

---

## Ediləcək İşlər

1. [Fix] SuperAdmin seed — Employee record-u sil
2. [Verify] Ok() → NoContent() — artıq tamamlanıb (aşağıya bax)

---

## Fix 1 — SuperAdmin Seed (IdentityDatabaseSeeder.cs)

**Problem**: User 11 (`admin@chatapp.com`, `Role.SuperAdmin`) seed-də `Employee` record-u yaradılır, `Backend Development` departamentinə və `Backend Developer` pozisiyasına assign edilir. Bu yanlışdır — SuperAdmin platformun idarəçisidir, heç bir şirkətin əməkdaşı deyil.

**Fayl**: `ChatApp.Modules.Identity.Infrastructure/Persistence/IdentityDatabaseSeeder.cs`

**Əvvəl:**
```csharp
// ========== 11. System Administrator (SuperAdmin — qlobal, şirkətə aid deyil) ==========
var user11Id = Guid.Parse("00000000-0000-0000-0000-000000000011");
var user11 = new User("System", "Administrator", "admin@chatapp.com",
    passwordHasher.Hash("Yusif2000+"), Role.SuperAdmin)
{ Id = user11Id };
await context.Users.AddAsync(user11);
var emp11 = new Employee(user11Id, new DateTime(2000, 6, 23), "++994708074624",
    "System Administration", DateTime.UtcNow.AddYears(-4));
emp11.AssignToDepartment(GetDept("Backend Development").Id);
emp11.AssignToPosition(GetPos("Backend Developer").Id);
await context.Employees.AddAsync(emp11);
```

**Sonra:**
```csharp
// ========== 11. System Administrator (SuperAdmin — qlobal, şirkətə aid deyil) ==========
var user11Id = Guid.Parse("00000000-0000-0000-0000-000000000011");
var user11 = new User("System", "Administrator", "admin@chatapp.com",
    passwordHasher.Hash("Yusif2000+"), Role.SuperAdmin)
{ Id = user11Id };
await context.Users.AddAsync(user11);
// SuperAdmin-in Employee record-u yoxdur — şirkətə, departamentə, pozisiyaya bağlı deyil
```

**DB artıq seeded-dirsə**: `employees` cədvəlindən `user_id = '00000000-0000-0000-0000-000000000011'` olan sətri manual sil.

---

## Verify — Ok() → NoContent() (Artıq tamamlanıb)

`CompaniesController.cs`-də `UpdateCompany`, `DeleteCompany`, `AssignCompanyAdmin` action-larının `return Ok()` → `return NoContent()` olaraq dəyişdirilməsi **artıq tamamlanıb** (commit 677dcb6). Yenidən etməyə ehtiyac yoxdur.

---

## Fayl

| Fayl | Dəyişiklik |
|------|------------|
| `ChatApp.Modules.Identity.Infrastructure/Persistence/IdentityDatabaseSeeder.cs` | `emp11` Employee yaratma + assign kodunu sil |
