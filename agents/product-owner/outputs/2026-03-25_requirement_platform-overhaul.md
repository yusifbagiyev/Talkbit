# Platform Overhaul — Full Feature Requirements

**Created**: 2026-03-25
**Updated**: 2026-03-25
**Author**: Product Owner Agent
**Status**: Approved by stakeholder for implementation

---

## Context

ChatApp is evolving from a single-company messaging tool to a **multi-company corporate platform**. Companies are **fully isolated** — no cross-company interaction. Managed by a 3-tier role system.

---

## Core Principle: Company Isolation

- Companies are **completely isolated silos**
- No company can see another company
- No cross-company messaging (DM or Channel)
- No cross-company channels or groups
- All data is scoped to a single company
- Only Super Admin operates across companies

---

## Role System

### System Roles (3 levels)

| Role | Scope | Capabilities |
|------|-------|-------------|
| **Super Admin** | Global | Create/manage all companies, assign Company Admins, manage all users across companies, full system access |
| **Admin** | Company | Manage own company only — users, departments, positions, channels within their company |
| **User** | Company | Regular employee — messaging, channels, files within their company |

### Channel Roles (separate from system roles)

| Role | Capabilities |
|------|-------------|
| **Owner** | Full control — delete channel, transfer ownership |
| **Administrator** | Manage members, edit channel settings |
| **Member** | Send/receive messages, react, upload files |

---

## Feature 1: Multi-Company Management

**Priority**: P0 — Foundational, implement first

### 1.1 Company CRUD (Super Admin only)
- Create company: name, logo/avatar, description
- Edit company details
- Activate/Deactivate company (soft delete)
- Each company has at least one Admin assigned by Super Admin

### 1.2 Company-Scoped Data Isolation
- Users belong to exactly one company
- Departments belong to exactly one company
- Positions belong to a department (→ company)
- Channels are scoped to one company
- DM conversations only between users of the same company
- Files uploaded within company context
- All queries must filter by company

### 1.3 Role Changes (Backend)
- Current `Role` enum: `User = 0, Administrator = 1`
- Current `IsSuperAdmin` boolean on User
- New `Role` enum: `User = 0, Admin = 1, SuperAdmin = 2`
- Remove `IsSuperAdmin` boolean — use Role enum instead
- Update all permission checks to use new 3-tier system
- Admin can only see/manage users within their own company
- Super Admin bypasses company scope

---

## Feature 2: Enhanced Supervisor/Subordinate System

**Priority**: P0 — Architectural change

### 2.1 Many-to-Many Supervisors
- Current: Single `SupervisorId` on Employee (1 supervisor per employee)
- New: `EmployeeSupervisor` junction table (many-to-many)
- One employee can have **multiple supervisors**
- One supervisor can have **multiple subordinates**

### 2.2 Manual Assignment Only
- No automatic supervisor assignment
- Admin manually assigns supervisors to employees within same company
- Endpoints:
  - `POST /api/users/{userId}/supervisors` — Add supervisor
  - `DELETE /api/users/{userId}/supervisors/{supervisorId}` — Remove supervisor
  - `GET /api/users/{userId}/supervisors` — List supervisors
  - `GET /api/users/{userId}/subordinates` — List subordinates

---

## Feature 3: Company Management Panel (Frontend)

**Priority**: P0 — Super Admin UI

### 3.1 Company List
- All companies with: name, status, employee count, admin name, created date
- Search and filter
- Only accessible by Super Admin

### 3.2 Company CRUD Form
- Create/edit company: name, logo, description
- Activate/Deactivate toggle
- Assign Company Admin (user picker)

---

## Feature 4: User Management Panel (Frontend)

**Priority**: P0 — Admin UI

### 4.1 User List
- Paginated table of users
- Super Admin: sees all users, filtered by company
- Admin: sees only own company users
- Search by name, email, department
- Filter by: status, role, department
- Sort by: name, created date, last visit

### 4.2 User CRUD
- Create user: name, email, password, role, department, position
- Edit user: all fields including department/position transfer
- Activate/Deactivate user
- Reset password

### 4.3 Supervisor Assignment
- In user detail view: assign/remove supervisors
- Show current supervisors and subordinates
- Searchable user picker (same company only)

### 4.4 Role Management
- Super Admin assigns: Admin or User roles
- Admin assigns: User role only (cannot create other Admins)

---

## Feature 5: Department Visibility Configuration

**Priority**: P1 — FUTURE implementation

### 5.1 Cross-Department Visibility
- Admin configures which departments can see which within the same company
- `DepartmentVisibility` entity
- Affects conversation list user filtering

---

## Feature 6: Department Management Panel (Frontend)

**Priority**: P1 — FUTURE implementation

### 6.1 Department Tree View
- Visual hierarchy within company
- Department CRUD
- Assign department head
- Department visibility settings

---

## Feature 7: Position Management Panel (Frontend)

**Priority**: P2 — Lower priority

### 7.1 Position CRUD
- Positions grouped by department
- Create, edit, delete positions

---

## Feature 8: Employee Feed System

**Priority**: P1 — After platform overhaul

### 8.1 Feed
- Posts within same company (text, images, files)
- Like, comment, share
- Company-wide and department feeds

---

## Feature 9: Employee Drive

**Priority**: P1 — After platform overhaul

### 9.1 Personal Drive
- Personal file storage per employee
- Folder organization, sharing within company

---

## Implementation Order

| # | Feature | Depends On | Agent | Phase |
|---|---------|------------|-------|-------|
| 1 | Multi-Company System (Backend) | — | Backend Developer | NOW |
| 2 | Supervisor Many-to-Many (Backend) | — | Backend Developer | NOW |
| 3 | Company Management Panel (Frontend) | Feature 1 | Frontend Developer | NOW |
| 4 | User Management Panel (Frontend) | Feature 1, 2 | Frontend Developer | NOW |
| 5 | Department Visibility (Backend) | Feature 1 | Backend Developer | FUTURE |
| 6 | Department Management Panel (Frontend) | Feature 5 | Frontend Developer | FUTURE |
| 7 | Position Management Panel (Frontend) | Feature 1 | Frontend Developer | FUTURE |
| 8 | Feed System | Feature 1 | Backend + Frontend | FUTURE |
| 9 | Drive System | Feature 1 | Backend + Frontend | FUTURE |

---

## Architectural Impact

### Backend Changes Required
- **Identity Module**: Company entity expansion, Role enum (3-tier), EmployeeSupervisor junction table, remove IsSuperAdmin boolean, company-scoped queries
- **Channels Module**: Company-scoped channel creation, block cross-company members
- **DirectMessages Module**: Same-company validation before DM creation
- **Files Module**: Company-scoped file access
- **Shared Infrastructure**: Company context middleware, company-scoped SignalR groups
- **Database**: Migrations for entity changes, data seeding updates

### Frontend Changes Required
- Admin section with management panels (Company, User)
- Role-based UI rendering (Super Admin / Admin / User)
- Sidebar admin entry point
- Modern UI/UX: tables, forms, search/filter components

---

## Resolved Questions

| # | Question | Answer |
|---|----------|--------|
| 1 | Company visibility? | **CANCELLED** — Companies are fully isolated, no cross-company interaction |
| 2 | Cross-company channels? | **Not possible** — channels are company-scoped only |
| 3 | Company Admin role? | **New Role enum value** — User=0, Admin=1, SuperAdmin=2 |
| 4 | Channel roles? | **Separate system** — Owner, Administrator, Member (not system roles) |
| 5 | Dept visibility & mgmt? | **FUTURE** — not in current phase |

## Open Questions

1. **Feed module**: New module or extension of existing?
2. **Drive storage**: Per-user or per-company quota?
