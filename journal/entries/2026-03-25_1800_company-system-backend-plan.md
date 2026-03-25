# Backend Task: Multi-Company System Implementation

**From**: Product Owner
**To**: Backend Developer
**Date**: 2026-03-25
**Priority**: P0 — Foundational change, blocks all other work
**Requirements Doc**: `agents/product-owner/outputs/2026-03-25_requirement_platform-overhaul.md`

---

## Objective

Transform ChatApp from single-company to multi-company architecture with full company isolation and 3-tier role system.

## Core Principles

1. **Full company isolation** — no cross-company data leakage
2. **CompanyId on User** — direct link, no JOIN chains for filtering
3. **3-tier roles** — SuperAdmin (global), Admin (company-scoped), User (employee)
4. **Backward compatible seed data** — existing test data must still work

---

## Implementation Steps (Exact Order)

### Step 1: Update Role Enum

**File**: `ChatApp.Modules.Identity.Domain/Enums/Role.cs`

```
Current:  User = 0, Administrator = 1
New:      User = 0, Admin = 1, SuperAdmin = 2
```

- Rename `Administrator` → `Admin` (value stays 1, no DB migration needed for existing data)
- Add `SuperAdmin = 2`

### Step 2: Update Company Entity

**File**: `ChatApp.Modules.Identity.Domain/Entities/Company.cs`

Add new properties:
- `string Slug` (required, unique, auto-generated from name, e.g., "166-logistics")
- `string? LogoUrl` (nullable, 500 chars)
- `string? Description` (nullable, 1000 chars)
- `bool IsActive` (default: true)

Add new navigation:
- `IReadOnlyCollection<User> Users` (users belonging to this company)

Add methods:
- `UpdateLogo(string? logoUrl)`
- `UpdateDescription(string? description)`
- `Activate()` / `Deactivate()`

### Step 3: Update User Entity

**File**: `ChatApp.Modules.Identity.Domain/Entities/User.cs`

Changes:
- **ADD**: `Guid CompanyId` (required for Admin/User, nullable for SuperAdmin)
- **ADD**: `Company? Company` (navigation property)
- **REMOVE**: `bool IsSuperAdmin` field and `SetSuperAdmin()` method
- **UPDATE**: `IsAdmin` property → `Role == Role.Admin || Role == Role.SuperAdmin`
- **ADD**: `bool IsSuperAdmin => Role == Role.SuperAdmin` (computed property, not DB column)
- **UPDATE**: `AssignDefaultPermissions()` to handle 3 roles
- **UPDATE**: `ChangeRole(Role newRole)` — validate transitions

### Step 4: Update Permissions

**File**: `ChatApp.Modules.Identity.Domain/Constants/Permissions.cs`

Add new permission constants:
- `CompaniesCreate`, `CompaniesRead`, `CompaniesUpdate`, `CompaniesDelete`

Update `GetDefaultForRole(Role role)`:
- `SuperAdmin` → ALL permissions including Companies.*
- `Admin` → All except Companies.* (manages within own company)
- `User` → Basic messaging/file permissions (unchanged)

### Step 5: Update EF Configurations

**CompanyConfiguration.cs** — Add: logo_url, description, is_active columns, Users navigation
**UserConfiguration.cs** — Add: company_id (FK to companies), remove: is_super_admin column
**EmployeeConfiguration.cs** — No changes in this step

### Step 6: Company CRUD Commands & Queries

Create in `ChatApp.Modules.Identity.Application/`:

**Commands:**
- `Commands/Companies/CreateCompanyCommand.cs` + Validator
- `Commands/Companies/UpdateCompanyCommand.cs` + Validator
- `Commands/Companies/DeleteCompanyCommand.cs` (soft delete → deactivate)
- `Commands/Companies/AssignCompanyAdminCommand.cs`

**Queries:**
- `Queries/Companies/GetAllCompaniesQuery.cs` (SuperAdmin only, paginated)
- `Queries/Companies/GetCompanyByIdQuery.cs`

**DTOs:**
- `DTOs/Responses/CompanyDto.cs`
- `DTOs/Responses/CompanyDetailDto.cs` (with user count, admin info)

### Step 7: Company Controller

Create `ChatApp.Modules.Identity.Api/Controllers/CompaniesController.cs`:

```
Route: api/companies

GET    /api/companies                    → GetAllCompanies (SuperAdmin)
GET    /api/companies/{id}               → GetCompanyById (SuperAdmin + own company Admin)
POST   /api/companies                    → CreateCompany (SuperAdmin)
PUT    /api/companies/{id}               → UpdateCompany (SuperAdmin)
DELETE /api/companies/{id}               → DeleteCompany (SuperAdmin, soft delete)
POST   /api/companies/{id}/admin         → AssignCompanyAdmin (SuperAdmin)
```

### Step 8: Update Existing Queries — Company Scoping

**GetDepartmentUsersQuery.cs** — Add CompanyId filter:
- SuperAdmin: no company filter (sees all)
- Admin/User: filter by `user.CompanyId == currentUser.CompanyId`

**GetOrganizationHierarchyQuery.cs** — Scope to company:
- SuperAdmin: can query any company (pass companyId parameter)
- Admin/User: only own company hierarchy

**GetAllUsersQuery / SearchUsersQuery** — Add company scoping

### Step 9: Update Controllers — Company Scoping

**UnifiedConversationsController.cs** — Department users query already company-scoped via Step 8

**UsersController.cs** — All user operations scoped to company:
- SuperAdmin can operate on any company's users
- Admin can only operate on own company's users

**ChannelsController.cs** — Validate all channel operations are same-company

**DirectConversationsController.cs** — Validate DM creation: both users same company

### Step 10: Update Seed Data

**IdentityDatabaseSeeder.cs**:
- Create company "166 Logistics" with all existing departments/users
- System Admin user (SuperAdmin role, CompanyId = null — or special company)
- Set Role = Admin for existing admins, Role = User for regular users
- Remove IsSuperAdmin flag usage

### Step 11: File Storage — Company-Scoped Paths

**Current structure:**
```
D:\ChatAppUploads/
├── avatars/conversations/{userId}/ and channels/{channelId}/
└── files/{userId}/{type}/
```

**New structure:**
```
D:\ChatAppUploads/
└── {company-slug}/
    ├── avatars/
    │   ├── users/{userId}/
    │   └── channels/{channelId}/
    ├── files/
    │   └── {userId}/
    │       ├── images/
    │       ├── documents/
    │       ├── videos/
    │       ├── audio/
    │       ├── archives/
    │       └── other/
    └── company/
        └── logo.{ext}
```

**Files to modify:**
- `UploadFileCommand.cs` — `DetermineStorageDirectory()` must prepend company slug
- `LocalFileStorageService.cs` — path construction
- `FileUrlHelper.cs` — URL conversion must include company prefix
- `FileMetadata` entity — add `CompanyId` column
- `FileMetadataConfiguration.cs` — add company_id column + index

**Company slug:** Derived from company name (lowercase, hyphenated, e.g., "166 Logistics" → "166-logistics"). Stored on Company entity as `Slug` field (unique).

### Step 12: Migration

Create migration: `AddMultiCompanySupport`
- Add columns: companies.logo_url, companies.description, companies.is_active, companies.slug
- Add column: users.company_id (FK to companies)
- Remove column: users.is_super_admin
- Add index: users.company_id
- Add column: file_metadata.company_id
- Populate company_id for existing users (derive from Employee → Department → Company)
- Populate company slug for existing companies
- Move existing files to new directory structure (migration script or manual step)

---

## Files Affected Summary

| Layer | Files to Modify | Files to Create |
|-------|----------------|-----------------|
| Domain/Entities | Company.cs, User.cs | — |
| Domain/Enums | Role.cs | — |
| Domain/Constants | Permissions.cs | — |
| Application/Commands | — | CreateCompanyCommand, UpdateCompanyCommand, DeleteCompanyCommand, AssignCompanyAdminCommand (4 files + 4 validators) |
| Application/Queries | GetDepartmentUsersQuery, GetOrganizationHierarchyQuery | GetAllCompaniesQuery, GetCompanyByIdQuery (2 files) |
| Application/DTOs | — | CompanyDto, CompanyDetailDto (2 files) |
| Infrastructure/Persistence | IdentityDatabaseSeeder.cs | Migration file |
| Infrastructure/Configurations | CompanyConfiguration.cs, UserConfiguration.cs | — |
| Api/Controllers | UsersController, UnifiedConversationsController | CompaniesController (1 file) |
| Other Modules | ChannelsController, DirectConversationsController | — |
| Files Module | UploadFileCommand, LocalFileStorageService, FileUrlHelper, FileMetadata, FileMetadataConfiguration | — |

**Total: ~20 files to modify, ~13 files to create**

---

## Acceptance Criteria

- [ ] SuperAdmin can create, update, deactivate companies
- [ ] SuperAdmin can assign Admin to a company
- [ ] Admin can only see/manage users in own company
- [ ] User can only see colleagues in own company
- [ ] DM creation blocked between users of different companies
- [ ] Channel members must all be from same company
- [ ] Organization hierarchy scoped to company
- [ ] Conversation list shows only same-company users
- [ ] Existing seed data works with migration
- [ ] All existing tests pass (if any)
- [ ] No cross-company data leakage in any endpoint
- [ ] File uploads stored under company-slug directory
- [ ] File URLs include company prefix: `/uploads/{company-slug}/files/...`
- [ ] Company slug is unique and auto-generated from name

---

## Risks

1. **Migration complexity** — existing users need company_id populated from Employee→Department→Company chain
2. **SuperAdmin CompanyId** — SuperAdmin is global, CompanyId should be nullable for SuperAdmin
3. **Role rename** — `Administrator` → `Admin` may break frontend Role checks
4. **Downstream modules** — Channels, DirectMessages need company validation added
