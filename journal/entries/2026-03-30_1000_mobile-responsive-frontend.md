# Frontend Task: Mobile Responsive Implementation

**From**: Product Owner
**To**: Frontend Developer
**Date**: 2026-03-30
**Priority**: P0 — CRITICAL

---

## ⛔ ÖNƏMLİ

Bu tapşırıq böyükdür. Hər bölməni tamamladıqdan sonra **Chrome DevTools → Device Toolbar ilə 375px, 768px, 1024px ekran ölçülərində test et**. Sınan komponent varsa, növbəti bölməyə keçmədən düzəlt. Yarımçıq buraxma.

**DİQQƏT:** Bu tapşırıqdakı CSS class adları nümunədir — real class adlarını fayllardan oxu. Kodu copy-paste etmə, mövcud strukturu analiz et, sonra uyğunlaşdır.

---

## Xülasə

Bütün səhifələr və komponentlər mobil responsive olmalıdır. UI/UX agenti wireframe və breakpoint sistemi hazırlayıb (`2026-03-30_1000_mobile-responsive-uiux.md`). Əvvəlcə UI/UX tapşırığını oxu, sonra implementasiya et.

**Mövcud vəziyyət:** 27 CSS faylından yalnız 2-sində media query var. Demək olar ki, heç bir mobil dəstək yoxdur.

**Yanaşma:** Mövcud CSS desktop üçün yazılıb. Bütün CSS-i mobile-first-ə yenidən yazmaq risqlidir — desktop layout sınır. Ona görə `@media (max-width: 767px)` və `@media (max-width: 1023px)` ilə override yanaşması istifadə et. Desktop CSS-ə toxunma.

---

## Faza 1: Responsive Foundation

### 1.1 CSS Variables + Breakpoints

**Fayl:** `chatapp-frontend/src/styles/responsive.css` (yeni fayl)

```css
:root {
  --bp-sm: 375px;
  --bp-md: 768px;
  --bp-lg: 1024px;
  --bp-xl: 1280px;

  --spacing-page: 24px;
  --spacing-card: 16px;
  --conv-list-width: 400px;
  --detail-sidebar-width: 350px;
  --admin-sidebar-width: 216px;
}

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
    --detail-sidebar-width: 100%;
    --admin-sidebar-width: 0px;
    --spacing-page: 12px;
    --spacing-card: 12px;
  }
}
```

`index.css`-də import et: `@import './styles/responsive.css';`

### 1.2 useMediaQuery Hook

**Fayl:** `chatapp-frontend/src/hooks/useMediaQuery.js` (yeni fayl)

```js
import { useState, useEffect } from "react";

export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = (e) => setMatches(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [query]);
  return matches;
}

export function useIsMobile() { return useMediaQuery("(max-width: 767px)"); }
export function useIsTablet() { return useMediaQuery("(min-width: 768px) and (max-width: 1023px)"); }
export function useIsDesktop() { return useMediaQuery("(min-width: 1024px)"); }
```

---

## Faza 2: Chat Səhifəsi

### 2.1 Mobile Single Panel Navigation

**Fayl:** `chatapp-frontend/src/pages/Chat.jsx` + `Chat.css`

Mobile-da (< 768px) 3 panel əvəzinə 1 panel göstər — navigation state ilə:

**JSX dəyişiklik (Chat.jsx):**

```jsx
const isMobile = useIsMobile();
const [mobilePanel, setMobilePanel] = useState("conversations"); // "conversations" | "chat" | "details"

// Conversation seçildikdə:
const handleSelectChat = (chat) => {
  // ... mövcud logic ...
  if (isMobile) setMobilePanel("chat");
};

// Back button:
const handleMobileBack = () => {
  if (mobilePanel === "details") setMobilePanel("chat");
  else if (mobilePanel === "chat") setMobilePanel("conversations");
};

// Detail sidebar açıldıqda:
const handleOpenDetails = () => {
  if (isMobile) setMobilePanel("details");
  else setShowDetailSidebar(true);
};
```

**CSS dəyişiklik (Chat.css):**

```css
@media (max-width: 767px) {
  .sidebar { display: none; }

  .conversation-panel {
    width: 100%; min-width: unset;
    display: none; /* default gizli */
  }
  .conversation-panel.mobile-active { display: flex; }

  .chat-panel {
    width: 100%;
    display: none;
  }
  .chat-panel.mobile-active { display: flex; }

  .detail-sidebar-panel {
    width: 100%; min-width: unset;
    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
    z-index: 100;
    display: none;
  }
  .detail-sidebar-panel.mobile-active { display: flex; }

  /* Chat header-da back button */
  .mobile-back-btn {
    width: 36px; height: 36px;
    display: flex; align-items: center; justify-content: center;
    background: none; border: none; color: inherit; cursor: pointer;
  }
}

@media (min-width: 768px) {
  .mobile-back-btn { display: none; }
}
```

### 2.2 Bottom Tab Bar (Sidebar əvəzi)

Mobile-da sidebar gizlənir. Əvəzinə bottom tab bar göstər:

```jsx
{isMobile && mobilePanel === "conversations" && (
  <nav className="mobile-bottom-tabs">
    <button className="tab active">Chats</button>
    <button className="tab" onClick={() => navigate("/admin")}>Admin</button>
    <button className="tab" onClick={openProfile}>Profile</button>
  </nav>
)}
```

```css
.mobile-bottom-tabs {
  position: fixed; bottom: 0; left: 0; right: 0;
  height: 56px;
  padding-bottom: env(safe-area-inset-bottom);
  background: var(--bg-primary);
  border-top: 1px solid var(--border-color);
  display: flex; align-items: center; justify-content: space-around;
  z-index: 90;
}
```

### 2.3 ConversationList Mobile Adjustments

```css
@media (max-width: 767px) {
  .conversation-panel {
    width: 100%;
    min-width: unset;
  }
  .conv-search-input { width: 100%; }
  .conv-filter-dropdown { min-width: 140px; }
}
```

### 2.4 DetailSidebar Mobile

```css
@media (max-width: 767px) {
  .detail-sidebar {
    width: 100%; min-width: unset;
    height: 100vh;
    position: fixed; top: 0; left: 0;
    z-index: 100;
  }
}

@media (min-width: 768px) and (max-width: 1023px) {
  .detail-sidebar {
    width: min(90vw, 350px);
    position: fixed; right: 0; top: 0; bottom: 0;
    z-index: 50;
    box-shadow: -4px 0 20px rgba(0,0,0,0.15);
  }
  .detail-sidebar-backdrop {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.4);
    z-index: 49;
  }
}
```

---

## Faza 3: Admin Səhifələri

### 3.1 AdminPanel — Hamburger Menu

**Fayl:** `AdminPanel.jsx` + `AdminPanel.css`

```css
@media (max-width: 767px) {
  .ap-nav {
    position: fixed; left: 0; top: 0; bottom: 0;
    width: 260px;
    transform: translateX(-100%);
    transition: transform 250ms ease;
    z-index: 100;
    background: var(--bg-primary);
    box-shadow: 4px 0 20px rgba(0,0,0,0.15);
  }
  .ap-nav.open { transform: translateX(0); }
  .ap-nav-backdrop {
    position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 99;
  }
  .ap-content { width: 100%; }
  .ap-header .hamburger-btn { display: flex; }
}

@media (min-width: 768px) {
  .ap-header .hamburger-btn { display: none; }
}

@media (min-width: 768px) and (max-width: 1023px) {
  .ap-nav { width: 180px; }
}
```

### 3.2 Admin Detail Drawers — Full Screen on Mobile

Bütün admin komponentlərindəki drawer-lar (380-440px) mobil-da tam ekran olmalıdır:

```css
/* admin-shared.css-ə əlavə et */
@media (max-width: 767px) {
  .admin-drawer,
  .hi-detail-panel,
  .hi-create-panel,
  .dm-detail-panel,
  .dm-create-panel,
  .cm-detail-panel,
  .pm-detail-panel {
    width: 100% !important;
    min-width: unset !important;
    max-width: 100% !important;
    height: 100vh;
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    z-index: 100;
  }
}

@media (min-width: 768px) and (max-width: 1023px) {
  .admin-drawer,
  .hi-detail-panel,
  .hi-create-panel,
  .dm-detail-panel,
  .dm-create-panel,
  .cm-detail-panel,
  .pm-detail-panel {
    width: min(90vw, 440px) !important;
    min-width: unset !important;
  }
}
```

### 3.3 UserDetailPage — Stacked Layout

```css
@media (max-width: 767px) {
  .ud-root { max-width: 100%; padding: 12px; }
  .ud-hero { flex-direction: column; text-align: center; padding: 20px 16px; }
  .ud-hero-actions { margin-left: 0; justify-content: center; flex-wrap: wrap; }
  .ud-overview-grid { grid-template-columns: 1fr; }
  .ud-info-row { flex-direction: column; gap: 2px; }
  .ud-info-label { width: auto; }
  .ud-edit-row { flex-direction: column; }
  .ud-stats-row { grid-template-columns: repeat(2, 1fr); }
  .ud-content-grid { grid-template-columns: 1fr; }
}
```

### 3.4 HierarchyView — Mobile Adjustments

```css
@media (max-width: 767px) {
  .hi-search-input { width: 100%; }
  .hi-stats-row { grid-template-columns: repeat(2, 1fr); }
  .hi-user-actions { flex-wrap: wrap; }
}
```

---

## Faza 4: Shared Components

### 4.1 Toast Notifications

```css
@media (max-width: 374px) {
  .toast {
    min-width: unset;
    width: calc(100vw - 24px);
    left: 12px; right: 12px;
  }
}
```

### 4.2 Modal/Dialog

```css
@media (max-width: 767px) {
  .modal-content,
  .dialog-content {
    width: calc(100vw - 24px) !important;
    max-width: unset !important;
    max-height: 90vh;
  }
}
```

### 4.3 Context Menu / Dropdown

```css
@media (max-width: 767px) {
  .context-menu,
  .dropdown-menu {
    min-width: unset;
    width: calc(100vw - 24px);
    left: 12px !important; right: 12px !important;
    position: fixed !important;
    bottom: 12px !important; top: auto !important;
  }
}
```

---

## Faza 5: Çatışmayan Komponentlər

### 5.1 UserProfilePanel

Profil paneli (sağdan slide-in, ~380px). Mobile-da tam ekran overlay olmalıdır:

- Mobile: `width: 100%; height: 100vh; position: fixed;`
- Tablet: `width: min(90vw, 380px);`
- Desktop: mövcud davranış

### 5.2 FilePreviewPanel (fayl upload preview)

Upload öncəsi preview panel. Mobile-da tam ekran olmalıdır, send button aşağıda.

### 5.3 ImageViewer

Şəkil böyütmə. Mobile-da tam ekran + pinch-to-zoom + swipe to dismiss.

### 5.4 CompanyManagement

- Mobile: table → card list layout, detail drawer → tam ekran
- Tablet: detail drawer → `width: min(90vw, 380px)`

### 5.5 DepartmentManagement

- Mobile: tree sidebar (200px) → tam genişlik accordion, detail drawer → tam ekran
- Tablet: tree sidebar kiçildilmiş, drawer → `width: min(90vw, 400px)`

### 5.6 PositionManagement

- Mobile: filter sidebar (220px) → dropdown, detail drawer → tam ekran
- Tablet: drawer → `width: min(90vw, 420px)`

### 5.7 MessageBubble — Image max-width

Şəkil mesajlarının genişliyi mobilde ekranı aşmamalıdır:

```css
@media (max-width: 767px) {
  .message-bubble img { max-width: calc(100vw - 80px); }
}
```

---

## Faza 6: Hardcoded Width-ləri CSS Variables ilə Əvəz Et

Bütün CSS fayllarında hardcoded `width: Xpx` dəyərlərini CSS variables ilə əvəz et:

| Fayl | Köhnə | Yeni |
|------|-------|------|
| Chat.css | `width: 400px` | `width: var(--conv-list-width)` |
| Chat.css | `width: 350px` | `width: var(--detail-sidebar-width)` |
| AdminPanel.css | `width: 216px` | `width: var(--admin-sidebar-width)` |
| HierarchyView.css | `width: 300px` | `width: 100%` (search input) |
| Drawer widths | `width: 380-440px` | `width: min(90vw, 440px)` |

---

## Faza 6: Test

Hər faza tamamlandıqdan sonra bu ekran ölçülərində test et:

| Ölçü | Cihaz | Yoxla |
|------|-------|-------|
| 375 × 667 | iPhone SE | Conversations, Chat, Admin |
| 390 × 844 | iPhone 12 | Conversations, Chat, Admin |
| 768 × 1024 | iPad Mini | 2-panel layout, drawers |
| 1024 × 768 | iPad Air landscape | 3-panel layout |
| 1440 × 900 | Desktop | Mövcud layout sınmamalıdır |

**Chrome DevTools → Device Toolbar istifadə et.**

---

## Yoxlama Siyahısı

### Foundation:
- [ ] `responsive.css` yaradılıb və import olunub
- [ ] `useMediaQuery` hook yaradılıb
- [ ] CSS variables bütün hardcoded width-ləri əvəz edib

### Chat:
- [ ] Mobile: single panel navigation işləyir
- [ ] Mobile: back button chat-dan conversations-a qayıdır
- [ ] Mobile: detail sidebar tam ekran overlay-dir
- [ ] Tablet: 2-panel layout (conversation + chat)
- [ ] Desktop: mövcud layout sınmayıb

### Admin:
- [ ] Mobile: hamburger menu + slide-in sidebar
- [ ] Mobile: bütün drawers tam ekran
- [ ] Mobile: UserDetailPage stacked layout
- [ ] Mobile: HierarchyView search tam genişlik
- [ ] Tablet: sidebar kiçildilmiş (180px)
- [ ] Desktop: mövcud layout sınmayıb

### Shared:
- [ ] Toast: kiçik ekranlarda overflow yoxdur
- [ ] Modal: mobile-da tam genişlik
- [ ] Dropdown: mobile-da bottom-sheet style
- [ ] Touch targets: minimum 44px

---

## Qeydlər

- UI/UX tapşırığını (`2026-03-30_1000_mobile-responsive-uiux.md`) əvvəlcə oxu
- Desktop-first override yanaşması: mövcud CSS-ə toxunma, `@media (max-width)` ilə mobil uyğunlaşdır
- `!important` yalnız drawer/panel override-larda istifadə et — digər yerlərdə istifadə etmə
- iPhone safe area: `env(safe-area-inset-bottom)` istifadə et bottom tab bar-da
- Gələcək komponentlər: `width: min(90vw, Xpx)` pattern istifadə et hardcoded px əvəzinə
- **Test et, test et, test et.** Hər fazadan sonra Chrome DevTools ilə yoxla.
