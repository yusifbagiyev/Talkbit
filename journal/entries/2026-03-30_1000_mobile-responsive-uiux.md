# UI/UX Task: Mobile Responsive Design System

**From**: Product Owner
**To**: UI/UX Developer
**Date**: 2026-03-30
**Priority**: P0 — CRITICAL

---

## Xülasə

Bütün ChatApp səhifələri və komponentləri mobil responsive olmalıdır. Hal-hazırda yalnız Login səhifəsi responsive-dir. Bütün digər səhifələr mobil telefonlarda sınır. Breakpoint sistemi, layout strategiyası və hər səhifə üçün wireframe hazırla.

---

## 1. Breakpoint Sistemi

Aşağıdakı breakpoint-ləri təyin et:

```
--bp-sm:   375px   (iPhone SE, Galaxy S9)
--bp-md:   768px   (iPad Mini, tablet)
--bp-lg:   1024px  (iPad Air, kiçik desktop)
--bp-xl:   1280px  (desktop)
```

**Yanaşma:** Mövcud desktop layout saxlanılır. `@media (max-width)` ilə mobil/tablet uyğunlaşdırma əlavə edilir. Mövcud desktop CSS-ə toxunulmur.

---

## 2. Chat Səhifəsi — Layout Strategiyası

### Mobile (< 768px): Single panel navigation

```
┌─────────────────────┐
│ Conversations List  │  ← default görünüş
│ (tam ekran)         │
│                     │
│ Search + Filter     │
│ Pinned Chats        │
│ All Chats           │
└─────────────────────┘

User conversation-a basır → slide transition:

┌─────────────────────┐
│ ← Back  Chat Header │  ← back button ilə conversations-a qayıt
│─────────────────────│
│ Messages            │
│                     │
│ Input Area          │
└─────────────────────┘

User "i" (info) basır → slide transition:

┌─────────────────────┐
│ ← Back  Details     │  ← back button ilə chat-a qayıt
│─────────────────────│
│ Members             │
│ Files / Media       │
│ Links               │
└─────────────────────┘
```

- Sidebar (icon bar) → bottom tab bar kimi göstər (WhatsApp/Telegram style)
- ConversationList → tam ekran
- Chat Panel → tam ekran, back button ilə
- Detail Sidebar → tam ekran, back button ilə
- Slide transitions: 250ms ease

### Tablet (768px - 1023px): Two panel

```
┌──────────────┬──────────────────┐
│ CONV LIST    │   CHAT PANEL     │
│ (280px)      │   (flex: 1)      │
│              │                  │
│              │ Detail → overlay │
└──────────────┴──────────────────┘
```

- ConversationList: 280px (kiçildilmiş)
- Chat Panel: flex: 1
- Detail Sidebar: overlay/drawer (sağdan açılır)
- Sidebar: 48px (kiçik iconlar)

### Desktop (≥ 1024px): Mövcud 3-4 panel layout

Dəyişiklik lazım deyil — hazırkı layout saxlanılır.

---

## 3. Admin Səhifələri — Layout Strategiyası

### Mobile (< 768px):

```
┌─────────────────────┐
│ ☰ Admin   [search]  │  ← hamburger menu
│─────────────────────│
│ Content (tam ekran)  │
│                     │
│ Cards / List        │
└─────────────────────┘
```

- Admin sidebar (216px) → hamburger menu (slide-in drawer)
- Content → tam ekran
- Detail drawers (380-440px) → full-screen overlay
- Search input → tam genişlik
- Table layout → card layout (stacked)

### Tablet (768px - 1023px):

- Admin sidebar: 180px (kiçildilmiş, yalnız icon + qısaldılmış text)
- Content: flex: 1
- Detail drawers: max-width: 90vw

### UserDetailPage — Mobile Layout:

```
Mobile:
┌─────────────────────┐
│ Hero (tam genişlik)  │
│ Avatar + Name + Acts │
│─────────────────────│
│ Tabs (scrollable)    │
│─────────────────────│
│ Tab Content          │
│ (single column)      │
└─────────────────────┘
```

- Overview grid: 2-column → 1-column
- Info label width: 120px → auto (stacked)
- Action buttons: horizontal → vertical stack və ya overflow menu

### HierarchyView — Mobile Layout:

```
Mobile:
┌─────────────────────┐
│ [Search tam genişlik]│
│─────────────────────│
│ Stats Row (2x2 grid)│
│─────────────────────│
│ Tree (accordion)     │
│  ▶ Company A         │
│    ▶ Department 1    │
│      · User 1        │
│      · User 2        │
└─────────────────────┘
```

- Search: 300px → 100%
- Stats row: 4-column → 2x2 grid
- Detail panel: tam ekran overlay

---

## 4. CSS Variables — Responsive System (Specification)

Frontend agentinə ötürüləcək dəyərlər:

| Variable | Mobile (<768) | Tablet (768-1023) | Desktop (≥1024) |
|----------|---------------|-------------------|-----------------|
| `--conv-list-width` | 100% | 280px | 400px |
| `--detail-sidebar-width` | 100% | min(90vw, 350px) | 350px |
| `--admin-sidebar-width` | 0 (hamburger) | 180px | 216px |
| `--spacing-page` | 12px | 16px | 24px |
| `--spacing-card` | 12px | 16px | 16px |

---

## 5. Touch-Friendly Design Qaydaları

- Minimum touch target: 44px × 44px (Apple HIG)
- Button padding: minimum 10px
- Dropdown/menu items: minimum height 44px
- Swipe gestures: conversation-da sola sürüşdür → delete/pin/mute
- Back navigation: sol yuxarı angle bracket + swipe right to go back
- Bottom safe area: iPhone notch/home indicator üçün `env(safe-area-inset-bottom)`

---

## 6. Drawer/Panel Behavior

### Mobile (< 768px):
- Bütün drawers: `width: 100%; height: 100vh`
- Slide-in animation: `transform: translateX(100%)` → `translateX(0)`
- Back button: sol yuxarı köşədə
- Scroll: touch scroll native

### Tablet (768px - 1023px):
- Drawers: `width: min(90vw, 440px)`
- Backdrop: rgba(0,0,0,0.4) overlay
- Click outside → close

### Desktop (≥ 1024px):
- Mövcud davranış saxlanılır

---

## 7. Gələcək Səhifələr Üçün Qayda

Yeni səhifə/komponent yaradılarkən:
1. Mobile-first CSS yaz (əsas stillər mobil üçün)
2. `min()`, `max()`, `clamp()` istifadə et hardcoded px əvəzinə
3. Drawer/panel genişliyi: `width: min(90vw, {max_width}px)` pattern
4. Grid layout: `repeat(auto-fit, minmax(280px, 1fr))` pattern
5. Touch target: minimum 44px
6. Test: 375px, 768px, 1024px-da yoxla

---

## 8. Çatışmayan Komponentlər — Wireframe Lazımdır

### UserProfilePanel (sağ tərəfdən açılan profil paneli)
- Desktop: 380px sağdan slide-in
- Mobile: tam ekran overlay, back button ilə

### FilePreviewPanel (fayl upload preview)
- Desktop: chat panel-in üstündə overlay
- Mobile: tam ekran, send button aşağıda

### ImageViewer (şəkil böyütmə)
- Desktop: modal overlay
- Mobile: tam ekran, pinch-to-zoom, swipe to dismiss

### CompanyManagement
- Desktop: table + detail drawer (380px)
- Mobile: card list + tam ekran detail overlay

### DepartmentManagement
- Desktop: tree (200px) + list + detail drawer (400px)
- Mobile: accordion tree (tam genişlik) + tam ekran detail overlay

### PositionManagement
- Desktop: filter sidebar (220px) + list + detail drawer (420px)
- Mobile: filter dropdown + list + tam ekran detail overlay

---

## Çıxarılacaq Artifacts

1. Breakpoint sistemi + variable specification cədvəli
2. Chat səhifəsi — mobile wireframe (3 panel → single panel navigation)
3. Admin səhifələri — mobile wireframe (hamburger + full-screen drawers)
4. Profil/File preview/Image viewer — mobile wireframes
5. Touch interaction qaydaları
6. Drawer/panel responsive behavior specification
7. Component-level responsive guidelines (table → card, grid → stack, etc.)
8. CompanyManagement, DepartmentManagement, PositionManagement — mobile wireframes
