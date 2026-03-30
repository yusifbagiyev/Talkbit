# Wireframe: Mobile Responsive Design System

**Author**: UI/UX Developer
**Date**: 2026-03-30
**Status**: Ready for Frontend
**Priority**: P0 — CRITICAL

---

## Breakpoint Sistemi

```css
/* responsive-breakpoints.css — bütün responsive fayllar bunu istifadə edir */
:root {
  --bp-sm: 375px;   /* iPhone SE, Galaxy S9 */
  --bp-md: 768px;   /* iPad Mini, tablet */
  --bp-lg: 1024px;  /* iPad Air, kiçik desktop */
  --bp-xl: 1280px;  /* desktop */
}
```

**Yanaşma:** Desktop-first. Mövcud CSS-ə toxunulmur. `@media (max-width)` ilə override əlavə edilir.

**CSS faylları:** Hər komponent CSS faylının sonuna `/* ─── Responsive ─── */` bölməsi əlavə et. Ayrıca responsive fayl yaratma — mövcud CSS-in sonuna yaz.

---

## CSS Variables — Responsive

```css
/* Desktop default-lar artıq mövcuddur — bu override-lardır */

@media (max-width: 1023px) {
  :root {
    --conv-list-width: 280px;
    --admin-sidebar-width: 180px;
    --spacing-page: 16px;
  }
}

@media (max-width: 767px) {
  :root {
    --conv-list-width: 100%;
    --admin-sidebar-width: 0;
    --spacing-page: 12px;
    --spacing-card: 12px;
  }
}
```

---

## 1. Chat Səhifəsi

### Mövcud Desktop Layout (dəyişmir):
```
[Sidebar 60px] [ConversationList 400px] [ChatPanel flex:1] [ProfilePanel 76%]
```

### Tablet (768px – 1023px): Two Panel

```css
/* Chat.css-in sonuna əlavə et */

@media (max-width: 1023px) {
  .sidebar {
    width: 48px;
    /* icon-only mode: text label gizlənir */
  }
  .sidebar .nav-label { display: none; }

  .conversation-panel {
    width: 280px;
    min-width: 280px;
  }

  /* chat-panel: flex:1 saxla — dəyişiklik yoxdur */
}
```

### Mobile (< 768px): Single Panel Navigation

3 "ekran" arasında keçid: ConversationList → ChatPanel → DetailPanel

```
STATE 1 (default):              STATE 2 (chat selected):         STATE 3 (info clicked):
┌─────────────────────┐        ┌─────────────────────┐         ┌─────────────────────┐
│ [≡]  Chats  [🔍][+] │        │ [←] Elvin Q.  [i][⋯]│         │ [←]  Details         │
│─────────────────────│        │─────────────────────│         │─────────────────────│
│ 📌 Pinned            │        │ Messages            │         │ Members              │
│ ▪ Chat 1             │        │                     │         │ Files / Media        │
│ ▪ Chat 2             │        │                     │         │ Links                │
│ All Chats            │        │                     │         │                     │
│ ▪ Chat 3             │        │─────────────────────│         │                     │
│ ▪ Chat 4             │        │ [Input Area]        │         │                     │
│─────────────────────│        └─────────────────────┘         └─────────────────────┘
│ [💬][📞][👥][⚙]     │
└─────────────────────┘
```

```css
@media (max-width: 767px) {
  /* ─── Main layout ─── */
  .main-body { flex-direction: column; position: relative; }

  /* ─── Sidebar → bottom tab bar ─── */
  .sidebar {
    width: 100%;
    height: 52px;
    flex-direction: row;
    order: 2;                /* altda görünsün */
    border-top: 1px solid rgba(255,255,255,0.08);
    border-right: none;
    padding: 0 8px;
    padding-bottom: env(safe-area-inset-bottom);
  }
  .sidebar-logo { display: none; }
  .sidebar-nav {
    flex-direction: row;
    justify-content: space-around;
    padding: 0;
    gap: 0;
    width: 100%;
  }
  .nav-item {
    width: 44px; height: 44px;
    /* 4 əsas icon: Chat, Calls, Contacts, Settings */
  }
  .sidebar-bottom { display: none; }

  /* ─── ConversationList → tam ekran ─── */
  .conversation-panel {
    width: 100%;
    min-width: unset;
    position: absolute;
    inset: 0;
    z-index: 10;
    transition: transform 250ms cubic-bezier(0.4, 0, 0.2, 1);
  }
  .conversation-panel.hidden-mobile {
    transform: translateX(-100%);
    pointer-events: none;
  }

  .conversation-panel-header {
    padding: 8px 12px;
  }
  .conversation-item {
    height: 64px;         /* 70px → 64px */
    padding: 0 12px;
    margin: 0;
  }

  /* ─── ChatPanel → tam ekran, back button ─── */
  .chat-panel {
    display: flex !important;    /* mövcud 768px rule override */
    position: absolute;
    inset: 0;
    z-index: 20;
    transform: translateX(100%);
    transition: transform 250ms cubic-bezier(0.4, 0, 0.2, 1);
  }
  .chat-panel.visible-mobile {
    transform: translateX(0);
  }

  .chat-header {
    height: 52px;
    min-height: 52px;
    padding: 0 8px;
  }
  .chat-header-avatar { width: 36px; height: 36px; }

  /* ─── Mobile back button (ChatHeader-ə əlavə olunacaq) ─── */
  .mobile-back-btn {
    display: flex;
    width: 36px; height: 36px;
    align-items: center; justify-content: center;
    border: none; background: transparent;
    color: #fff; cursor: pointer;
  }

  /* ─── Input area ─── */
  .message-input-wrapper {
    min-height: 68px;        /* 86px → 68px */
    border-radius: 18px;
  }
  .message-input {
    min-height: 52px;        /* 71px → 52px */
    font-size: 16px;         /* iOS zoom prevention */
    padding-bottom: 36px;
  }

  /* ─── Emoji picker ─── */
  .emoji-panel {
    position: fixed;
    bottom: 0; left: 0; right: 0;
    width: 100%; height: 50vh;
    border-radius: 16px 16px 0 0;
    z-index: 100;
  }

  /* ─── Scroll-to-bottom ─── */
  .scroll-to-bottom-btn {
    bottom: 100px;
    right: 12px;
  }
}
```

### Mobile — State Management (React):

```jsx
// Chat.jsx-ə əlavə olacaq state:
const [mobileView, setMobileView] = useState('conversations');
// 'conversations' | 'chat' | 'detail'

// Conversation click → setMobileView('chat')
// Back button → setMobileView('conversations')
// Info button → setMobileView('detail')

// Class əlavəsi:
// conversation-panel: mobileView !== 'conversations' → 'hidden-mobile'
// chat-panel: mobileView === 'chat' || mobileView === 'detail' → 'visible-mobile'
```

---

## 2. UserProfilePanel

### Mövcud Desktop: `width: 76%`, `right: 0`, `top: 20px`

### Tablet (768px – 1023px):

```css
@media (max-width: 1023px) {
  .upp-panel {
    width: min(90vw, 440px);
    top: 0;
    height: 100vh;
    border-radius: 0;
  }
  .upp-close-btn {
    right: min(90vw, 440px);
  }
  .upp-avatar-wrapper {
    width: 160px; height: 160px;   /* 240 → 160 */
  }
}
```

### Mobile (< 768px):

```css
@media (max-width: 767px) {
  .upp-panel {
    width: 100%;
    top: 0;
    height: 100vh;
    height: 100dvh;      /* dynamic viewport — mobile browser UI nəzərə alır */
    border-radius: 0;
    animation: uppSlideUp 250ms cubic-bezier(0.4, 0, 0.2, 1);
  }
  .upp-close-btn {
    position: absolute;       /* fixed → absolute */
    top: 12px; right: 12px;
    left: auto;
    width: 36px; height: 36px;
  }
  .upp-overlay { background: rgba(0,0,0,0.7); }

  .upp-avatar-wrapper {
    width: 120px; height: 120px;   /* 240 → 120 */
  }

  .upp-header { padding: 12px 16px 0; }
  .upp-main-wrapper {
    padding: 16px;
    flex-direction: column;
  }

  .upp-tab-bar {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
  }
  .upp-tab-bar::-webkit-scrollbar { display: none; }
}

@keyframes uppSlideUp {
  from { transform: translateY(100%); }
  to   { transform: translateY(0); }
}
```

---

## 3. Admin Səhifələri

### Mövcud Desktop: `ap-nav 216px` + `ap-content flex:1`

### Tablet (768px – 1023px):

```css
@media (max-width: 1023px) {
  .ap-nav {
    width: 180px;
  }
  .ap-nav-item span {
    font-size: 12px;
  }
  .ap-content {
    padding: 16px;
  }
}
```

### Mobile (< 768px):

```
┌─────────────────────┐
│ [☰]  Admin  [search]│  ← hamburger menu
│─────────────────────│
│ Content (tam ekran)  │
│ Cards / Lists        │
│                     │
└─────────────────────┘

Hamburger click:
┌─────────────────────┐
│ ╳  Admin Panel      │  ← drawer header
│─────────────────────│
│ Companies            │
│ Users                │
│ Departments          │
│ Positions            │
│─────────────────────│
│ ← Back to Chat      │
└─────────────────────┘
```

```css
@media (max-width: 767px) {
  .ap-body { flex-direction: column; position: relative; }

  /* ─── Hamburger button (AdminPanel header-ə əlavə olunacaq) ─── */
  .ap-hamburger {
    display: flex;
    width: 36px; height: 36px;
    align-items: center; justify-content: center;
    border: none; background: transparent;
    color: #64748b; cursor: pointer;
  }

  /* ─── Nav → drawer ─── */
  .ap-nav {
    position: fixed;
    top: 0; left: 0; bottom: 0;
    width: 260px;
    z-index: 200;
    transform: translateX(-100%);
    transition: transform 250ms cubic-bezier(0.16, 1, 0.3, 1);
  }
  .ap-nav.open { transform: translateX(0); }

  .ap-nav-backdrop {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.4);
    z-index: 199;
    opacity: 0; pointer-events: none;
    transition: opacity 200ms;
  }
  .ap-nav-backdrop.visible { opacity: 1; pointer-events: all; }

  /* ─── Content → tam ekran ─── */
  .ap-content {
    padding: 12px;
    width: 100%;
  }

  /* ─── Header ─── */
  .ap-header {
    padding: 0 12px;
    gap: 8px;
  }
  .ap-breadcrumb { font-size: 13px; }

  /* ─── Detail drawers → tam ekran overlay ─── */
  .cm-form-panel,
  .cm-detail-panel,
  .dm-form-panel,
  .dm-detail-panel,
  .pm-form-panel {
    width: 100%;
    border-radius: 0;
  }
}
```

---

## 4. UserDetailPage — Mobile

### Mövcud Desktop: `max-width: 960px`, `grid: 1fr 380px`

### Tablet:

```css
@media (max-width: 1023px) {
  .ud-root { padding: 16px; }

  .ud-content-grid {
    grid-template-columns: 1fr;   /* 1fr 380px → 1fr */
    gap: 16px;
  }
  .ud-content-right { width: 100%; }

  .ud-stats-row {
    grid-template-columns: repeat(2, 1fr);   /* 4 → 2x2 */
  }
}
```

### Mobile:

```css
@media (max-width: 767px) {
  .ud-root { padding: 12px; max-width: 100%; }

  /* ─── Hero ─── */
  .ud-hero {
    flex-direction: column;
    align-items: flex-start;
    padding: 20px 16px;
    gap: 12px;
  }
  .ud-hero-avatar { width: 60px; height: 60px; font-size: 20px; }
  .ud-hero-actions {
    margin-left: 0;
    width: 100%;
    justify-content: flex-end;
    gap: 6px;
  }
  .ud-hero-name { font-size: 18px; }
  .ud-hero-position { font-size: 13px; }

  /* ─── Stats ─── */
  .ud-stats-row {
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }
  .ud-stat-value { font-size: 20px; }

  /* ─── Content ─── */
  .ud-content-grid {
    grid-template-columns: 1fr;
  }

  /* ─── Cards ─── */
  .ud-detail-card { padding: 16px; }
  .ud-info-row {
    flex-direction: column;
    gap: 2px;
    padding: 8px 0;
  }
  .ud-info-label { width: auto; font-size: 11px; }
  .ud-info-value { font-size: 14px; }

  /* ─── Edit mode ─── */
  .ud-edit-row {
    grid-template-columns: 1fr;     /* 1fr 1fr → 1fr */
  }

  /* ─── Donut chart ─── */
  .ud-donut-wrap svg { width: 140px; height: 140px; }

  /* ─── Permission grid ─── */
  .ud-perm-modules-grid {
    grid-template-columns: 1fr;
  }
}
```

---

## 5. HierarchyView — Mobile

### Mövcud Desktop: search 300px, tree cards, 44px user rows

### Tablet:

```css
@media (max-width: 1023px) {
  .hi-search-input { width: 220px; }

  .hi-stats-row {
    flex-wrap: wrap;
  }
  .hi-stat-item { flex: 1 1 calc(50% - 8px); }

  /* Dept info — ellipsis */
  .hi-dept-head-sub { max-width: 120px; }
}
```

### Mobile:

```css
@media (max-width: 767px) {
  /* ─── Toolbar → stacked ─── */
  .hi-toolbar {
    flex-direction: column;
    gap: 8px;
    padding-bottom: 12px;
  }
  .hi-search-wrap { width: 100%; }
  .hi-search-input { width: 100%; }

  .hi-toolbar-actions {
    width: 100%;
    display: flex;
    gap: 8px;
  }
  .hi-toolbar-actions button { flex: 1; }

  /* ─── Stats → 2x2 grid ─── */
  .hi-stats-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }

  /* ─── Tree nodes ─── */
  .hi-company-header { padding: 10px 12px; }
  .hi-company-logo { width: 28px; height: 28px; }

  /* Dept row — kiçildilmiş */
  .hi-dept-node { height: 36px; }
  .hi-dept-head-sub { display: none; }     /* mobilda gizlən */
  .hi-dept-count { font-size: 11px; }

  /* User row */
  .hi-user-row { height: 40px; }
  .hi-avatar { width: 24px; height: 24px; }
  .hi-user-position { display: none; }     /* mobilda gizlən */

  /* Actions — həmişə görünsün (touch target) */
  .hi-actions { opacity: 1; }
  .hi-action-btn { width: 32px; height: 32px; }   /* 28→32, touch-friendly */

  /* Detail panel → tam ekran */
  .hi-detail-panel,
  .hi-user-detail-panel {
    width: 100%;
    border-radius: 0;
  }

  /* Expand/collapse controls */
  .hi-expand-controls { display: none; }
}
```

---

## 6. CompanyManagement — Mobile

### Mövcud: table layout + 420px form panel + 380px detail panel

### Mobile:

```css
@media (max-width: 767px) {
  /* ─── Toolbar → stacked ─── */
  .cm-toolbar {
    flex-direction: column;
    gap: 8px;
  }
  .cm-search-input { width: 100%; }

  /* ─── Table → card layout ─── */
  .cm-table-wrap { overflow-x: auto; }
  .cm-table { min-width: 600px; }  /* horizontal scroll əvəzinə */

  /* Alternatif: card layout */
  /* Əgər user istəsə table əvəzinə card-lara keçid olsun deyə
     frontend developer qərar versin — wireframe-da hər iki variant var */

  /* ─── Panels → tam ekran ─── */
  .cm-form-panel,
  .cm-detail-panel,
  .cm-assign-panel {
    width: 100%;
    border-radius: 0;
  }

  .cm-detail-hero { padding: 20px 16px; }
  .cm-detail-logo { width: 56px; height: 56px; }   /* 64→56 */

  .cm-form-body { padding: 16px; }
  .cm-form-actions { padding: 12px 16px; }
}
```

---

## 7. DepartmentManagement — Mobile

### Mövcud: tree view + 420px form + 400px detail

### Mobile:

```css
@media (max-width: 767px) {
  /* ─── Toolbar ─── */
  .dm-toolbar {
    flex-direction: column;
    gap: 8px;
  }
  .dm-toolbar .dm-search-input { width: 100%; }

  /* ─── Stats → 2x2 ─── */
  .dm-stats {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }

  /* ─── Tree ─── */
  .dm-dept-row {
    height: 40px;            /* 44→40 */
  }
  .dm-dept-head { display: none; }    /* mobilda gizlən */
  .dm-dept-sub-count { display: none; }

  /* Actions — həmişə görünür */
  .dm-row-actions { opacity: 1; }
  .dm-action-btn { width: 30px; height: 30px; }

  /* Detail → tam ekran */
  .dm-detail-panel,
  .dm-form-panel {
    width: 100%;
    border-radius: 0;
  }
}
```

---

## 8. PositionManagement — Mobile

### Mövcud: list view + 420px form panel

### Mobile:

```css
@media (max-width: 767px) {
  /* ─── Header ─── */
  .pm-header {
    flex-direction: column;
    gap: 8px;
  }
  .pm-header .pm-search-input { width: 100%; }

  /* ─── Stats → 2x2 ─── */
  .pm-stats {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }

  /* ─── Position rows ─── */
  .pm-pos-row { height: 40px; }
  .pm-pos-desc { display: none; }   /* mobilda gizlən */
  .pm-row-actions { opacity: 1; }

  /* Form → tam ekran */
  .pm-form-panel {
    width: 100%;
    border-radius: 0;
  }
}
```

---

## 9. Touch-Friendly Qaydaları

```css
/* admin-shared.css-ə əlavə olunacaq */
@media (max-width: 767px) {
  /* Minimum touch target: 44px (Apple HIG) */
  button, [role="button"], .clickable {
    min-height: 44px;
    min-width: 44px;
  }

  /* Dropdown items: 44px height */
  .hi-dropdown-item,
  .adm-dropdown-item {
    min-height: 44px;
    padding: 12px 14px;
  }

  /* Input font: 16px (iOS zoom prevention) */
  input, textarea, select {
    font-size: 16px;
  }

  /* Safe area padding — iPhone notch/home indicator */
  .sidebar {
    padding-bottom: env(safe-area-inset-bottom);
  }
}
```

---

## 10. Drawer/Panel Davranışı (bütün komponentlər)

| Ekran | Davranış |
|-------|----------|
| Desktop (≥1024px) | Mövcud — dəyişiklik yoxdur |
| Tablet (768–1023px) | `width: min(90vw, {original_width}px)` + backdrop |
| Mobile (<768px) | `width: 100%; height: 100dvh` + slide-in |

```css
/* Tablet */
@media (max-width: 1023px) {
  .cm-form-panel, .cm-detail-panel { width: min(90vw, 420px); }
  .dm-form-panel, .dm-detail-panel { width: min(90vw, 420px); }
  .pm-form-panel                   { width: min(90vw, 420px); }
}

/* Mobile — tam ekran */
@media (max-width: 767px) {
  .cm-form-panel, .cm-detail-panel,
  .dm-form-panel, .dm-detail-panel,
  .pm-form-panel {
    width: 100%;
    height: 100dvh;
    border-radius: 0;
    top: 0;
  }
}
```

---

## 11. `100vh` → `100dvh` Keçidi

Mobile browser-lərdə `100vh` address bar-ı nəzərə almır → layout overflow yaradır.

```css
@media (max-width: 767px) {
  .main-layout { height: 100dvh; }
  .ap-page     { height: 100dvh; }
}
```

`dvh` support yoxdursa fallback:
```css
height: 100vh;
height: 100dvh;  /* override — support olan browser istifadə edir */
```

---

## Anti-AI Checklist

- [x] Animasiya curve-ləri: `cubic-bezier(0.4, 0, 0.2, 1)` (ease yox)
- [x] Bottom tab bar: native feel, gradient background saxla
- [x] Drawer slide-in: `translateX` (opacity fade deyil)
- [x] Purple YASAQ — bütün ekranlarda
- [x] Touch target: 44px minimum
- [x] iOS zoom: input font-size 16px
- [x] Safe area: `env(safe-area-inset-bottom)`
- [x] 100dvh: mobile viewport

---

## İmplementasiya Sırası (Frontend üçün tövsiyə)

1. **Breakpoint variables** — responsive-breakpoints.css
2. **Chat — mobile navigation** — ən böyük dəyişiklik, state management
3. **Sidebar → bottom tab bar**
4. **Admin nav → hamburger drawer**
5. **UserDetailPage** — grid collapse
6. **HierarchyView** — toolbar + tree collapse
7. **Company/Dept/Position panels** — tam ekran drawer
8. **UserProfilePanel** — tam ekran
9. **Emoji picker** — bottom sheet
10. **Touch-friendly** — shared rules
