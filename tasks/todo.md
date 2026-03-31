# ChatApp — Progress Tracker

## Current Focus: Platform Overhaul
**Full requirements**: `agents/product-owner/outputs/2026-03-25_requirement_platform-overhaul.md`

---

## Completed (Phase 1-3)
- [x] Phase 1: React Basics (Steps 1-8)
- [x] Phase 2: Chat UI — Layout, Messages, SignalR, Typing/Online (Steps 9-13)
- [x] Step 14: Channels (CRUD, members, messages, real-time)
- [x] Step 15: File Uploads & Downloads
- [x] Step 17: Search (global + scoped)

---

## Phase 4: Platform Overhaul — IN PROGRESS

### 4.1 Multi-Company System (Backend) — COMPLETE ✅
- [x] Expand Company entity (logo, description, status, slug)
- [x] Update Role enum: User=0, Admin=1, SuperAdmin=2
- [x] Remove IsSuperAdmin boolean from User entity (computed from Role)
- [x] Add CompanyId to User (direct company link)
- [x] Company CRUD endpoints (Super Admin only)
- [x] Company-scoped queries — all data filtered by company
- [x] Update GetDepartmentUsersQuery — company-scoped
- [x] Database migrations (AddMultiCompanySupport)

### 4.1b File Storage Company-Scoped Paths (Backend) — COMPLETE ✅
- [x] Company entity Slug property (auto-generated, unique)
- [x] CompanySlug claim in JWT token
- [x] FileMetadata.CompanyId property
- [x] UploadFileCommand — DetermineStorageDirectory() with company prefix
- [x] FilesController — GetCompanyClaims() helper, passes to all upload commands
- [x] Login/RefreshToken — Company included when loading User
- [x] Migrations (AddCompanySlugAndFileCompanyId, AddFileCompanyId)

### 4.1c Channel & DM Company Isolation (Backend) — COMPLETE ✅
- [x] CompanyId added to Channel entity
- [x] Channel name uniqueness: global → per-company composite index
- [x] AddMemberCommand: same-company validation
- [x] StartConversationCommand: cross-company DM blocked
- [x] Migration (AddChannelCompanyId)

### 4.2 Supervisor/Subordinate Refactor (Backend) — COMPLETE ✅
- [x] EmployeeSupervisor junction table (many-to-many)
- [x] Remove single SupervisorId from Employee
- [x] AssignSupervisor/RemoveSupervisor commands refactored
- [x] UserDetailDto: List<SupervisorDto> + List<SubordinateDto>
- [x] GetUserQuery / GetCurrentUserQuery updated
- [x] Migration (AddEmployeeSupervisorTable) with data migration

### 4.3 Company Management Panel (Frontend) — COMPLETE ✅
- [x] Company list with search, pagination, status badges
- [x] Company CRUD form (name, logo, description) — right-side slide panel
- [x] Activate/Deactivate company
- [x] Assign Company Admin

### 4.4 User Management Panel (Frontend) — COMPLETE ✅
- [x] User list with search/filter (department, status)/sort
- [x] User create/edit form — right-side slide panel
- [x] Supervisor assignment UI (many-to-many) — Supervisors tab
- [x] Role management (SuperAdmin → Admin/User, Admin → User only)
- [x] Activate/deactivate user, Reset password

### 4.5 Admin Panel CSS — Design Review Fixes — COMPLETE ✅
- [x] admin-shared.css created (shared keyframes)
- [x] Header border, nav left accent, role badge shape/colors
- [x] Form panels: centered modal → right-side slide panel
- [x] Pulse animation on active status dots
- [x] Table header font-weight inversion
- [x] Focus outline rings (WCAG 2.1 AA)

---

### 4.6 File Serving Security — Proxy Pattern — COMPLETE ✅
- [x] Backend: `UseStaticFiles` `/uploads` blokunun silinməsi
- [x] Backend: `GET /api/files/serve/{fileId}` — authenticated file serve endpoint
- [x] Backend: `GET /api/files/avatar/{fileId}` — yüngül auth avatar endpoint
- [x] Backend: DTO-larda `fileUrl` (static path) → `fileId`-based URL keçidi
- [x] Backend: FileUrlHelper refactoru
- [x] Backend: Bütün avatar/logo DTO-larında ToAvatarUrl() transform (21 fayl)
- [x] Backend: SearchRepository avatar transform
- [x] Frontend: Əlavə dəyişiklik lazım deyil — `getFileUrl()` + cookie-based auth birbaşa işləyir (blob URL pattern lazımsız)

---

## Phase 5: Future Features

### Department Visibility (Backend + Frontend)
- [ ] DepartmentVisibility entity and endpoints
- [ ] Department management panel UI

### Department Management Panel (Frontend) — COMPLETE ✅
- [x] Department tree view, CRUD, head assignment

### Position Management Panel (Frontend) — COMPLETE ✅
- [x] Position list, CRUD

### Feed System (New Module)
- [ ] Backend: posts, likes, comments module
- [ ] Frontend: company-wide and department feeds

### Employee Drive — IN PROGRESS
- [ ] UI/UX: Drive dizayn spec (grid/list view, selection toolbar, details panel, recycle bin)
- [ ] Backend: DriveFolder entity, FileMetadata genişləndirilməsi (FolderId, IsDriveFile)
- [ ] Backend: Drive API endpoint-ləri (folders CRUD, files CRUD, trash, quota)
- [ ] Backend: 3GB quota enforcement, soft delete (30 gün)
- [ ] Frontend: DrivePage, DriveFileGrid, DriveFileList, DriveFileCard komponentləri
- [ ] Frontend: Folder navigation (breadcrumb), selection toolbar, context menu
- [ ] Frontend: Details panel, Recycle Bin, Storage quota bar
- [ ] Frontend: Drag-drop upload, sort, search

---

## Phase 6: Remaining Frontend Features

### Step 16: Notifications
- [ ] Notification list panel UI
- [ ] Unread count badge, mark read, real-time alerts

### Step 18: Settings
- [ ] Settings panel (notification, privacy, display preferences)

### Sidebar Navigation
- [ ] Contacts, Channels, Settings panel routing

---

## Known Bugs
*(To be reported)*

---

## Decision Log
| Date | Decision | Reason |
|------|----------|--------|
| 2025-02-15 | Blazor WASM → React | UI freezing during real-time chat |
| 2026-02-17 | Bitrix24 style (not WhatsApp) | Corporate use, familiar UI |
| 2026-03-25 | Platform overhaul — multi-company | Corporate clients need company isolation |
| 2026-03-25 | Company visibility CANCELLED | Full isolation — no cross-company interaction |
| 2026-03-25 | 3-tier roles: SuperAdmin, Admin, User | Clear separation of global vs company scope |
| 2026-03-25 | Channel roles separate from system roles | Owner, Administrator, Member — channel-level only |
| 2026-03-25 | Dept visibility & mgmt deferred to future | Focus on company foundation first |

## How to Resume
Say: **"Continue platform overhaul"** — Claude will read this file and the requirements doc.
