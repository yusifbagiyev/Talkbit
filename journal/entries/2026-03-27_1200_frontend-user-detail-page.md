# Frontend Task: User Detail Page + Admin Hierarchy Updates

**From**: UI/UX Developer
**To**: Frontend Developer
**Date**: 2026-03-27
**Priority**: P1
**Spec**: `agents/uiux-developer/outputs/2026-03-27_wireframe_user-detail-page.md`

---

## Tapşırıqlar

### 1. UserDetailPage — yeni komponent

`src/components/admin/UserDetailPage.jsx` + `UserDetailPage.css`

- `ud-*` class namespace
- User name klikdə HierarchyView əvəzinə `ap-content`-də bu komponent görünür
- Breadcrumb: `Admin › Users › [Ad Soyad]`
- AdminPanel.jsx-dəki section state-ə `user_detail` əlavə et
- Komponent `userId` prop alır, `getUser(userId)` ilə məlumat çəkir

**Hero:**
- `#1e2432` bg, 80px avatar, status dot, action buttons (Edit / Reset Password / ⋯)
- Avatar: `getInitials` + `getAvatarColor` — mövcud utility

**4 tab:** Overview | Organization | Permissions | Security
- Tab switch local state (`activeTab`)

**Overview:**
- 2-column grid: sol info cards + sağ storage card
- Personal Information + Employment card-ları
- Storage: `GET /api/files/users/{id}/storage` → `{ totalMb, images, documents, other }`
- Progress bar: `width: ${(totalMb / 100) * 100}%`

**Organization:**
- Department card: cari dept + `[Change →]` → inline dropdown (getDepartments())
- `[Remove from dept]` — `DELETE /api/users/{id}/department`
- Supervisors: list + `[+ Add supervisor]` search input (300ms debounce)
- Subordinates: read-only list

**Permissions:**
- `GET /api/users/{id}/permissions` → `{ modules: [{ name, permissions: [{id, name, granted}] }] }`
- Custom toggle pill (36×20px) — `onClick` optimistic update
- `[Reset to Role Defaults]` → `POST /api/users/{id}/permissions/reset`

**Security:**
- Last login relative time (`formatRelativeTime` utility)
- Inline password reset form (expand-in-card)
- Account status: activate/deactivate button

---

### 2. HierarchyView — Action Shortcuts Update

`HierarchyView.jsx` + `HierarchyView.css`

Dəyişikliklər:
- 3 button: `[✏]` `[⏻ toggle]` `[⋯]`
- `hi-actions`: `opacity: 0` default, `hi-user-row:hover` → `opacity: 1`
- `.hi-user-row.dropdown-open .hi-actions { opacity: 1; }` — dropdown açıq olduqda
- Toggle button: `is-active` (green) / `is-inactive` (gray) class
- `[✏]` click → user detail page (section dəyişir)
- `[⋯]` dropdown: Edit, Reset Password, Deactivate/Activate, ── Delete

Inline delete confirm (mövcud pattern saxla):
```jsx
{confirmDelete === user.id ? (
  <span className="hi-delete-confirm">
    Delete? <button onClick={() => handleDelete(user.id)}>Yes</button>
            <button onClick={() => setConfirmDelete(null)}>No</button>
  </span>
) : null}
```

---

### 3. HierarchyView Toolbar — New Buttons

`HierarchyView.jsx` toolbar hissəsinə əlavə et:

```
[hi-title-wrap]  [hi-search-wrap flex:1]  [+ New User] [+ New Department]
```

- `[+ New User]` → `hi-btn-primary` → CreateUserForm slide panel (mövcud UserManagement formundan götür)
- `[+ New Department]` → `hi-btn-secondary` → CreateDeptForm slide panel
  - Yalnız Admin (isSuperAdmin=false) üçün göstər — SuperAdmin şirkətlərə görə manage edir

---

### 4. DepartmentManagement.jsx + .css — Redesign

`src/components/admin/DepartmentManagement.jsx`

- `dm-*` class namespace (mövcud class-ları əvəz et)
- Tree view (mövcud expand/collapse logic saxla)
- Row hover: `[✏] [🗑]` icon-lar görünür (`opacity: 0 → 1`)
- Row name click → `DeptDetailPanel` (sağdan açılır, 400px)
- `ap-panel-in` / `ap-panel-out` — `admin-shared.css`-dən

DeptDetailPanel məzmunu:
- Head + `[Change Head]`
- Stats: user count, sub-dept count
- Members list (read-only)
- Footer: `[Edit Department]` `[Delete]`

---

### 5. PositionManagement.jsx + .css — Redesign

`src/components/admin/PositionManagement.jsx`

- `pm-*` class namespace
- List view (cədvəl əvəzinə sadə row-lar)
- Dept filter `<select>` — `getDepartments()` ilə
- Row hover: `[✏] [🗑]` görünür
- Edit: side panel (position name + dept dropdown)
- User count: `position.userCount ?? "—"`

---

## Əsas Qaydalar

1. `opacity: 0` action buttons — statik göstərmə
2. `⏻` toggle: user `isActive`-a görə `is-active` / `is-inactive` class
3. Hero: `#1e2432` (gradient yox, purple yox)
4. Tab underline: `border-bottom: 2px solid #2563eb` (pill yox)
5. Permission toggle: custom `36×20px` (checkbox yox)
6. Panel animation: `ap-panel-in` — `admin-shared.css`-dən
7. Partial update — yalnız dəyişən node/user yenilənir

## Yeni CSS faylı

`src/components/admin/UserDetailPage.css` — `ud-*` class-ları
`admin-shared.css`-i import et.
