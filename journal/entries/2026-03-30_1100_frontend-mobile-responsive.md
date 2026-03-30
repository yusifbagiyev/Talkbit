# Frontend Task: Mobile Responsive Implementation

**From**: UI/UX Developer
**To**: Frontend Developer
**Date**: 2026-03-30
**Priority**: P0 — CRITICAL
**Spec**: `agents/uiux-developer/outputs/2026-03-30_wireframe_mobile-responsive.md`

---

## Xülasə

Bütün komponentlər 3 breakpoint-də düzgün işləməlidir: mobile (<768px), tablet (768–1023px), desktop (≥1024px). Mövcud desktop CSS-ə toxunulmur — `@media (max-width)` ilə hər CSS faylının sonuna responsive override əlavə olunur.

**DİQQƏT:** Spec-dəki CSS class adları mövcud koda əsaslanır — amma hər halda real class adlarını fayldan oxu və yoxla.

---

## Tapşırıqlar (sıra ilə)

### 1. Chat Səhifəsi — Mobile Navigation (ən böyük dəyişiklik)

**Fayl:** `Chat.jsx`, `Chat.css`

**State əlavə et:**
```jsx
const [mobileView, setMobileView] = useState('conversations');
// 'conversations' | 'chat' | 'detail'
```

**Davranış:**
- Default: yalnız `ConversationList` görünür (tam ekran)
- Conversation click → `setMobileView('chat')` → ChatPanel slide-in (translateX)
- Back button (chat header-ə əlavə et) → `setMobileView('conversations')`
- Info button → `setMobileView('detail')`

**CSS:** `Chat.css`-in sonuna `@media (max-width: 767px)` bölməsi əlavə et:
- `.conversation-panel`: `width: 100%`, `position: absolute`, `inset: 0`
- `.chat-panel`: `position: absolute`, `inset: 0`, `transform: translateX(100%)` → `.visible-mobile { translateX(0) }`
- `transition: transform 250ms cubic-bezier(0.4, 0, 0.2, 1)`

**Back button:** `ChatHeader.jsx`-ə mobile-only `[←]` button əlavə et:
```jsx
{isMobile && (
  <button className="mobile-back-btn" onClick={onBack}>
    <svg>...</svg>
  </button>
)}
```

`isMobile` detection: `window.innerWidth < 768` — `useEffect` + `resize` listener ilə.

---

### 2. Sidebar → Bottom Tab Bar

**Fayl:** `Sidebar.jsx`, `Sidebar.css`

Mobile (<768px):
- `flex-direction: row`, `height: 52px`, `order: 2` (altda)
- Logo gizlənir, `sidebar-bottom` gizlənir
- 4 əsas icon: Chat, Calls (gələcək), Contacts, Settings
- `padding-bottom: env(safe-area-inset-bottom)` — iPhone home indicator

---

### 3. Admin Nav → Hamburger Drawer

**Fayl:** `AdminPanel.jsx`, `AdminPanel.css`

Mobile (<768px):
- `ap-nav`: `position: fixed`, `transform: translateX(-100%)`, `width: 260px`
- `.ap-nav.open { transform: translateX(0) }`
- Hamburger button: `ap-header`-ə əlavə et (yalnız mobile-da göstər)
- Backdrop: `.ap-nav-backdrop` — click outside → close
- State: `const [navOpen, setNavOpen] = useState(false)`

---

### 4. UserDetailPage — Grid Collapse

**Fayl:** `UserDetailPage.jsx`, `UserDetailPage.css`

Tablet (≤1023px):
- `.ud-content-grid`: `grid-template-columns: 1fr` (right column aşağı düşür)
- `.ud-stats-row`: `repeat(2, 1fr)` (4→2x2)

Mobile (≤767px):
- Hero: `flex-direction: column`, avatar `60px`, name `18px`
- Hero actions: `width: 100%`, `justify-content: flex-end`
- Info rows: `flex-direction: column` (label + value stacked)
- Edit grid: `1fr` (2-column → 1-column)
- Permission grid: `1fr`

---

### 5. HierarchyView — Toolbar + Tree Collapse

**Fayl:** `HierarchyView.jsx`, `HierarchyView.css`

Mobile (≤767px):
- Toolbar: `flex-direction: column`, search `width: 100%`
- Toolbar actions: tam genişlik, hər button `flex: 1`
- Stats: `grid 1fr 1fr` (2x2)
- `.hi-dept-head-sub`, `.hi-user-position`: `display: none`
- `.hi-actions`: `opacity: 1` (həmişə görünür — touch üçün)
- Action buttons: `32px` (28→32, touch-friendly)
- Detail panel: `width: 100%`

---

### 6. Company/Dept/Position Panels → Tam Ekran

**Fayllar:** `CompanyManagement.css`, `DepartmentManagement.css`, `PositionManagement.css`

Mobile (≤767px):
- Bütün form/detail panel-lər: `width: 100%; height: 100dvh; border-radius: 0`
- Toolbar-lar: `flex-direction: column`, search `width: 100%`
- Row actions: `opacity: 1` (touch üçün həmişə görünür)

Tablet (≤1023px):
- Panel-lər: `width: min(90vw, 420px)`

---

### 7. UserProfilePanel → Tam Ekran

**Fayl:** `UserProfilePanel.jsx`, `UserProfilePanel.css`

Mobile (≤767px):
- `width: 100%`, `height: 100dvh`, `top: 0`, `border-radius: 0`
- Avatar: `120px` (240→120)
- Close button: `position: absolute`, `top: 12px`, `right: 12px`
- Tab bar: `overflow-x: auto`, scrollbar gizlə

---

### 8. Emoji Picker → Bottom Sheet

**Fayl:** `ChatInputArea.css`

Mobile (≤767px):
- `position: fixed`, `bottom: 0`, `width: 100%`, `height: 50vh`
- `border-radius: 16px 16px 0 0`

---

### 9. Input Optimization

**Fayl:** `ChatInputArea.css`

Mobile (≤767px):
- `font-size: 16px` (iOS zoom prevention)
- `min-height: 52px` (71→52, ekran yeri qazanmaq)

---

### 10. Shared Touch Rules

**Fayl:** `admin-shared.css`

```css
@media (max-width: 767px) {
  input, textarea, select { font-size: 16px; }
}
```

---

## `100vh` → `100dvh`

Mobile browser-lərdə `100vh` address bar-ı nəzərə almır. Bütün `height: 100vh` olan yerlərdə:
```css
height: 100vh;
height: 100dvh;   /* fallback + override */
```

---

## İmplementasiya Qaydaları

1. Desktop CSS-ə **toxunma** — yalnız `@media` əlavə et
2. Hər CSS faylının sonuna `/* ─── Responsive ─── */` comment ilə
3. `opacity: 0` action buttons → mobile-da `opacity: 1` (touch)
4. Panel `width` → mobile-da `100%`, tablet-da `min(90vw, original)`
5. Toolbar `flex-direction: row` → mobile-da `column`
6. Grid columns → mobile-da `1fr`, tablet-da `repeat(2, 1fr)`
7. `100vh` → `100dvh` fallback pattern
8. Input `font-size: 16px` — iOS zoom prevention
