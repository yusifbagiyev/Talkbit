# Wireframe: User Detail Page + Admin Hierarchy Updates

**Author**: UI/UX Developer
**Date**: 2026-03-27
**Status**: Ready for Frontend

---

## Scope

1. User Detail — tam səhifə (`ap-content`-də, slide panel yox)
2. HierarchyView — action shortcuts yenidən dizayn
3. HierarchyView toolbar — `[+ New User]` + `[+ New Department]`
4. Department Management — tree view + detail panel
5. Position Management — list view update

---

## 1. User Detail Page (`ud-*`)

### Route / Navigation

- Click user name (HierarchyView) → `ap-content`-dəki aktiv section dəyişir, `HierarchyView` gizlənir, `UserDetailPage` açılır
- Breadcrumb: `Admin › Users › Elvin Quliyev`
- Sağ tərəfdə role badge: `[Admin]`
- Sol nav sabitdir, dəyişmir

### Layout

```
┌─── ap-header ───────────────────────────────────────────────────┐
│ [← Back to Chat]    Admin › Users › Elvin Quliyev    [Admin]   │
└─────────────────────────────────────────────────────────────────┘
┌─── ap-body ──────────────────────────────────────────────────────┐
│ [ap-nav]  │  ┌─── ud-root ───────────────────────────────────┐  │
│           │  │                                                │  │
│  Companies│  │  ┌─── ud-hero ─────────────────────────────┐  │  │
│  > Users  │  │  │  [Avatar 80px]  Elvin Quliyev            │  │  │
│  Depts    │  │  │  [status dot]   Backend Developer        │  │  │
│  Positions│  │  │                 [User] [Active]          │  │  │
│           │  │  │                 [Edit] [Reset Pwd] [⋯]   │  │  │
│           │  │  └─────────────────────────────────────────┘  │  │
│           │  │                                                │  │
│           │  │  ┌─── ud-tabs ─────────────────────────────┐  │  │
│           │  │  │ Overview │ Organization │ Permissions │Security│  │
│           │  │  └─────────────────────────────────────────┘  │  │
│           │  │                                                │  │
│           │  │  ┌─── ud-tab-content ──────────────────────┐  │  │
│           │  │  │  ...                                     │  │  │
│           │  │  └─────────────────────────────────────────┘  │  │
│           │  └────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

### CSS: Root

```css
.ud-root {
  max-width: 900px;
  padding: 24px;
}
```

---

### Hero Section

```css
.ud-hero {
  background: #1e2432;
  border-radius: 12px;
  padding: 28px 32px;
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  gap: 20px;
}

.ud-hero-avatar-wrap { position: relative; flex-shrink: 0; }

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
.ud-hero-status-dot.active  { background: #22c55e; }
.ud-hero-status-dot.inactive { background: #9ca3af; }

.ud-hero-info { flex: 1; min-width: 0; }
.ud-hero-name     { font-size: 22px; font-weight: 600; color: #fff; }
.ud-hero-position { font-size: 14px; color: rgba(255,255,255,0.55); margin-top: 2px; }
.ud-hero-badges   { display: flex; gap: 6px; margin-top: 10px; align-items: center; }

/* Sağ: action buttons */
.ud-hero-actions {
  display: flex; gap: 8px; align-items: center;
  margin-left: auto; flex-shrink: 0;
}

.ud-btn-outline {
  padding: 7px 14px; border-radius: 7px; font-size: 13px; font-weight: 500;
  border: 1px solid rgba(255,255,255,0.2); color: rgba(255,255,255,0.85);
  background: transparent; cursor: pointer;
  transition: background 150ms, border-color 150ms;
}
.ud-btn-outline:hover {
  background: rgba(255,255,255,0.08);
  border-color: rgba(255,255,255,0.35);
}

.ud-btn-danger-text {
  padding: 7px 14px; border-radius: 7px; font-size: 13px;
  background: transparent; border: none; color: #f87171; cursor: pointer;
}
.ud-btn-danger-text:hover { background: rgba(248,113,113,0.1); }

.ud-btn-more {
  width: 32px; height: 32px; border-radius: 7px;
  border: 1px solid rgba(255,255,255,0.2); background: transparent;
  color: rgba(255,255,255,0.7); cursor: pointer;
  display: flex; align-items: center; justify-content: center;
}
.ud-btn-more:hover { background: rgba(255,255,255,0.08); }
```

**Hero action buttons:** `[Edit Profile]` `[Reset Password]` `[⋯]`

- `[⋯]` dropdown: Edit, Reset Password, Deactivate/Activate, ── Delete (danger)

---

### Tabs

```css
.ud-tabs {
  display: flex;
  border-bottom: 1px solid #e5e7eb;
  margin-bottom: 20px;
  gap: 0;
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

4 tab: **Overview** | **Organization** | **Permissions** | **Security**

---

### Tab: Overview

2-column grid:

```css
.ud-overview-grid {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 16px;
}
```

**Left: Info cards**

```css
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
- **Personal Information**: Full Name, Email, Phone, Date of Birth, About Me
- **Employment**: Hiring Date, Password Changed (`"5 days ago"` — relative), Account Created

**Right: Storage card**

```css
.ud-storage-total { font-size: 24px; font-weight: 700; color: #111827; margin-bottom: 4px; }
.ud-storage-sub   { font-size: 12px; color: #6b7280; margin-bottom: 14px; }

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
.ud-storage-dot.images    { background: #2563eb; }
.ud-storage-dot.documents { background: #16a34a; }
.ud-storage-dot.other     { background: #9ca3af; }
.ud-storage-count { margin-left: auto; font-size: 12px; color: #9ca3af; }
```

- Max: 100 MB per user. Fill width = `(totalMb / 100) * 100`%
- Breakdown items: Images, Documents, Other — each shows size + file count

---

### Tab: Organization

3 card: **Department**, **Supervisors**, **Subordinates**

**Department card:**
```
Current dept name + [Change →] link-button
If no dept: "(No department)" + [Assign →]

"Change" klikdə inline dropdown:
  ┌─────────────────────────┐
  │ [search...]             │
  │ ▶ Backend Development   │
  │   ▷ Frontend sub-dept   │
  │ ▶ DevOps                │
  └─────────────────────────┘
  [Save Change]  [Cancel]

[Remove from dept] — text link, color: #ef4444
```

**Supervisors card:**
```
Each row:
[Avatar 28px] Murad Babayev · Senior DevOps Engineer   [✕]

"✕" → DELETE /api/users/{id}/supervisors/{supervisorId}

Bottom: [+ Add supervisor]
  → inline search input (debounce 300ms, GET /api/users/search?q=...)
  → dropdown suggestions → select → POST /api/users/{id}/supervisor
```

**Subordinates card:**
```
(Read-only)
[Avatar 28px] Həsən Başırov · Junior Backend Developer  [inactive badge]
```

---

### Tab: Permissions

```css
.ud-perm-module       { margin-bottom: 18px; }
.ud-perm-module-title {
  font-size: 11px; font-weight: 700; color: #6b7280;
  text-transform: uppercase; letter-spacing: 0.5px;
  margin-bottom: 10px;
}
.ud-perm-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 8px;
}

.ud-perm-item {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 14px; border-radius: 8px;
  border: 1px solid #e5e7eb; background: #fff;
}
.ud-perm-name { font-size: 13px; color: #374151; }

/* Custom toggle pill */
.ud-toggle {
  width: 36px; height: 20px; border-radius: 10px;
  position: relative; cursor: pointer;
  transition: background 150ms; border: none; padding: 0;
}
.ud-toggle.on  { background: #2563eb; }
.ud-toggle.off { background: #e5e7eb; }
.ud-toggle-knob {
  position: absolute; top: 2px;
  width: 16px; height: 16px; border-radius: 50%; background: #fff;
  transition: left 150ms;
}
.ud-toggle.on  .ud-toggle-knob { left: 18px; }
.ud-toggle.off .ud-toggle-knob { left: 2px; }
```

- Permissions module-lara görə qruplaşdırılır
- Optimistic update: toggle klikdə vizual dərhal dəyişir, API background-da
- Footer: `[Reset to Role Defaults]` — outlined, small

---

### Tab: Security

**Session card:**
```
Last Login: "2 hours ago" — 2026-03-27 09:41
[Activity Logs — Coming soon]  (disabled, italic, color: #9ca3af)
```

**Password card:**
```
Last changed: "5 days ago"
[Reset Password] →
  inline expand (card içərisində):
  ┌──────────────────────────────────┐
  │ New Password       [input]       │
  │ Confirm Password   [input]       │
  │            [Save]  [Cancel]      │
  └──────────────────────────────────┘
```

**Account Status card:**
```
Status: ● Active
[Deactivate Account]  — outlined, color: #ef4444
```
```
Status: ○ Inactive
[Activate Account]    — outlined, color: #16a34a
```

---

## 2. HierarchyView — Action Shortcuts Redesign

3 button qrupu: `[✏]` `[⏻]` `[⋯]`

```css
.hi-actions {
  display: flex; align-items: center; gap: 4px;
  opacity: 0;
  transition: opacity 150ms;
  flex-shrink: 0; margin-left: auto;
}
.hi-user-row:hover .hi-actions,
.hi-user-row.dropdown-open .hi-actions { opacity: 1; }

.hi-action-btn {
  width: 28px; height: 28px;
  border-radius: 6px; border: none;
  background: transparent; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  color: #6b7280;
  transition: background 120ms, color 120ms;
}
.hi-action-btn:hover { background: #f3f4f6; color: #111827; }

/* Toggle button — user statusuna görə rənglənir */
.hi-action-btn.toggle.is-active   { color: #16a34a; }
.hi-action-btn.toggle.is-inactive { color: #9ca3af; }
.hi-action-btn.toggle:hover       { background: #f0fdf4; }

/* ⋯ Dropdown */
.hi-action-dropdown {
  position: absolute; right: 0; top: calc(100% + 4px);
  width: 180px; background: #fff;
  border: 1px solid #e5e7eb; border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.10);
  z-index: 100; padding: 4px 0;
}
.hi-dropdown-item {
  width: 100%; text-align: left; padding: 8px 14px;
  font-size: 13px; color: #374151;
  background: none; border: none; cursor: pointer;
}
.hi-dropdown-item:hover  { background: #f9fafb; }
.hi-dropdown-item.danger { color: #ef4444; }
.hi-dropdown-divider     { height: 1px; background: #f3f4f6; margin: 4px 0; }
```

More dropdown məzmunu:
```
Edit
Reset Password
Deactivate / Activate
─────────────────────
Delete  (danger)
```

Görünürlük qaydası:
- Default: `opacity: 0; pointer-events: none`
- Row hover: `opacity: 1; pointer-events: all`
- Dropdown açıq: həmişə görünür (`.dropdown-open` class)

---

## 3. HierarchyView Toolbar — New Buttons

```css
.hi-toolbar {
  display: flex; align-items: center;
  gap: 12px; padding: 0 0 16px 0;
}
/* Sol:   .hi-title-wrap (title + count badge) */
/* Orta:  .hi-search-wrap (flex: 1) */
/* Sağ:   .hi-toolbar-actions */

.hi-toolbar-actions { display: flex; gap: 8px; flex-shrink: 0; }

.hi-btn-primary {
  padding: 7px 14px; border-radius: 7px;
  font-size: 13px; font-weight: 500;
  background: #2563eb; color: #fff;
  border: none; cursor: pointer;
  transition: background 150ms;
}
.hi-btn-primary:hover { background: #1d4ed8; }

.hi-btn-secondary {
  padding: 7px 14px; border-radius: 7px;
  font-size: 13px; font-weight: 500;
  background: #fff; color: #374151;
  border: 1px solid #e5e7eb; cursor: pointer;
  transition: background 150ms;
}
.hi-btn-secondary:hover { background: #f9fafb; }
```

- **`[+ New User]`** → `hi-btn-primary` → slide panel (CreateUserForm)
- **`[+ New Department]`** → `hi-btn-secondary` → slide panel (CreateDeptForm)
  - Admin role-da (isSuperAdmin=false): `[+ New Department]` görünür
  - SuperAdmin role-da: hər iki button görünür

---

## 4. Department Management Redesign

```
Layout:
┌─── dm-toolbar ────────────────────────────────────────────────┐
│ [🔍 Search...]                         [+ New Department]     │
└───────────────────────────────────────────────────────────────┘
┌─── dm-tree ───────────────────────────────────────────────────┐
│ ▼ Backend Development    Head: Murad    7 users   [✏] [🗑]   │
│   ▼ Frontend Sub-dept    Head: —        2 users   [✏] [🗑]   │
│ ▼ DevOps                 Head: Samir    4 users   [✏] [🗑]   │
└───────────────────────────────────────────────────────────────┘
```

```css
.dm-toolbar {
  display: flex; align-items: center;
  justify-content: space-between; gap: 12px;
  margin-bottom: 16px;
}

.dm-tree { display: flex; flex-direction: column; }

.dm-dept-row {
  display: flex; align-items: center; gap: 8px;
  height: 44px;
  padding-left: /* level * 24px + 12px */;
  padding-right: 12px;
  background: #fff;
  border-bottom: 1px solid #f3f4f6;
  cursor: pointer;
  transition: background 150ms;
}
.dm-dept-row:hover { background: #f8fafc; }

.dm-dept-name {
  font-size: 13px; font-weight: 600; color: #111827;
  flex: 1; cursor: pointer;
}
.dm-dept-name:hover { color: #2563eb; }

.dm-dept-head  { font-size: 12px; color: #6b7280; width: 120px; }
.dm-dept-count { font-size: 12px; color: #9ca3af; width: 60px; text-align: right; }

/* Row actions — opacity 0 → 1 on hover */
.dm-row-actions {
  display: flex; gap: 4px;
  opacity: 0; transition: opacity 120ms;
}
.dm-dept-row:hover .dm-row-actions { opacity: 1; }

.dm-action-btn {
  width: 26px; height: 26px; border-radius: 5px;
  border: none; background: transparent; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  color: #9ca3af; transition: background 120ms, color 120ms;
}
.dm-action-btn:hover       { background: #f3f4f6; color: #374151; }
.dm-action-btn.delete:hover { background: #fef2f2; color: #ef4444; }
```

**Dept Detail Panel (400px, sağdan açılır):**

```
┌──── dm-detail-panel ─────────────────────────────────────────┐
│ [×]  Frontend                                                │
├──────────────────────────────────────────────────────────────┤
│  Head: Aysel H.                           [Change Head]      │
├──────────────────────────────────────────────────────────────┤
│  Stats                                                       │
│  ┌──────────┐  ┌──────────┐                                 │
│  │ 4 Users  │  │ 0 Sub-   │                                 │
│  │          │  │ depts    │                                 │
│  └──────────┘  └──────────┘                                 │
├──────────────────────────────────────────────────────────────┤
│  Members                                                     │
│  [Avatar 28px] Aysel H. — Frontend Lead  ★ Head             │
│  [Avatar 28px] Murad B. — Frontend Dev                      │
├──────────────────────────────────────────────────────────────┤
│  [Edit Department]   [Delete]                                │
└──────────────────────────────────────────────────────────────┘
```

- `animation: ap-panel-in 200ms cubic-bezier(0.16, 1, 0.3, 1)` — `admin-shared.css`-dən
- Backdrop: `rgba(0,0,0,0.10)`, click outside → close
- Delete: inline confirm `[Delete?] [Yes] [No]` — modal deyil

---

## 5. Position Management Redesign

```
Layout:
┌─── pm-toolbar ────────────────────────────────────────────────┐
│ [🔍 Search...]  [Dept filter ▾]            [+ New Position]  │
└───────────────────────────────────────────────────────────────┘
┌─── pm-list ───────────────────────────────────────────────────┐
│  Backend Developer      Backend Dev    12 users   [✏] [🗑]   │
│  Senior Backend Dev.    Backend Dev     3 users   [✏] [🗑]   │
│  DevOps Engineer        DevOps          4 users   [✏] [🗑]   │
└───────────────────────────────────────────────────────────────┘
```

```css
.pm-toolbar {
  display: flex; align-items: center; gap: 10px;
  margin-bottom: 16px;
}
.pm-filter-select {
  height: 36px; padding: 0 10px;
  border: 1px solid #e5e7eb; border-radius: 8px;
  font-size: 13px; color: #374151; background: #fff;
  cursor: pointer;
}

.pm-list { display: flex; flex-direction: column; }

.pm-position-row {
  display: flex; align-items: center; gap: 8px;
  height: 44px; padding: 0 12px;
  background: #fff;
  border-bottom: 1px solid #f3f4f6;
  transition: background 150ms;
}
.pm-position-row:hover { background: #f8fafc; }

.pm-pos-name   { font-size: 13px; font-weight: 500; color: #111827; flex: 1; }
.pm-pos-dept   { font-size: 12px; color: #6b7280; width: 160px; }
.pm-pos-count  { font-size: 12px; color: #9ca3af; width: 70px; text-align: right; }

.pm-row-actions {
  display: flex; gap: 4px;
  opacity: 0; transition: opacity 120ms;
}
.pm-position-row:hover .pm-row-actions { opacity: 1; }

/* pm-action-btn: eyni .dm-action-btn stili */
```

- Edit: side panel (300px) — position name + department seçim dropdown
- User count: `positionDto.userCount` varsa göstər; yoxsa `"—"`
- Department filter: `<select>` — `getDepartments()` ilə doldurulur

---

## CSS Namespace

| Prefix | Component |
|--------|-----------|
| `ud-*` | User Detail Page |
| `hi-*` | HierarchyView (mövcud — genişləndirilir) |
| `dm-*` | Department Management |
| `pm-*` | Position Management |

Shared: `admin-shared.css` (`ap-panel-in`, `ap-panel-out`, `adm-dropdownIn`, `row-remove`)

---

## Anti-AI Checklist

- [x] Hero: `#1e2432` solid (gradient veya purple yox)
- [x] Tabs: `border-bottom: 2px solid #2563eb` (pill tabs deyil)
- [x] Permission toggles: custom `36×20px` pill (checkbox deyil)
- [x] Action buttons: `28×28px`, `border-radius: 6px`
- [x] Storage bar: solid `#2563eb` (gradient yox)
- [x] Hover transitions: `120-150ms`
- [x] Action shortcuts: `opacity: 0` default, row hover-da görünür
- [x] Toggle `⏻` rengi: `#16a34a` aktiv, `#9ca3af` deaktiv
- [x] Panel animations: `ap-panel-in / ap-panel-out` — `admin-shared.css`-dən
