# Frontend Task: Admin Panel Redesign — Users Hierarchy + Modern UI

**From**: Product Owner
**To**: Frontend Developer
**Date**: 2026-03-26
**Priority**: P1
**Wireframe**: `agents/uiux-developer/outputs/2026-03-26_wireframe_admin-panel-redesign.md`
**Depends on**: UI/UX wireframe completion

---

## Context

Admin Panel-in iki əsas dəyişikliyi var:

1. **Users bölməsi** — SuperAdmin + Admin üçün iyerarxik ağac görünüşü (mövcud flat list əvəzinə)
2. **Bütün bölmələr** — modern UI/UX redesign (wireframe-ə uyğun)

Backend **hazırdır** — yeni endpoint lazım deyil.

---

## Backend Endpoint

```
GET /api/identity/organization/hierarchy?companyId={guid}
```

**SuperAdmin** (param olmadan) → bütün şirkətlər + onların dept/user iyerarxiyası
**SuperAdmin** (`?companyId=...`) → yalnız həmin şirkət
**Admin** (param olmadan) → avtomatik öz şirkəti (JWT-dən scoped)

### Response Shape

```js
[
  {
    type: "Company",           // "Company" | "Department" | "User"
    id: "guid",
    name: "166 Logistics",
    level: 0,
    userCount: 42,
    headOfDepartmentId: "guid | null",
    headOfDepartmentName: "string | null",
    email: null,
    role: null,
    isActive: true,
    avatarUrl: null,
    positionName: null,
    departmentId: null,
    isDepartmentHead: false,
    supervisorName: null,
    subordinateCount: 0,
    children: [
      {
        type: "Department",
        id: "guid",
        name: "Engineering",
        level: 1,
        userCount: 12,
        children: [
          {
            type: "Department",      // sub-department
            name: "Frontend",
            level: 2,
            children: [
              {
                type: "User",
                name: "Aysel H.",
                level: 3,
                email: "aysel@...",
                role: "User",
                positionName: "Frontend Lead",
                isDepartmentHead: true,
                avatarUrl: "...",
                children: []
              }
            ]
          }
        ]
      }
    ]
  }
]
```

---

## Fayllar

| Fayl | Əməliyyat |
|------|-----------|
| `src/components/admin/HierarchyView.jsx` | Yarat — iyerarxik ağac komponenti |
| `src/components/admin/HierarchyView.css` | Yarat — `hi-*` stillər |
| `src/pages/AdminPanel.jsx` | Dəyiş — Users nav hər ikisi üçün görünür |
| `src/services/api.js` | Dəyiş — `getOrganizationHierarchy` əlavə et |

---

## Addım 1 — api.js

```js
function getOrganizationHierarchy(companyId = null) {
  const query = companyId ? `?companyId=${companyId}` : '';
  return apiGet(`/api/identity/organization/hierarchy${query}`);
}
```

Export-a əlavə et.

---

## Addım 2 — AdminPanel.jsx

Users nav itemini hər iki rol üçün göstər:

```jsx
// əvvəl:
{!isSuperAdmin && <button ...>Users</button>}

// sonra:
<button
  className={`ap-nav-item${activeSection === "users" ? " active" : ""}`}
  onClick={() => setActiveSection("users")}
>
  <svg .../>
  Users
</button>
```

Content render:
```jsx
{activeSection === "users" && <HierarchyView isSuperAdmin={isSuperAdmin} />}
```

Köhnə `<UserManagement>` komponenti Users bölməsindən çıxarılır — artıq istifadə olunmur burada. (Komponent faylını silmə — gələcəkdə lazım ola bilər.)

---

## Addım 3 — HierarchyView.jsx

```jsx
import { useState, useEffect, useMemo } from "react";
import { getOrganizationHierarchy } from "../../services/api";
import { getFileUrl } from "../../services/api";
import { getInitials, getAvatarColor } from "../../utils/chatUtils";
import "./HierarchyView.css";

function HierarchyView({ isSuperAdmin }) {
  const [tree, setTree] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState(new Set()); // collapsed node id-ləri

  useEffect(() => {
    getOrganizationHierarchy()
      .then(data => setTree(data || []))
      .finally(() => setLoading(false));
  }, []);

  const toggleCollapse = (id) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Render recursive node
  const renderNode = (node) => {
    const isCollapsed = collapsed.has(node.id);
    const hasChildren = node.children?.length > 0;

    if (node.type === "Company") {
      return (
        <div key={node.id} className="hi-company-node">
          <div className="hi-company-header" onClick={() => toggleCollapse(node.id)}>
            <span className={`hi-chevron ${isCollapsed ? "" : "expanded"}`}>▶</span>
            <div className="hi-company-logo">
              {node.avatarUrl
                ? <img src={getFileUrl(node.avatarUrl)} alt="" />
                : <span>{getInitials(node.name)}</span>}
            </div>
            <span className="hi-company-name">{node.name}</span>
            <span className="hi-count-badge">{node.userCount ?? 0} users</span>
          </div>
          {!isCollapsed && hasChildren && (
            <div className="hi-company-children">
              {node.children.map(renderNode)}
            </div>
          )}
        </div>
      );
    }

    if (node.type === "Department") {
      const indent = node.level * 24;
      return (
        <div key={node.id} className="hi-dept-node" style={{ paddingLeft: indent + 16 }}>
          <div className="hi-dept-header" onClick={() => toggleCollapse(node.id)}>
            {hasChildren && (
              <span className={`hi-chevron ${isCollapsed ? "" : "expanded"}`}>▶</span>
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
            <div className="hi-dept-children">
              {node.children.map(renderNode)}
            </div>
          )}
        </div>
      );
    }

    if (node.type === "User") {
      const indent = node.level * 24;
      return (
        <div key={node.id} className={`hi-user-row${node.isDepartmentHead ? " hi-user-row--head" : ""}`}
          style={{ paddingLeft: indent + 16 }}>
          <div className="hi-avatar" style={{ background: node.avatarUrl ? "transparent" : getAvatarColor(node.name) }}>
            {node.avatarUrl
              ? <img src={getFileUrl(node.avatarUrl)} alt="" />
              : getInitials(node.name)}
          </div>
          <div className="hi-user-info">
            <span className="hi-user-name">{node.name}</span>
            {node.positionName && <span className="hi-position">{node.positionName}</span>}
          </div>
          {node.isDepartmentHead && <span className="hi-head-badge">★ Head</span>}
          <span className={`hi-role-badge hi-role-badge--${node.role?.toLowerCase()}`}>{node.role}</span>
        </div>
      );
    }

    return null;
  };

  // Admin view-da company node yoxdur — birbaşa dept/user-lər
  const nodes = isSuperAdmin
    ? tree
    : tree.flatMap(n => n.type === "Company" ? n.children : [n]);

  // Search filter — node adını yoxla (recursive deyil — sadə filter)
  const searchLower = search.toLowerCase().trim();
  const visible = searchLower
    ? filterTree(nodes, searchLower)
    : nodes;

  return (
    <div className="hi-root">
      <div className="hi-toolbar">
        <h2 className="hi-title">Users</h2>
        <div className="hi-search-wrap">
          <svg className="hi-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            className="hi-search"
            placeholder="Search users or departments..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
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
```

### Search filter helper

```js
function filterTree(nodes, query) {
  return nodes.reduce((acc, node) => {
    const nameMatch = node.name?.toLowerCase().includes(query);
    const filteredChildren = node.children?.length
      ? filterTree(node.children, query)
      : [];

    if (nameMatch || filteredChildren.length > 0) {
      acc.push({ ...node, children: filteredChildren });
    }
    return acc;
  }, []);
}
```

### Skeleton

```jsx
function HierarchySkeleton() {
  return (
    <div className="hi-skeleton">
      {[1, 2].map(i => (
        <div key={i} className="hi-skeleton-company">
          <div className="hi-skeleton-bar" style={{ width: "200px" }} />
          {[1, 2, 3].map(j => (
            <div key={j} className="hi-skeleton-bar" style={{ width: `${160 - j * 20}px`, marginLeft: "24px" }} />
          ))}
        </div>
      ))}
    </div>
  );
}
```

---

## Addım 4 — HierarchyView.css

```css
@import './admin-shared.css';

.hi-root { display: flex; flex-direction: column; gap: 16px; }

/* Toolbar */
.hi-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}
.hi-title { font-size: 18px; font-weight: 700; color: var(--gray-800); margin: 0; }
.hi-search-wrap { position: relative; display: flex; align-items: center; }
.hi-search-icon { position: absolute; left: 10px; color: var(--gray-400); pointer-events: none; }
.hi-search {
  padding: 8px 12px 8px 32px;
  border: 1px solid var(--gray-200);
  border-radius: 8px;
  font-size: 13px;
  width: 240px;
  background: var(--white);
  color: var(--gray-700);
  transition: border-color var(--transition-fast);
}
.hi-search:focus { outline: none; border-color: var(--primary-color); }

/* Tree */
.hi-tree { display: flex; flex-direction: column; gap: 8px; }

/* Company node */
.hi-company-node {
  background: var(--white);
  border: 1px solid var(--gray-200);
  border-radius: 10px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
  overflow: hidden;
}
.hi-company-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  cursor: pointer;
  transition: background 150ms;
  user-select: none;
}
.hi-company-header:hover { background: var(--gray-50); }
.hi-company-name { font-size: 15px; font-weight: 700; color: var(--gray-800); flex: 1; }
.hi-company-logo {
  width: 32px; height: 32px; border-radius: 8px;
  background: var(--gray-200);
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 700; color: var(--white);
  overflow: hidden; flex-shrink: 0;
}
.hi-company-logo img { width: 100%; height: 100%; object-fit: cover; }
.hi-company-children { border-top: 1px solid var(--border-light); }

/* Dept node */
.hi-dept-node { border-bottom: 1px solid var(--border-light); }
.hi-dept-node:last-child { border-bottom: none; }
.hi-dept-header {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 40px;
  cursor: pointer;
  background: var(--gray-50);
  transition: background 150ms;
  padding-right: 16px;
  user-select: none;
}
.hi-dept-header:hover { background: #f0f9ff; }
.hi-dept-name { font-size: 13px; font-weight: 600; color: var(--gray-800); flex: 1; }
.hi-dept-head-hint { font-size: 11px; color: var(--gray-400); }
.hi-dept-icon { color: var(--gray-400); flex-shrink: 0; }

/* User row */
.hi-user-row {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 44px;
  background: var(--white);
  border-bottom: 1px solid var(--border-light);
  padding-right: 16px;
  transition: background 150ms;
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
.hi-count-badge {
  font-size: 11px; font-weight: 600; color: var(--gray-500);
  background: var(--gray-100); padding: 2px 8px; border-radius: 20px;
  white-space: nowrap;
}
.hi-head-badge {
  font-size: 11px; font-weight: 600; color: var(--primary-color);
  white-space: nowrap;
}
.hi-role-badge {
  font-size: 11px; font-weight: 600; padding: 2px 8px;
  border-radius: 4px; white-space: nowrap;
}
.hi-role-badge--admin { background: #ede9fe; color: #7c3aed; }
.hi-role-badge--user { background: var(--gray-100); color: var(--gray-500); }
.hi-role-badge--superadmin { background: #fef3c7; color: #d97706; }

/* Chevron */
.hi-chevron {
  font-size: 10px;
  color: var(--gray-400);
  transition: transform 200ms;
  flex-shrink: 0;
  display: inline-block;
}
.hi-chevron.expanded { transform: rotate(90deg); }

/* Skeleton */
.hi-skeleton { display: flex; flex-direction: column; gap: 12px; }
.hi-skeleton-company { display: flex; flex-direction: column; gap: 8px; padding: 12px 16px; background: var(--white); border-radius: 10px; border: 1px solid var(--gray-200); }
.hi-skeleton-bar {
  height: 12px; border-radius: 4px;
  background: linear-gradient(90deg, #f0f2f5 25%, #e8eaed 50%, #f0f2f5 75%);
  background-size: 200% 100%;
  animation: adm-shimmer 1.2s infinite;
}

/* Empty */
.hi-empty { text-align: center; color: var(--gray-400); padding: 40px 16px; font-size: 14px; }
.hi-no-dept-section { border-top: 2px dashed var(--gray-200); margin-top: 4px; }
```

---

## Anti-AI Checklist

- [ ] Admin view-da company node göstərilmir — birbaşa dept-lər
- [ ] SuperAdmin view-da company node default **expanded** (collapsed deyil)
- [ ] `isDepartmentHead: true` olan user-ə `★ Head` badge-i
- [ ] Search həm user adını, həm dept adını filter edir
- [ ] Expand/collapse chevron rotate animasiyası (`transform: rotate(90deg)`)
- [ ] Skeleton: company + dept + user placeholder-lar (flat skeleton deyil)

---

## Qeyd

- `UserManagement` komponenti Users nav-dan çıxarılır, lakin **fayl silinmir** — DepartmentManagement-in Assign Head panelindəki user search üçün lazım ola bilər
- `getOrganizationHierarchy()` yeni api funksiyasıdır — `getUsers()` əvəzinə istifadə olunur
