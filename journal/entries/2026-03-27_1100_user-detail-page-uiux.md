# UI/UX Task: User Detail Page + Admin Panel Redesign

**From**: Product Owner
**To**: UI/UX Developer
**Date**: 2026-03-27
**Priority**: P1

---

## Scope

1. User Detail — tam səhifə dizaynı (slide panel yox, `ap-content` içərisində)
2. HierarchyView — action shortcuts yenidən dizayn
3. HierarchyView — toolbar: "New User" + "New Department" butonları
4. Department Management — yenidən dizayn
5. Position Management — yenidən dizayn

---

## 1. User Detail Page

İstifadəçi adına basıldıqda HierarchyView əvəzinə `ap-content`-də tam səhifə görünür.
Layout dəyişmir: sol nav hər zaman görünür. Breadcrumb: `Admin › Users › [Ad Soyad]`.

### Layout

```
┌─── ap-header ─────────────────────────────────────────────┐
│ [← Back to Chat]   Admin › Users › Elvin Quliyev  [Admin] │
└────────────────────────────────────────────────────────────┘
┌─── ap-body ─────────────────────────────────────────────────┐
│ [ap-nav]  │  ┌─── ud-root ──────────────────────────────┐  │
│           │  │                                           │  │
│ Companies │  │  ┌─── ud-hero ──────────────────────────┐│  │
│ > Users   │  │  │ [Avatar 80px + status dot]            ││  │
│ Depts     │  │  │ Elvin Quliyev                         ││  │
│ Positions │  │  │ Backend Developer                     ││  │
│           │  │  │ [User] [Active]                       ││  │
│           │  │  │ [Edit Profile] [Reset Pwd] [Deactivate││  │
│           │  │  └──────────────────────────────────────┘│  │
│           │  │                                           │  │
│           │  │  ┌─── ud-tabs ──────────────────────────┐│  │
│           │  │  │ Overview | Organization | Permissions  ││  │
│           │  │  │          | Security                   ││  │
│           │  │  └──────────────────────────────────────┘│  │
│           │  │                                           │  │
│           │  │  ┌─── ud-tab-content ───────────────────┐│  │
│           │  │  │  ...                                  ││  │
│           │  │  └──────────────────────────────────────┘│  │
│           │  └──────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Hero Section

```
.ud-hero {
  background: #1e2432;
  border-radius: 12px;
  padding: 28px 32px;
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  gap: 20px;
}

.ud-hero-avatar-wrap {
  position: relative;
  flex-shrink: 0;
}

.ud-hero-avatar {
  width: 80px; height: 80px;
  border-radius: 50%;
  border: 3px solid rgba(255,255,255,0.15);
  font-size: 26px; font-weight: 600; color: #fff;
  display: flex; align-items: center; justify-content: center;
}

.ud-hero-status-dot {
  position: absolute; bottom: 4px; right: 4px;
  width: 12px; height: 12px; border-radius: 50%;
  border: 2px solid #1e2432;
}
.ud-hero-status-dot.active { background: #22c55e; }
.ud-hero-status-dot.inactive { background: #9ca3af; }

.ud-hero-info { flex: 1; min-width: 0; }
.ud-hero-name { font-size: 22px; font-weight: 600; color: #fff; }
.ud-hero-position { font-size: 14px; color: rgba(255,255,255,0.55); margin-top: 2px; }

.ud-hero-badges { display: flex; gap: 6px; margin-top: 10px; align-items: center; }

/* Action row (sağ tərəf) */
.ud-hero-actions { display: flex; gap: 8px; align-items: center; margin-left: auto; flex-shrink: 0; }

.ud-btn-outline {
  padding: 7px 14px; border-radius: 7px; font-size: 13px; font-weight: 500;
  border: 1px solid rgba(255,255,255,0.2); color: rgba(255,255,255,0.85);
  background: transparent; cursor: pointer;
  transition: background 150ms, border-color 150ms;
}
.ud-btn-outline:hover { background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.35); }

.ud-btn-danger-text {
  padding: 7px 14px; border-radius: 7px; font-size: 13px;
  background: transparent; border: none; color: #f87171; cursor: pointer;
}
.ud-btn-danger-text:hover { background: rgba(248,113,113,0.1); }

.ud-btn-more {
  width: 32px; height: 32px; border-radius: 7px;
  border: 1px solid rgba(255,255,255,0.2); background: transparent;
  color: rgba(255,255,255,0.7); cursor: pointer; display: flex;
  align-items: center; justify-content: center;
}
```

### Tabs

```
.ud-tabs {
  display: flex; border-bottom: 1px solid #e5e7eb;
  margin-bottom: 20px; gap: 0;
}

.ud-tab {
  padding: 10px 18px; font-size: 14px; font-weight: 500;
  color: #6b7280; background: transparent; border: none;
  border-bottom: 2px solid transparent; cursor: pointer;
  transition: color 150ms, border-color 150ms;
}
.ud-tab.active { color: #2563eb; border-bottom-color: #2563eb; }
.ud-tab:hover:not(.active) { color: #374151; }
```

4 tab: **Overview**, **Organization**, **Permissions**, **Security**

---

### Tab: Overview — 2-column grid

```
.ud-overview-grid {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 16px;
}
```

**Left — Info cards:**

```
.ud-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 20px 24px;
  margin-bottom: 16px;
}

.ud-card-title {
  font-size: 11px; font-weight: 600; color: #9ca3af;
  text-transform: uppercase; letter-spacing: 0.5px;
  margin-bottom: 14px;
}

.ud-info-row {
  display: flex; align-items: baseline;
  padding: 7px 0; border-bottom: 1px solid #f3f4f6;
}
.ud-info-row:last-child { border-bottom: none; }
.ud-info-label { width: 140px; font-size: 13px; color: #6b7280; flex-shrink: 0; }
.ud-info-value { font-size: 13px; color: #111827; font-weight: 500; }
```

Cards:
- "Personal Information": Full Name, Email, Phone, Date of Birth, About Me
- "Employment": Hiring Date, Password Changed (relative: "5 days ago"), Account Created

**Right — Storage card:**

```
.ud-storage-card { ... (same .ud-card) }

.ud-storage-total { font-size: 24px; font-weight: 700; color: #111827; margin-bottom: 4px; }
.ud-storage-sub { font-size: 12px; color: #6b7280; margin-bottom: 14px; }

.ud-storage-bar-bg {
  height: 6px; background: #e5e7eb; border-radius: 3px; margin-bottom: 16px;
}
.ud-storage-bar-fill {
  height: 100%; background: #2563eb; border-radius: 3px;
  transition: width 600ms ease;
}

.ud-storage-breakdown { display: flex; flex-direction: column; gap: 6px; }
.ud-storage-item {
  display: flex; align-items: center; gap: 8px;
  font-size: 13px; color: #374151;
}
.ud-storage-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.ud-storage-dot.images { background: #2563eb; }
.ud-storage-dot.documents { background: #16a34a; }
.ud-storage-dot.other { background: #9ca3af; }
.ud-storage-count { margin-left: auto; font-size: 12px; color: #9ca3af; }
```

Max storage: 100 MB per user (progress bar hesabı).
`totalMb / 100 * 100` = fill width %-i.

---

### Tab: Organization

3 card: Department, Supervisors, Subordinates

**Department card:**
```
Current dept name + [Change →] link-button
If no dept: "(No department)" + [Assign →]

"Change" klikdə: inline dropdown (department siyahısı — getDepartments() ilə):
  ┌─────────────────────────┐
  │ [search...]             │
  │ > Backend Development   │
  │   > Frontend sub-dept   │
  │ > DevOps                │
  └─────────────────────────┘
  [Save Change]  [Cancel]

[Remove from dept] — text link, color: #ef4444
```

**Supervisors card:**
```
Each supervisor row:
[Avatar 28px] Murad Babayev · Senior DevOps Engineer   [✕ remove]

"✕ remove" → DELETE /api/users/{id}/supervisors/{supervisorId}

Bottom: [+ Add supervisor] link
  → opens search input:
    [🔍 Search user...]
    (debounce 300ms, calls GET /api/users/search?q=...)
    Dropdown suggestions → select → POST /api/users/{id}/supervisor
```

**Subordinates card:**
```
(Read-only list)
[Avatar 28px] Həsən Başırov · Junior Backend Developer  [inactive badge]
```

---

### Tab: Permissions

All available permissions grouped by module. Toggle each on/off.

```
.ud-perm-module { margin-bottom: 18px; }
.ud-perm-module-title {
  font-size: 11px; font-weight: 700; color: #6b7280;
  text-transform: uppercase; letter-spacing: 0.5px;
  margin-bottom: 10px;
}
.ud-perm-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 8px;
}

.ud-perm-item {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 14px; border-radius: 8px;
  border: 1px solid #e5e7eb; background: #fff;
}
.ud-perm-name { font-size: 13px; color: #374151; }

/* Toggle pill */
.ud-toggle {
  width: 36px; height: 20px; border-radius: 10px;
  position: relative; cursor: pointer;
  transition: background 150ms; border: none; padding: 0;
}
.ud-toggle.on { background: #2563eb; }
.ud-toggle.off { background: #e5e7eb; }
.ud-toggle-knob {
  position: absolute; top: 2px;
  width: 16px; height: 16px; border-radius: 50%; background: #fff;
  transition: left 150ms;
}
.ud-toggle.on .ud-toggle-knob { left: 18px; }
.ud-toggle.off .ud-toggle-knob { left: 2px; }
```

Below all modules: `[Reset to Role Defaults]` — outlined button, small.

**Optimistic update:** Toggle klikdə vizual dərhal dəyişir, API call background-da gedir.

---

### Tab: Security

3 card:

**Session card:**
```
Last Login: [relative time] — [exact date/time]
[Logs — Coming soon]  (disabled, italic)
```

**Password card:**
```
Last changed: [relative time]
[Reset Password] button →
  Opens inline form (card içərisində expand olur):
  ┌──────────────────────────────────┐
  │ New Password        [input]       │
  │ Confirm Password    [input]       │
  │ [Save]  [Cancel]                 │
  └──────────────────────────────────┘
```

**Account Status card:**
```
Status: ● Active / ○ Inactive
[Deactivate Account] / [Activate Account] — outlined danger/success button
```

---

## 2. HierarchyView — Action Shortcuts Redesign

Mövcud icon button dizaynı dəyişdirilir:

```
User row:
[Avatar] [Name] [Position]                [role badge] [head badge] [actions-group]
                                                                      ↑ opacity 0
                                                            row hover: opacity 1
```

```
.hi-actions {
  display: flex; align-items: center; gap: 4px;
  opacity: 0; transition: opacity 150ms;
  flex-shrink: 0; margin-left: auto;
}
.hi-user-row:hover .hi-actions,
.hi-user-row.dropdown-open .hi-actions { opacity: 1; }

.hi-action-btn {
  width: 28px; height: 28px;
  border-radius: 6px; border: none;
  background: transparent; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  color: #6b7280; transition: background 120ms, color 120ms;
}
.hi-action-btn:hover { background: #f3f4f6; color: #111827; }

/* Toggle active/inactive */
.hi-action-btn.toggle.is-active { color: #16a34a; }
.hi-action-btn.toggle.is-inactive { color: #9ca3af; }
.hi-action-btn.toggle:hover { background: #f0fdf4; }

/* Dropdown */
.hi-action-dropdown {
  position: absolute; right: 0; top: calc(100% + 4px);
  width: 180px; background: #fff;
  border: 1px solid #e5e7eb; border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  z-index: 100; padding: 4px 0;
}
.hi-dropdown-item {
  width: 100%; text-align: left; padding: 8px 14px;
  font-size: 13px; color: #374151; background: none; border: none;
  cursor: pointer;
}
.hi-dropdown-item:hover { background: #f9fafb; }
.hi-dropdown-item.danger { color: #ef4444; }
.hi-dropdown-divider { height: 1px; background: #f3f4f6; margin: 4px 0; }
```

3 button: `[✏ edit]` `[⏻ toggle]` `[⋯ more]`

More dropdown içərisində:
- Edit
- Reset Password
- Deactivate / Activate
- ─────
- Delete (danger)

---

## 3. HierarchyView Toolbar — New Buttons

```
.hi-toolbar {
  display: flex; align-items: center;
  gap: 12px; padding: 0 0 16px 0;
}
/* Sol: title + count badge */
/* Ortada: search input (flex:1) */
/* Sağda: [+ New User] [+ New Department] */

.hi-toolbar-actions { display: flex; gap: 8px; flex-shrink: 0; }

.hi-btn-primary {
  padding: 7px 14px; border-radius: 7px; font-size: 13px; font-weight: 500;
  background: #2563eb; color: #fff; border: none; cursor: pointer;
}
.hi-btn-primary:hover { background: #1d4ed8; }

.hi-btn-secondary {
  padding: 7px 14px; border-radius: 7px; font-size: 13px; font-weight: 500;
  background: #fff; color: #374151;
  border: 1px solid #e5e7eb; cursor: pointer;
}
.hi-btn-secondary:hover { background: #f9fafb; }
```

- **+ New User** → slide panel (CreateUserForm) — mövcud UserManagement.jsx-dəki forma istifadə oluna bilər
- **+ New Department** — Admin-only (isSuperAdmin false olduqda görünür) → slide panel (CreateDeptForm)

---

## 4. Department Management — Redesign

DepartmentManagement.jsx-in mövcud cədvəl dizaynını HierarchyView ilə uyğunlaşdır.
Vizual dil: eyni `.ud-card`, `.hi-*` color palette.

```
Layout:
┌─── dm-toolbar ─────────────────────────────────────────────┐
│ [🔍 Search...]                          [+ New Department] │
└────────────────────────────────────────────────────────────┘
┌─── dm-tree ────────────────────────────────────────────────┐
│ ▼ Backend Development    Head: Murad    7 users            │
│   ▼ Frontend Sub-dept    Head: —        2 users      [✏][🗑]│
│ ▼ DevOps                 Head: Samir    4 users            │
└────────────────────────────────────────────────────────────┘
```

- Expand/collapse (chevron) — mövcud tree logic saxla
- Row hover: [Edit] [Delete] icons appear (opacity 0 → 1)
- Click row name → dept detail panel (sağdan açılır, 400px) — eyni HierarchyView-dakı DeptDetailPanel üslubu

**Dept Detail Panel:**
- Header: dept name + close btn
- Sections: Head (+ change btn), Stats (member count, sub-dept count), Members list
- Footer: [Edit] [Delete] buttons

---

## 5. Position Management — Redesign

PositionManagement-in cədvəl dizaynını yeniləmək.

```
Layout:
┌─── pm-toolbar ─────────────────────────────────────────────┐
│ [🔍 Search...]   [Dept filter ▾]         [+ New Position] │
└────────────────────────────────────────────────────────────┘
┌─── pm-list ────────────────────────────────────────────────┐
│ Backend Developer          Backend Dev    12 users  [✏][🗑] │
│ Senior Backend Developer   Backend Dev     3 users  [✏][🗑] │
│ DevOps Engineer            DevOps          4 users  [✏][🗑] │
└────────────────────────────────────────────────────────────┘
```

- Row hover: edit/delete icon-lar görünür
- Edit: inline-edit row (expand) və ya side panel
- "user count" məlumatı — mövcud PositionDto-da varsa göstər; yoxdursa "—"

---

## CSS Class Namespace

```
ud-*  → User Detail Page
hi-*  → HierarchyView (mövcud)
dm-*  → Department Management (mövcud, update)
pm-*  → Position Management (mövcud, update)
```

Mövcud `admin-shared.css`-dəki `ap-panel-in`, `ap-panel-out` animasiyalarından istifadə et.

---

## Anti-AI Checklist

- [ ] Hero: bg #1e2432 (gradient purple deyil)
- [ ] Tabs: border-bottom 2px blue (pill tabs deyil)
- [ ] Permission toggles: custom pill 36×20 (checkbox deyil)
- [ ] Action buttons: 28×28px, 6px radius (uniform)
- [ ] Hover transitions: 120-150ms ease (spring deyil)
- [ ] Storage bar: solid #2563eb (gradient deyil)
- [ ] Icons: SVG (emoji deyil production-da)
- [ ] Action shortcuts: opacity 0 default, row hover-da görünür
