# Frontend Task: Admin Panel Nav — SuperAdmin/Admin Visibility Fix

**From**: Product Owner
**To**: Frontend Developer
**Date**: 2026-03-26
**Priority**: P1 — SuperAdmin sees Departments/Positions which they should not

---

## Problem

`AdminPanel.jsx` currently shows Users, Departments, and Positions to both SuperAdmin and Admin.

**Correct access:**

| Section | SuperAdmin | Admin |
|---------|-----------|-------|
| Companies | ✅ | ❌ |
| Users | ❌ | ✅ |
| Departments | ❌ | ✅ |
| Positions | ❌ | ✅ |

SuperAdmin manages companies at platform level — they have no company, no departments, no positions. Only Admin (company-level) manages these.

---

## Fix — `AdminPanel.jsx`

`isSuperAdmin` already exists. Wrap the three Admin-only nav items with `!isSuperAdmin`:

**Nav section — before:**
```jsx
{isSuperAdmin && (
  <button ... onClick={() => setActiveSection("companies")}>Companies</button>
)}
<button ... onClick={() => setActiveSection("users")}>Users</button>
<button ... onClick={() => setActiveSection("departments")}>Departments</button>
<button ... onClick={() => setActiveSection("positions")}>Positions</button>
```

**Nav section — after:**
```jsx
{isSuperAdmin && (
  <button ... onClick={() => setActiveSection("companies")}>Companies</button>
)}
{!isSuperAdmin && (
  <>
    <button ... onClick={() => setActiveSection("users")}>Users</button>
    <button ... onClick={() => setActiveSection("departments")}>Departments</button>
    <button ... onClick={() => setActiveSection("positions")}>Positions</button>
  </>
)}
```

**Content section — before:**
```jsx
{activeSection === "companies" && isSuperAdmin && <CompanyManagement />}
{activeSection === "users" && <UserManagement isSuperAdmin={isSuperAdmin} />}
{activeSection === "departments" && <DepartmentManagement />}
{activeSection === "positions" && <PositionManagement />}
```

**Content section — after:**
```jsx
{activeSection === "companies" && isSuperAdmin && <CompanyManagement />}
{activeSection === "users" && !isSuperAdmin && <UserManagement isSuperAdmin={isSuperAdmin} />}
{activeSection === "departments" && !isSuperAdmin && <DepartmentManagement />}
{activeSection === "positions" && !isSuperAdmin && <PositionManagement />}
```

The default active section logic is already correct:
```js
useState(isSuperAdmin ? "companies" : "users")
```
No change needed there.

---

## File to Change

| File | Change |
|------|--------|
| `src/pages/AdminPanel.jsx` | Wrap Users/Departments/Positions with `!isSuperAdmin` |

One file, minimal change.
