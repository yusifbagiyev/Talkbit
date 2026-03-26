# Frontend Task: Admin Panel Overhaul

**From**: Product Owner
**To**: Frontend Developer
**Date**: 2026-03-26
**Priority**: P1
**Supersedes**: `2026-03-26_2100_superadmin-fix-frontend.md`, `2026-03-26_2200_admin-panel-redesign-frontend.md`
**UI/UX Wireframe**: `agents/uiux-developer/outputs/2026-03-26_wireframe_admin-panel-redesign.md`
**Note**: UI/UX wireframe hazır olduqdan sonra bu tapşırıq başlanacaq

---

## Ediləcək İşlər

1. [Fix] Admin Panel nav — Users hər iki rol üçün görünür
2. [Feature] Users bölməsi — iyerarxik ağac görünüşü (SuperAdmin + Admin)
3. [Redesign] Bütün bölmələr — UI/UX wireframe-ə uyğun modern dizayn

---

## Fix 1 — AdminPanel.jsx Nav Görünürlüyü

**Problem**: Users, Departments, Positions yalnız Admin üçün görünür. SuperAdmin yalnız Companies görür.
**Düzəliş**: Users həm Admin, həm SuperAdmin üçün görünəcək. Departments + Positions yalnız Admin.

```jsx
<nav className="ap-nav">
  {/* SuperAdmin only */}
  {isSuperAdmin && (
    <button className={`ap-nav-item${activeSection === "companies" ? " active" : ""}`}
      onClick={() => setActiveSection("companies")}>
      Companies
    </button>
  )}

  {/* Hər iki rol — YENİ */}
  <button className={`ap-nav-item${activeSection === "users" ? " active" : ""}`}
    onClick={() => setActiveSection("users")}>
    Users
  </button>

  {/* Admin only */}
  {!isSuperAdmin && (
    <>
      <button className={`ap-nav-item${activeSection === "departments" ? " active" : ""}`}
        onClick={() => setActiveSection("departments")}>
        Departments
      </button>
      <button className={`ap-nav-item${activeSection === "positions" ? " active" : ""}`}
        onClick={() => setActiveSection("positions")}>
        Positions
      </button>
    </>
  )}
</nav>
```

Content render:
```jsx
{activeSection === "companies" && isSuperAdmin && <CompanyManagement />}
{activeSection === "users" && <HierarchyView isSuperAdmin={isSuperAdmin} />}
{activeSection === "departments" && !isSuperAdmin && <DepartmentManagement />}
{activeSection === "positions" && !isSuperAdmin && <PositionManagement />}
```

Default state düzgündür, dəyişmə:
```js
useState(isSuperAdmin ? "companies" : "users")
```

---

## Feature 2 — HierarchyView Komponenti

### Backend Endpoint (hazırdır)

```
GET /api/identity/organization/hierarchy
GET /api/identity/organization/hierarchy?companyId={guid}
```

- **SuperAdmin** (param yox) → bütün şirkətlər + iyerarxiya
- **Admin** (param yox) → avtomatik öz şirkəti (JWT scoped)

### api.js əlavəsi

```js
function getOrganizationHierarchy(companyId = null) {
  const query = companyId ? `?companyId=${companyId}` : '';
  return apiGet(`/api/identity/organization/hierarchy${query}`);
}
```

Export-a əlavə et.

### Response Shape

```js
[
  {
    type: "Company",           // "Company" | "Department" | "User"
    id: "guid",
    name: "166 Logistics",
    level: 0,
    userCount: 42,
    headOfDepartmentId: "guid|null",
    headOfDepartmentName: "string|null",
    email: null,
    role: null,
    isActive: true,
    avatarUrl: null,
    positionName: null,
    departmentId: null,
    isDepartmentHead: false,
    supervisorName: null,
    subordinateCount: 0,
    children: [ /* rekursiv eyni shape */ ]
  }
]
```

### Görünüş Fərqi

**SuperAdmin**: Company node-lardan başlayır. Hər company expand olduqda dept-lər, dept-lərin içindəki user-lər görünür.

**Admin**: Company node yoxdur — birbaşa dept-lər. `tree.flatMap(n => n.children)` ilə company layer-ini keç.

### Komponent Faylları

| Fayl | Əməliyyat |
|------|-----------|
| `src/components/admin/HierarchyView.jsx` | Yarat |
| `src/components/admin/HierarchyView.css` | Yarat — `hi-*` prefix |

### HierarchyView.jsx

```jsx
import { useState, useEffect } from "react";
import { getOrganizationHierarchy, getFileUrl } from "../../services/api";
import { getInitials, getAvatarColor } from "../../utils/chatUtils";
import "./HierarchyView.css";

function HierarchyView({ isSuperAdmin }) {
  const [tree, setTree] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState(new Set());

  useEffect(() => {
    getOrganizationHierarchy()
      .then(data => setTree(data || []))
      .finally(() => setLoading(false));
  }, []);

  const toggle = (id) => setCollapsed(prev => {
    const s = new Set(prev);
    s.has(id) ? s.delete(id) : s.add(id);
    return s;
  });

  const renderNode = (node) => {
    const isCollapsed = collapsed.has(node.id);
    const hasChildren = node.children?.length > 0;

    if (node.type === "Company") {
      return (
        <div key={node.id} className="hi-company-node">
          <div className="hi-company-header" onClick={() => toggle(node.id)}>
            <span className={`hi-chevron${isCollapsed ? "" : " hi-chevron--open"}`}>▶</span>
            <div className="hi-company-logo" style={{ background: getAvatarColor(node.name) }}>
              {node.avatarUrl
                ? <img src={getFileUrl(node.avatarUrl)} alt="" />
                : getInitials(node.name)}
            </div>
            <span className="hi-company-name">{node.name}</span>
            <span className="hi-count-badge">{node.userCount ?? 0} users</span>
          </div>
          {!isCollapsed && hasChildren && (
            <div className="hi-children">{node.children.map(renderNode)}</div>
          )}
        </div>
      );
    }

    if (node.type === "Department") {
      const indent = node.level * 24;
      return (
        <div key={node.id} className="hi-dept-node" style={{ paddingLeft: indent + 16 }}>
          <div className="hi-dept-header" onClick={() => hasChildren && toggle(node.id)}>
            {hasChildren && (
              <span className={`hi-chevron${isCollapsed ? "" : " hi-chevron--open"}`}>▶</span>
            )}
            <svg className="hi-dept-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            </svg>
            <span className="hi-dept-name">{node.name}</span>
            <span className="hi-count-badge">{node.userCount} users</span>
            {node.headOfDepartmentName && (
              <span className="hi-dept-head-hint">Head: {node.headOfDepartmentName}</span>
            )}
          </div>
          {!isCollapsed && hasChildren && (
            <div className="hi-children">{node.children.map(renderNode)}</div>
          )}
        </div>
      );
    }

    if (node.type === "User") {
      const indent = node.level * 24;
      return (
        <div key={node.id}
          className={`hi-user-row${node.isDepartmentHead ? " hi-user-row--head" : ""}`}
          style={{ paddingLeft: indent + 16 }}>
          <div className="hi-avatar"
            style={{ background: node.avatarUrl ? "transparent" : getAvatarColor(node.name) }}>
            {node.avatarUrl
              ? <img src={getFileUrl(node.avatarUrl)} alt="" />
              : getInitials(node.name)}
          </div>
          <div className="hi-user-info">
            <span className="hi-user-name">{node.name}</span>
            {node.positionName && <span className="hi-position">{node.positionName}</span>}
          </div>
          {node.isDepartmentHead && <span className="hi-head-badge">★ Head</span>}
          {node.role && (
            <span className={`hi-role-badge hi-role-badge--${node.role.toLowerCase()}`}>
              {node.role}
            </span>
          )}
        </div>
      );
    }

    return null;
  };

  // Admin view: company layer-ini keç, birbaşa dept-lər
  const nodes = isSuperAdmin ? tree : tree.flatMap(n => n.type === "Company" ? n.children : [n]);

  // Search filter (recursive)
  const searchLower = search.toLowerCase().trim();
  const visible = searchLower ? filterTree(nodes, searchLower) : nodes;

  return (
    <div className="hi-root">
      <div className="hi-toolbar">
        <h2 className="hi-title">Users</h2>
        <div className="hi-search-wrap">
          <svg className="hi-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input className="hi-search" placeholder="Search users or departments..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>
      <div className="hi-tree">
        {loading
          ? <HierarchySkeleton />
          : visible.length === 0
            ? <div className="hi-empty">No users found.</div>
            : visible.map(renderNode)}
      </div>
    </div>
  );
}

function filterTree(nodes, query) {
  return nodes.reduce((acc, node) => {
    const match = node.name?.toLowerCase().includes(query);
    const filteredChildren = node.children?.length ? filterTree(node.children, query) : [];
    if (match || filteredChildren.length > 0)
      acc.push({ ...node, children: filteredChildren });
    return acc;
  }, []);
}

function HierarchySkeleton() {
  return (
    <div className="hi-skeleton">
      {[1, 2].map(i => (
        <div key={i} className="hi-skeleton-company">
          <div className="hi-skeleton-bar" style={{ width: "220px" }} />
          {[1, 2, 3].map(j => (
            <div key={j} className="hi-skeleton-bar"
              style={{ width: `${180 - j * 20}px`, marginLeft: j * 12 + "px" }} />
          ))}
        </div>
      ))}
    </div>
  );
}

export default HierarchyView;
```

### HierarchyView.css

```css
@import './admin-shared.css';

.hi-root { display: flex; flex-direction: column; gap: 16px; }

.hi-toolbar { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
.hi-title { font-size: 18px; font-weight: 700; color: var(--gray-800); margin: 0; }

.hi-search-wrap { position: relative; display: flex; align-items: center; }
.hi-search-icon { position: absolute; left: 10px; color: var(--gray-400); pointer-events: none; }
.hi-search {
  padding: 8px 12px 8px 32px;
  border: 1px solid var(--gray-200); border-radius: 8px;
  font-size: 13px; width: 240px;
  background: var(--white); color: var(--gray-700);
  transition: border-color var(--transition-fast);
}
.hi-search:focus { outline: none; border-color: var(--primary-color); }

.hi-tree { display: flex; flex-direction: column; gap: 8px; }

/* Company node */
.hi-company-node {
  background: var(--white);
  border: 1px solid var(--gray-200); border-radius: 10px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
  overflow: hidden;
}
.hi-company-header {
  display: flex; align-items: center; gap: 10px;
  padding: 12px 16px; cursor: pointer;
  transition: background 150ms; user-select: none;
}
.hi-company-header:hover { background: var(--gray-50); }
.hi-company-name { font-size: 15px; font-weight: 700; color: var(--gray-800); flex: 1; }
.hi-company-logo {
  width: 32px; height: 32px; border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 700; color: var(--white);
  overflow: hidden; flex-shrink: 0;
}
.hi-company-logo img { width: 100%; height: 100%; object-fit: cover; }
.hi-children { border-top: 1px solid var(--border-light); }

/* Dept node */
.hi-dept-node { border-bottom: 1px solid var(--border-light); }
.hi-dept-node:last-child { border-bottom: none; }
.hi-dept-header {
  display: flex; align-items: center; gap: 8px;
  height: 40px; cursor: pointer;
  background: var(--gray-50);
  transition: background 150ms; padding-right: 16px; user-select: none;
}
.hi-dept-header:hover { background: #f0f9ff; }
.hi-dept-name { font-size: 13px; font-weight: 600; color: var(--gray-800); flex: 1; }
.hi-dept-head-hint { font-size: 11px; color: var(--gray-400); }
.hi-dept-icon { color: var(--gray-400); flex-shrink: 0; }

/* User row */
.hi-user-row {
  display: flex; align-items: center; gap: 10px;
  height: 44px; background: var(--white);
  border-bottom: 1px solid var(--border-light);
  padding-right: 16px; transition: background 150ms;
}
.hi-user-row:hover { background: #f8fafc; }
.hi-user-row:last-child { border-bottom: none; }
.hi-user-row--head { background: rgba(47,198,246,0.03); }

/* Avatar */
.hi-avatar {
  width: 28px; height: 28px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 10px; font-weight: 700; color: var(--white);
  flex-shrink: 0; overflow: hidden;
}
.hi-avatar img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }

/* User info */
.hi-user-info { flex: 1; min-width: 0; display: flex; align-items: center; gap: 8px; }
.hi-user-name { font-size: 13px; font-weight: 500; color: var(--gray-800); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.hi-position { font-size: 11px; color: var(--gray-400); white-space: nowrap; }

/* Badges */
.hi-count-badge { font-size: 11px; font-weight: 600; color: var(--gray-500); background: var(--gray-100); padding: 2px 8px; border-radius: 20px; white-space: nowrap; }
.hi-head-badge { font-size: 11px; font-weight: 600; color: var(--primary-color); white-space: nowrap; }
.hi-role-badge { font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px; white-space: nowrap; }
.hi-role-badge--admin { background: #ede9fe; color: #7c3aed; }
.hi-role-badge--user { background: var(--gray-100); color: var(--gray-500); }
.hi-role-badge--superadmin { background: #fef3c7; color: #d97706; }

/* Chevron */
.hi-chevron { font-size: 10px; color: var(--gray-400); transition: transform 200ms; flex-shrink: 0; display: inline-block; }
.hi-chevron--open { transform: rotate(90deg); }

/* Skeleton */
.hi-skeleton { display: flex; flex-direction: column; gap: 12px; }
.hi-skeleton-company { display: flex; flex-direction: column; gap: 8px; padding: 12px 16px; background: var(--white); border-radius: 10px; border: 1px solid var(--gray-200); }
.hi-skeleton-bar { height: 12px; border-radius: 4px; background: linear-gradient(90deg, #f0f2f5 25%, #e8eaed 50%, #f0f2f5 75%); background-size: 200% 100%; animation: adm-shimmer 1.2s infinite; }

.hi-empty { text-align: center; color: var(--gray-400); padding: 40px 16px; font-size: 14px; }
```

---

## Redesign 3 — Modern UI (Wireframe-dən sonra)

UI/UX wireframe hazır olduqdan sonra aşağıdakı bölmələr wireframe-ə uyğun modernləşdiriləcək:

- `CompanyManagement.css` — wireframe-ə uyğun yenilənir
- `DepartmentManagement.css` — wireframe-ə uyğun yenilənir
- `PositionManagement.css` — wireframe-ə uyğun yenilənir
- `AdminPanel.css` — section spacing, typography

Mövcud `cm-*`, `dm-*`, `pm-*`, `ap-*` prefix-lər saxlanılır.
`admin-shared.css`-dən animasiyalar istifadə olunur — yenidən yaratma.

---

## Anti-AI Checklist

- [ ] SuperAdmin view: Company node-lar default **expanded**
- [ ] Admin view: company node YOX — birbaşa dept-lər
- [ ] Dept head user: `★ Head` badge-i var
- [ ] Search: user adını + dept adını filter edir (recursiv)
- [ ] Chevron: `transform: rotate(90deg)` animasiyası ilə
- [ ] Users nav item hər iki rol üçün görünür
- [ ] Departments + Positions yalnız Admin üçün görünür
