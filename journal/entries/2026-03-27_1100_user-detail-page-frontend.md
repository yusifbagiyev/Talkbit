# Frontend Task: User Detail Page + Admin Panel Overhaul

**From**: Product Owner
**To**: Frontend Developer
**Date**: 2026-03-27
**Priority**: P1
**UI/UX Spec**: `journal/entries/2026-03-27_1100_user-detail-page-uiux.md`
**Backend task**: `journal/entries/2026-03-27_1100_user-detail-page-backend.md` (backend bitdikdən sonra test et)

---

## Xülasə

1. `api.js` — bug fix + yeni funksiyalar
2. `AdminPanel.jsx` — user seçim state + breadcrumb
3. `HierarchyView.jsx` — panel sil, `onUserSelect` callback, toolbar buttons, action shortcuts redesign
4. `UserDetailPage.jsx` — yeni komponent (4 tab)
5. `DepartmentManagement.jsx` + `.css` — vizual redesign
6. `PositionManagement.jsx` + `.css` — vizual redesign

---

## 1. api.js — Bug Fix + Yeni Funksiyalar

### Bug fix

```js
// BUG: addSupervisor yanlış URL istifadə edir
// ƏVVƏL (səhv):
function addSupervisor(userId, supervisorId) {
  return apiPost(`/api/users/${userId}/supervisors`, { supervisorId });
}
// SONRA (düzgün — backend: POST /api/users/{id}/supervisor singular):
function addSupervisor(userId, supervisorId) {
  return apiPost(`/api/users/${userId}/supervisor`, { supervisorId });
}

// BUG: getSupervisors — backend-də bu endpoint yoxdur!
// Supervisor data getUserById(userId).supervisors içindədir.
// Bu funksiyanı sil və export-dan çıxar.
// Mövcud HierarchyView.jsx-də getSupervisors istifadəsi varsa, getUserById ilə əvəz et.
```

### Yeni funksiyalar

```js
// Mövcud assignEmployeeToDepartment dəyişdirilir (department + supervisor birlikdə)
// Mövcuddur: function assignEmployeeToDepartment(userId, departmentId)
// Yenidir (supervisorId parametri əlavə et):
function assignEmployeeToDepartment(userId, departmentId, supervisorId = null) {
  return apiPost(`/api/users/${userId}/department`, { departmentId, supervisorId });
}

// Yeni: bütün mövcud permission adları (backend yeni endpoint yaratdıqdan sonra aktiv)
function getAllPermissions() {
  return apiGet("/api/users/permissions");
}

// Yeni: user-ə permission ver
function assignPermission(userId, permissionName) {
  return apiPost(`/api/users/${userId}/permissions`, { permissionName });
}

// Yeni: user-dən permission al
function removePermission(userId, permissionName) {
  return apiDelete(`/api/users/${userId}/permissions/${permissionName}`);
}

// Yeni: user fayl tutumu statistikası (backend yeni endpoint yaratdıqdan sonra)
function getUserStorage(userId) {
  return apiGet(`/api/files/storage/${userId}`);
}
```

Export siyahısına əlavə et: `getAllPermissions, assignPermission, removePermission, getUserStorage`
Export-dan sil: `getSupervisors`

---

## 2. AdminPanel.jsx

### Dəyişikliklər

`selectedUser` state əlavə et:

```js
const [selectedUser, setSelectedUser] = useState(null); // { id, name } | null
```

Breadcrumb yenilənir:

```jsx
<div className="ap-breadcrumb">
  <span className="ap-breadcrumb-root">Admin</span>
  <span className="ap-breadcrumb-sep">›</span>
  <span
    className="ap-breadcrumb-page"
    style={selectedUser ? { cursor: "pointer" } : {}}
    onClick={selectedUser ? () => setSelectedUser(null) : undefined}
  >
    {SECTION_NAMES[activeSection]}
  </span>
  {selectedUser && (
    <>
      <span className="ap-breadcrumb-sep">›</span>
      <span className="ap-breadcrumb-page">{selectedUser.name}</span>
    </>
  )}
</div>
```

Section dəyişdikdə selectedUser sıfırlanır:

```js
const changeSection = (newSection) => {
  if (newSection === activeSection) return;
  setSelectedUser(null); // user detail-i bağla
  // ... mövcud animation logic
};
```

Content render:

```jsx
{activeSection === "users" && !selectedUser && (
  <HierarchyView
    isSuperAdmin={isSuperAdmin}
    onUserSelect={(user) => setSelectedUser(user)}
  />
)}
{activeSection === "users" && selectedUser && (
  <UserDetailPage
    userId={selectedUser.id}
    onBack={() => setSelectedUser(null)}
  />
)}
```

Import əlavə et:
```js
import UserDetailPage from "../components/admin/UserDetailPage";
```

---

## 3. HierarchyView.jsx

### Dəyişikliklər

**3.1 UserDetailPanel-i sil** — komponent tamamilə çıxarılır (artıq lazım deyil).

**3.2 `onUserSelect` prop qəbul et:**

```js
function HierarchyView({ isSuperAdmin, onUserSelect }) { ... }
```

**3.3 User name click → `onUserSelect` çağır:**

```jsx
// renderUserRow içərisində:
<span
  className="hi-user-name"
  onClick={() => onUserSelect({ id: node.id, name: data.name })}
>
  <Highlight text={data.name} query={search} />
</span>
```

Edit action buttonu da eyni:
```jsx
<button className="hi-action-btn edit" onClick={() => onUserSelect({ id: node.id, name: data.name })}>
  ...
</button>
```

**3.4 Panel state-lərini sil** — artıq `panel`, `panelClosing`, `openPanel`, `closePanel` lazım deyil.
State-ləri sil: `panel`, `panelClosing`
Funksiyaları sil: `openPanel`, `closePanel`
İstifadəsini sil: JSX-dəki `{panel?.type === "user" && ...}`, `{panel?.type === "dept" && ...}` bloklarını sil.

**NOT**: `DeptDetailPanel` saxla — `[›]` klikdə dept detail görünür, bu hələ panel olaraq qalır.
Yalnız `UserDetailPanel` silinir.

**3.5 Toolbar — yeni butonlar:**

```jsx
<div className="hi-toolbar">
  <div className="hi-title-wrap">
    <h2 className="hi-title">
      {isSuperAdmin ? "Users" : `Users${adminCompany ? ` — ${adminCompany.name}` : ""}`}
    </h2>
    {!isSuperAdmin && adminCompany && (
      <span className="hi-count-badge">{adminCompany.userCount ?? 0}</span>
    )}
  </div>

  <div className="hi-search-wrap">
    ...{/* mövcud search */}
  </div>

  <div className="hi-toolbar-actions">
    <button className="hi-btn-secondary" onClick={() => setCreateDeptOpen(true)}>
      + New Department
    </button>
    <button className="hi-btn-primary" onClick={() => setCreateUserOpen(true)}>
      + New User
    </button>
  </div>
</div>
```

Yeni state-lər:
```js
const [createUserOpen, setCreateUserOpen] = useState(false);
const [createDeptOpen, setCreateDeptOpen] = useState(false);
```

Create User paneli — mövcud `UserManagement.jsx`-dəki forma varsa, oradan `CreateUserForm` componentini import et. Yoxdursa ayrıca tapşırıq kimi işlənəcək (TODO comment qoy).

Create Dept paneli — `DepartmentManagement.jsx`-dəki forma varsa oradan. Yoxdursa TODO comment.

```jsx
{/* Create User Panel */}
{createUserOpen && (
  <>
    <div className="hi-panel-backdrop" onClick={() => setCreateUserOpen(false)} />
    <div className="ap-panel-in">
      {/* TODO: CreateUserForm component */}
      <div style={{ padding: 24 }}>
        <h3>Create User — TODO</h3>
        <button onClick={() => setCreateUserOpen(false)}>Close</button>
      </div>
    </div>
  </>
)}
```

**3.6 Action shortcuts redesign** — UI/UX spec-ə görə:

Mövcud `.hi-action-btn` class-larını saxla, yalnız CSS yenilənir (aşağıda).
`getSupervisors` istifadəsi varsa sil — UserDetailPanel silindiyindən artıq lazım deyil.

**3.7 CSS dəyişiklikləri** (`HierarchyView.css`):

Toolbar yeni class-lar:
```css
.hi-toolbar-actions { display: flex; gap: 8px; flex-shrink: 0; }

.hi-btn-primary {
  padding: 7px 14px; border-radius: 7px; font-size: 13px; font-weight: 500;
  background: #2563eb; color: #fff; border: none; cursor: pointer;
  white-space: nowrap;
}
.hi-btn-primary:hover { background: #1d4ed8; }

.hi-btn-secondary {
  padding: 7px 14px; border-radius: 7px; font-size: 13px; font-weight: 500;
  background: #fff; color: #374151; border: 1px solid #e5e7eb; cursor: pointer;
  white-space: nowrap;
}
.hi-btn-secondary:hover { background: #f9fafb; }
```

Action button redesign (mövcud `.hi-action-btn` CSS-ini yenilə):
```css
.hi-actions {
  display: flex; align-items: center; gap: 4px;
  opacity: 0; transition: opacity 150ms;
  flex-shrink: 0;
}
.hi-user-row:hover .hi-actions,
.hi-user-row.dropdown-open .hi-actions { opacity: 1; }

.hi-action-btn {
  width: 28px; height: 28px; border-radius: 6px;
  border: none; background: transparent; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  color: #6b7280; transition: background 120ms, color 120ms;
}
.hi-action-btn:hover { background: #f3f4f6; color: #111827; }
.hi-action-btn.toggle.is-active { color: #16a34a; }
.hi-action-btn.toggle.is-inactive { color: #9ca3af; }

.hi-dropdown-wrap { position: relative; }

.hi-action-dropdown {
  position: absolute; right: 0; top: calc(100% + 4px);
  width: 180px; background: #fff;
  border: 1px solid #e5e7eb; border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  z-index: 100; padding: 4px 0;
}
.hi-dropdown-item {
  width: 100%; text-align: left; padding: 8px 14px;
  font-size: 13px; color: #374151;
  background: none; border: none; cursor: pointer;
  display: block;
}
.hi-dropdown-item:hover { background: #f9fafb; }
.hi-dropdown-item.danger { color: #ef4444; }
.hi-dropdown-divider { height: 1px; background: #f3f4f6; margin: 4px 0; }
```

---

## 4. UserDetailPage.jsx — Yeni Komponent

**File**: `chatapp-frontend/src/components/admin/UserDetailPage.jsx`
**CSS**: `chatapp-frontend/src/components/admin/UserDetailPage.css`

### Props

```js
function UserDetailPage({ userId, onBack }) { ... }
```

### State

```js
const [user, setUser] = useState(null);           // UserDetailDto
const [storage, setStorage] = useState(null);     // UserStorageDto
const [allPerms, setAllPerms] = useState([]);     // PermissionGroupDto[]
const [loading, setLoading] = useState(true);
const [activeTab, setActiveTab] = useState("overview");
const [savingPerm, setSavingPerm] = useState(null);  // permission name being toggled
const [permOverrides, setPermOverrides] = useState({}); // { [name]: bool } optimistic
const [depts, setDepts] = useState([]);
const [showResetForm, setShowResetForm] = useState(false);
const [resetPwd, setResetPwd] = useState({ newPassword: "", confirmNewPassword: "" });
const [resetError, setResetError] = useState("");
const [changingDept, setChangingDept] = useState(false);
const [addingSupervisor, setAddingSupervisor] = useState(false);
const [supervisorSearch, setSupervisorSearch] = useState("");
const [supervisorResults, setSupervisorResults] = useState([]);
```

### Data Fetch

```js
useEffect(() => {
  if (!userId) return;
  setLoading(true);
  Promise.all([
    getUserById(userId),
    getUserStorage(userId).catch(() => null),     // backend hazır olmaya bilər
    getAllPermissions().catch(() => []),           // backend hazır olmaya bilər
    getDepartments(),
  ]).then(([userData, storageData, permsData, deptsData]) => {
    setUser(userData);
    setStorage(storageData);
    setAllPerms(permsData ?? []);
    setDepts(deptsData ?? []);
  }).finally(() => setLoading(false));
}, [userId]);
```

### Tabs

```jsx
const TABS = [
  { key: "overview", label: "Overview" },
  { key: "organization", label: "Organization" },
  { key: "permissions", label: "Permissions" },
  { key: "security", label: "Security" },
];
```

### Permission Toggle

```js
const handlePermToggle = async (permName) => {
  if (savingPerm) return;
  const currentlyHas = isPermActive(permName);
  // Optimistic
  setPermOverrides(prev => ({ ...prev, [permName]: !currentlyHas }));
  setSavingPerm(permName);
  try {
    if (currentlyHas) {
      await removePermission(userId, permName);
    } else {
      await assignPermission(userId, permName);
    }
    // Refresh user data to sync
    const updated = await getUserById(userId);
    setUser(updated);
    setPermOverrides({});
  } catch {
    // Revert
    setPermOverrides(prev => ({ ...prev, [permName]: currentlyHas }));
  } finally {
    setSavingPerm(null);
  }
};

const isPermActive = (permName) => {
  if (permName in permOverrides) return permOverrides[permName];
  return user?.permissions?.includes(permName) ?? false;
};
```

### Reset Password

```js
const handleResetPassword = async () => {
  setResetError("");
  try {
    await adminChangePassword(userId, resetPwd.newPassword, resetPwd.confirmNewPassword);
    setShowResetForm(false);
    setResetPwd({ newPassword: "", confirmNewPassword: "" });
  } catch (err) {
    setResetError(err.message || "Password reset failed");
  }
};
```

### Supervisor Search

```js
// Debounced search
useEffect(() => {
  if (!supervisorSearch || supervisorSearch.length < 2) {
    setSupervisorResults([]);
    return;
  }
  const t = setTimeout(async () => {
    const results = await searchUsers(supervisorSearch).catch(() => []);
    // searchUsers: apiGet(`/api/users/search?q=${supervisorSearch}`) — mövcuddur
    setSupervisorResults(results.filter(u => u.id !== userId));
  }, 300);
  return () => clearTimeout(t);
}, [supervisorSearch]);

const handleAddSupervisor = async (supervisorId) => {
  await addSupervisor(userId, supervisorId);
  const updated = await getUserById(userId);
  setUser(updated);
  setSupervisorSearch("");
  setSupervisorResults([]);
  setAddingSupervisor(false);
};

const handleRemoveSupervisor = async (supervisorId) => {
  await removeSupervisor(userId, supervisorId);
  const updated = await getUserById(userId);
  setUser(updated);
};
```

### Toggle Active

```js
const handleToggleActive = async () => {
  try {
    if (user.isActive) {
      await deactivateUser(userId);
    } else {
      await activateUser(userId);
    }
    setUser(prev => ({ ...prev, isActive: !prev.isActive }));
  } catch (err) {
    // show error
  }
};
```

### Change Department

```js
const handleChangeDept = async (deptId) => {
  await assignEmployeeToDepartment(userId, deptId);
  const updated = await getUserById(userId);
  setUser(updated);
  setChangingDept(false);
};
```

### Storage Bar

```js
const MAX_STORAGE_MB = 100;
const fillPct = storage
  ? Math.min((storage.totalMb / MAX_STORAGE_MB) * 100, 100)
  : 0;
```

### Relative Time Helper

```js
function timeAgo(dateStr) {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
```

### JSX Structure (Skeleton)

```jsx
if (loading) return <div className="ud-loading">Loading...</div>;
if (!user) return <div className="ud-error">User not found.</div>;

return (
  <div className="ud-root">
    {/* Hero */}
    <div className="ud-hero">
      <div className="ud-hero-avatar-wrap">
        <div className="ud-hero-avatar" style={...}>
          {user.avatarUrl ? <img src={getFileUrl(user.avatarUrl)} alt="" /> : getInitials(user.fullName)}
        </div>
        <span className={`ud-hero-status-dot ${user.isActive ? "active" : "inactive"}`} />
      </div>

      <div className="ud-hero-info">
        <div className="ud-hero-name">{user.fullName}</div>
        {user.position && <div className="ud-hero-position">{user.position}</div>}
        <div className="ud-hero-badges">
          <span className={`hi-role-badge ${user.role?.toLowerCase()}`}>{user.role}</span>
          <span className={`ud-status-badge ${user.isActive ? "active" : "inactive"}`}>
            {user.isActive ? "Active" : "Inactive"}
          </span>
        </div>
      </div>

      <div className="ud-hero-actions">
        <button className="ud-btn-outline" onClick={() => setActiveTab("overview")}>Edit Profile</button>
        <button className="ud-btn-outline" onClick={() => { setActiveTab("security"); setShowResetForm(true); }}>
          Reset Password
        </button>
        <button className="ud-btn-danger-text" onClick={handleToggleActive}>
          {user.isActive ? "Deactivate" : "Activate"}
        </button>
      </div>
    </div>

    {/* Tabs */}
    <div className="ud-tabs">
      {TABS.map(t => (
        <button
          key={t.key}
          className={`ud-tab${activeTab === t.key ? " active" : ""}`}
          onClick={() => setActiveTab(t.key)}
        >
          {t.label}
        </button>
      ))}
    </div>

    {/* Tab Content */}
    <div className="ud-tab-content">
      {activeTab === "overview" && <OverviewTab user={user} storage={storage} fillPct={fillPct} />}
      {activeTab === "organization" && <OrgTab ... />}
      {activeTab === "permissions" && <PermissionsTab ... />}
      {activeTab === "security" && <SecurityTab ... />}
    </div>
  </div>
);
```

Sub-komponentlər (`OverviewTab`, `OrgTab`, `PermissionsTab`, `SecurityTab`) eyni faylda yazıla bilər (export olunmur).

---

## 5. DepartmentManagement.jsx + .css — Vizual Redesign

**Logic dəyişmir.** Yalnız visual update:

- `.dm-table` → `.dm-tree` (tree-style list, tablo deyil)
- `DepartmentRow` hover-da `[✏][🗑]` icon-lar görünür (opacity 0 → 1)
- Dept name kliki → DeptDetailPanel açır (mövcud `openPanel("dept", node)` pattern-i istifadə et)
- `+ New Department` button: toolbar-da əlavə et

UI/UX spec-ə bax: `2026-03-27_1100_user-detail-page-uiux.md` → Section 4.

---

## 6. PositionManagement.jsx + .css — Vizual Redesign

**Logic dəyişmir.** Yalnız visual update:

- `.pm-row` hover-da `[✏][🗑]` icon-lar görünür
- `pm-menu-btn` (•••) → 2 ayrı icon button
- User count əlavə et (mövcud PositionDto-da varsa `userCount`)

UI/UX spec-ə bax: `2026-03-27_1100_user-detail-page-uiux.md` → Section 5.

---

## Import Summary (UserDetailPage.jsx)

```js
import {
  getUserById, getUserStorage, getAllPermissions, getDepartments,
  assignPermission, removePermission, adminChangePassword,
  activateUser, deactivateUser, addSupervisor, removeSupervisor,
  assignEmployeeToDepartment, getFileUrl,
} from "../../services/api";
import { getInitials, getAvatarColor } from "../../utils/chatUtils";
import "./UserDetailPage.css";
```

Ayrıca `searchUsers` lazımdır supervisor search üçün:
```js
function searchUsers(query) {
  return apiGet(`/api/users/search?q=${encodeURIComponent(query)}`);
}
```
Bu api.js-də yoxdursa əlavə et (mövcud `SearchUsers` endpoint var).

---

## Anti-AI Checklist

- [ ] `getSupervisors` istifadəsi silinib (mövcud HierarchyView-da varsa)
- [ ] `addSupervisor` URL düzəldilib: `/supervisor` (singular)
- [ ] UserDetailPanel HierarchyView-dan tamamilə silinib
- [ ] Breadcrumb "Users > Name" göstərir
- [ ] Tab dəyişməsi scrollu sıfırlamır
- [ ] Permission toggle: optimistic update + revert on error
- [ ] Storage bar: animate on mount (transition: width 600ms)
- [ ] `getAllPermissions` / `getUserStorage` backend hazır olmasa belə UI işləyir (catch → null)
