# User Detail Page — Full Redesign v2

**Date:** 2026-03-30
**From:** UI/UX Developer
**To:** Frontend Developer
**Priority:** High
**Type:** Task Handoff

---

## Summary

The User Detail Page (`/admin/users/:id`) has been fully redesigned. The tab-based layout is replaced with a single-page dashboard layout. Duplicate fields are consolidated, and a new stats row + SVG donut chart are introduced.

## Design Spec

Full wireframe, CSS, and interaction design:
**`agents/uiux-developer/outputs/2026-03-30_redesign_user-detail-page-v2.md`**

## Key Changes

### 1. Tab System Removed
- Remove `activeTab` state and tab bar
- All sections render on a single scrollable page
- Order: Hero → Stats Row → Content Grid (2-col) → Permissions

### 2. Stats Row (NEW)
- 4 mini dashboard cards: Storage, Status, Member Since, Password
- Grid layout: `repeat(4, 1fr)`
- Each card has a colored left accent border (3px)
- Values animate in with `translateY` on mount

### 3. Storage Donut Chart (NEW)
- Pure SVG donut (no library needed) — component code in spec
- Replaces the simple progress bar
- Legend with rounded-square dots, count + MB per category
- Needs `imageMb`, `documentMb`, `otherMb` from API (or calculate from totalMb)

### 4. Field Consolidation
| Field | Old Location | New Location |
|-------|-------------|--------------|
| Position | Hero + Employment card | Hero only (edit form keeps it) |
| Department | Employment + Organization tab | Organization section only |
| Account Created | Employment card | Stats Row "Member Since" |
| Password Changed | Employment + Security tab | Stats Row + Security card |
| Email/Phone | Personal Info card only | Hero (read-only) + Details (editable) |

### 5. Employment Card — REMOVED
- Fields distributed to Hero (position) and Personal Details (hired date)

### 6. Organization — Single Card
- Department + Supervisors + Subordinates merged into one card with dividers
- Count badges added: `Supervisors (2)`, `Subordinates (3)`

### 7. Security & Access — Single Card (right column)
- Session info + Password actions + Account status consolidated
- Action buttons: full-width styled buttons with icon containers
- Reset Password inline form preserved

### 8. Permissions — Full Width
- Module cards in `repeat(auto-fill, minmax(280px, 1fr))` grid
- Each module card has left accent border (`3px solid #2fc6f6`)
- Toggle behavior unchanged

## Files to Modify

- `chatapp-frontend/src/components/admin/UserDetailPage.jsx` — full restructure
- `chatapp-frontend/src/components/admin/UserDetailPage.css` — full restyle

## Anti-AI Rules (MUST follow)

- Purple (#8b5cf6, #7c3aed) FORBIDDEN
- No `ease`, `ease-in-out`, `linear` animations
- Spring: `cubic-bezier(0.16, 1, 0.3, 1)`, Material hover: `cubic-bezier(0.4, 0, 0.2, 1)`
- SuperAdmin badge: amber, Admin: cyan, User: neutral gray

## Acceptance Criteria

- [ ] No tabs — all sections visible on single page
- [ ] 4 stat cards render with correct data
- [ ] SVG donut chart shows storage breakdown
- [ ] No duplicate fields across sections
- [ ] Edit mode works for Personal Details
- [ ] Organization card shows dept + supervisors + subordinates
- [ ] Security actions (reset pwd, deactivate) work inline
- [ ] Permissions grid renders with toggles
- [ ] Card hover micro-interactions present
- [ ] Delete confirmation modal preserved
- [ ] Online status real-time (SignalR) preserved
