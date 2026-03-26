# Backend Task: SuperAdmin Seed Fix

**From**: Product Owner
**To**: Backend Developer
**Date**: 2026-03-26
**Priority**: P1 — SuperAdmin has wrong Employee record in seed data

---

## Problem

User 11 (`admin@chatapp.com`, `Role.SuperAdmin`) in `IdentityDatabaseSeeder.cs` has:
- An `Employee` record (`emp11`)
- Assigned to `Backend Development` department
- Assigned to `Backend Developer` position

SuperAdmin is a **platform-level** user — no company, no department, no position. This is incorrect.

---

## Fix — `IdentityDatabaseSeeder.cs`

Remove the Employee record creation for User 11. Keep only the User entity.

**Before (lines ~453–463):**
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

**After:**
```csharp
// ========== 11. System Administrator (SuperAdmin — qlobal, şirkətə aid deyil) ==========
var user11Id = Guid.Parse("00000000-0000-0000-0000-000000000011");
var user11 = new User("System", "Administrator", "admin@chatapp.com",
    passwordHasher.Hash("Yusif2000+"), Role.SuperAdmin)
{ Id = user11Id };
await context.Users.AddAsync(user11);
// SuperAdmin has no Employee record — no company, no department, no position
```

---

## File to Change

| File | Change |
|------|--------|
| `ChatApp.Modules.Identity.Infrastructure/Persistence/IdentityDatabaseSeeder.cs` | Remove `emp11` Employee creation and department/position assignments |

No migration needed — this is seed data logic only.

---

## Notes

- SuperAdmin (`admin@chatapp.com` / `Yusif2000+`) authenticates but has no employee profile
- This is correct — SuperAdmin manages companies at platform level, not employees within a company
- If the database is already seeded, manually delete the Employee record for user `00000000-0000-0000-0000-000000000011` from the DB
