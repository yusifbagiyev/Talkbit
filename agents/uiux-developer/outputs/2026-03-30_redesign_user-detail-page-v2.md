# User Detail Page — Full Redesign v2

**Date:** 2026-03-30
**Agent:** UI/UX Developer
**Type:** Wireframe + Interaction Design
**Scope:** `/admin/users/:id` — single-page dashboard layout (no tabs)

---

## Design Philosophy

Tab sistemi ləğv olunur. Bütün məlumatlar **bir səhifədə**, **dashboard stilində** göstərilir.
Təkrarlanan field-lər birləşdirilir. Vizual hierarchiya gücləndirilir. Hər section öz məqsədini dərhal ifadə edir.

---

## Layout Structure

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  PROFILE HEADER (immersive dark)                                           │
│  ┌────────┐  Name ─────────── Position ──── Department                     │
│  │ Avatar │  Role Badge ─── Status Badge (online dot pulsing)              │
│  │  80px  │  Email ──── Phone                                              │
│  └────────┘                          [Reset Password] [Deactivate] [Delete]│
└──────────────────────────────────────────────────────────────────────────────┘

┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│  STORAGE    │ │  ACTIVITY   │ │  ACCOUNT    │ │  SECURITY   │
│  12.4 MB    │ │  Online     │ │  Created    │ │  Password   │
│  ▓▓▓░░ 23% │ │  last: 2m   │ │  342 days   │ │  Changed    │
│  47 files   │ │  ago        │ │  ago        │ │  14 days ago│
└─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘

┌─────────────────────────────────────────┐ ┌──────────────────────────────┐
│  PERSONAL DETAILS                  [Edit]│ │  STORAGE BREAKDOWN          │
│                                          │ │                              │
│  Full Name    Baxtiyar Cabrayilov        │ │   ┌──────────────────┐      │
│  Email        baxtiyar@chatapp.com       │ │   │  Donut Chart     │      │
│  Phone        +994500000060              │ │   │  (SVG ring)      │      │
│  Birth Date   1 May 1990                 │ │   │  12.4 MB center  │      │
│  About        Financial Analyst...       │ │   └──────────────────┘      │
│  Hired        30 Mar 2025                │ │                              │
│                                          │ │  ● Images      8   3.2 MB   │
│                                          │ │  ● Documents  31  7.8 MB    │
│                                          │ │  ● Other       8   1.4 MB   │
└──────────────────────────────────────────┘ └──────────────────────────────┘

┌─────────────────────────────────────────┐ ┌──────────────────────────────┐
│  ORGANIZATION                            │ │  SECURITY & ACCESS          │
│                                          │ │                              │
│  Department   Finance      [Change →]    │ │  Last Login   2 min ago     │
│  Position     Financial Analyst          │ │  Pwd Changed  14 days ago   │
│               ──────────────────         │ │  Status       ● Active      │
│  SUPERVISORS                     [+ Add] │ │                              │
│  ┌──┐ Elvin Mammadov                     │ │  [Reset Password →]         │
│  └──┘ CTO                        ✕      │ │  [Deactivate Account →]     │
│  ┌──┐ Nadir Hasanov                      │ │                              │
│  └──┘ Team Lead                   ✕      │ │  ─────────────────────────  │
│               ──────────────────         │ │  ACTIVITY LOGS              │
│  SUBORDINATES                            │ │  Coming soon                │
│  ┌──┐ Kamran Aliyev                      │ │                              │
│  └──┘ Junior Developer                   │ │                              │
└──────────────────────────────────────────┘ └──────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│  PERMISSIONS                                                                │
│  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐            │
│  │ Users            │ │ Channels         │ │ Files            │            │
│  │ Create  ●────    │ │ Create  ────●    │ │ Upload  ●────    │            │
│  │ Read    ●────    │ │ Read    ●────    │ │ Read    ●────    │            │
│  │ Update  ────●    │ │ Update  ●────    │ │ Delete  ────●    │            │
│  │ Delete  ────●    │ │ Delete  ────●    │ │                  │            │
│  └──────────────────┘ └──────────────────┘ └──────────────────┘            │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Section 1: Profile Header

**Yenilik:** Hero-ya email + phone əlavə olunur, Employment card-dan Position buraya keçir (təkrarlanma yox).

```css
.ud-hero {
  background: linear-gradient(135deg, #1a2332 0%, #243447 50%, #1e3a5f 100%);
  border-radius: 14px;
  padding: 32px 36px;
  position: relative;
  overflow: hidden;
}

/* Subtle geometric pattern overlay — human touch */
.ud-hero::before {
  content: '';
  position: absolute;
  top: 0; right: 0;
  width: 300px; height: 100%;
  background: radial-gradient(circle at 80% 20%, rgba(47,198,246,0.06) 0%, transparent 60%),
              radial-gradient(circle at 60% 80%, rgba(47,198,246,0.03) 0%, transparent 40%);
  pointer-events: none;
}
```

**Layout (flexbox):**
- Sol: Avatar (80px) + subtle ring (`3px solid rgba(255,255,255,0.12)`)
- Orta: Name (22px/600) → Position + Department (14px, `rgba(255,255,255,0.55)`) → Badges → Contact row
- Sag: Action buttons (vertically stacked yerinə horizontal, hero-nun sağ tərəfi)

**Contact Row (yeni):**
```
📧 baxtiyar@chatapp.com  ·  📱 +994500000060
```
- Font: 12px, color: `rgba(255,255,255,0.45)`
- SVG icon-lar: 12px, `rgba(255,255,255,0.35)`
- Separator: `·` with `margin: 0 8px`
- **Bu email/phone hero-ya keçdiyinə görə Personal Details-dən ÇIXARILMIR** — personal details-də edit olunmalı field olaraq qalır, hero-da yalnız read-only göstərilir

**Badge dizaynı (mövcud + kiçik təkmilləşdirmə):**
- Role badge: mövcud rənglərlə (SuperAdmin amber, Admin cyan, User neutral)
- Status badge: online olduqda `status-online` class-ı ilə canlı yaşıl pulsing dot

**Action buttons:**
- Mövcud 3 button: Reset Password, Deactivate/Activate, Delete
- Dizayn: mövcud `ud-btn-outline` və `ud-btn-danger-outline` saxlanılır
- Layout: `flex-wrap: wrap` ilə responsive

---

## Section 2: Stats Row (Dashboard mini cards)

**Tamamilə yeni section.** 4 kart yan-yana, hərəsi müxtəlif metric göstərir.

```
┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│ 📦 STORAGE  │ │ 🟢 STATUS   │ │ 📅 MEMBER   │ │ 🔐 PASSWORD │
│ 12.4 MB     │ │ Online      │ │ SINCE       │ │ CHANGED     │
│ 47 files    │ │ Last: 2m    │ │ 342 days    │ │ 14 days ago │
│ ▓▓░░░ 12%   │ │             │ │ Mar 2025    │ │             │
└─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘
```

**CSS:**
```css
.ud-stats-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
  margin-bottom: 20px;
}

.ud-stat-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 16px 18px;
  position: relative;
  overflow: hidden;
}

/* Sol tərəfdə nazik accent xətti — hər card-ın öz rəngi */
.ud-stat-card::before {
  content: '';
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: 3px;
  border-radius: 10px 0 0 10px;
}

.ud-stat-card.storage::before  { background: #2563eb; }
.ud-stat-card.status::before   { background: #22c55e; }
.ud-stat-card.member::before   { background: #f59e0b; }
.ud-stat-card.security::before { background: #6366f1; }

.ud-stat-label {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: #9ca3af;
  margin-bottom: 6px;
}

.ud-stat-value {
  font-size: 20px;
  font-weight: 700;
  color: #111827;
  line-height: 1.2;
}

.ud-stat-sub {
  font-size: 12px;
  color: #6b7280;
  margin-top: 2px;
}
```

**Card 1 — Storage:**
- Value: `12.4 MB` (bold)
- Sub: `47 files`
- Mini progress bar (6px height, `#2563eb` fill)

**Card 2 — Status:**
- Value: `Online` or `Offline` (color-coded)
- Sub: Online → `Active now` (green), Offline → `Last seen 2 min ago` (gray)
- Pulsing dot animation for online

**Card 3 — Member Since:**
- Value: `342 days` (hesablanmış fərq)
- Sub: `Since Mar 2025` (join date)

**Card 4 — Password:**
- Value: `14 days` (last changed ago)
- Sub: `Last changed` or `Never changed` (warning color if never)

---

## Section 3: Two-Column Content Grid

```css
.ud-content-grid {
  display: grid;
  grid-template-columns: 1fr 340px;
  gap: 16px;
  align-items: start;
}
```

### 3A: Personal Details Card (Sol, birləşdirilmiş)

**Birləşdirilən field-lər:**
- `Full Name` ← Personal Info
- `Email` ← Personal Info
- `Phone` ← Personal Info
- `Date of Birth` ← Personal Info
- `About` ← Personal Info
- `Hired` ← Employment card-dan (Employment card ləğv olunur)

**Sillinən field-lər:**
- `Position` — hero-da göstərilir (edit form-da qalır)
- `Department` — Organization section-da göstərilir
- `Account Created` — Stats row card-da göstərilir
- `Password Changed` — Stats row card-da göstərilir

**Edit mode:** Mövcud inline edit saxlanılır, yalnız yeni field sırası ilə.

**Card dizaynı:**
```css
.ud-detail-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 22px 26px;
}

.ud-detail-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #f3f4f6;
}

.ud-detail-card-title {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
  /* NOT uppercase — daha natural, daha az "AI" hissi */
}

/* Info row-lar arasında alternating subtle bg — oxunabilirliyi artırır */
.ud-info-row:nth-child(even) {
  background: #fafbfc;
  margin: 0 -26px;
  padding: 7px 26px;
}
```

### 3B: Storage Breakdown Card (Sag, yuxarı)

**SVG Donut Chart (human-crafted, no library):**

```jsx
function StorageDonut({ storage }) {
  const total = storage.totalMb || 1;
  const segments = [
    { label: "Images",    count: storage.imageCount,    mb: storage.imageMb,    color: "#2563eb" },
    { label: "Documents", count: storage.documentCount, mb: storage.documentMb, color: "#22c55e" },
    { label: "Other",     count: storage.otherCount,    mb: storage.otherMb,    color: "#94a3b8" },
  ];

  // SVG ring segments
  const radius = 52, stroke = 10, circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="ud-donut-wrap">
      <svg width="140" height="140" viewBox="0 0 140 140">
        <circle cx="70" cy="70" r={radius}
          fill="none" stroke="#f1f5f9" strokeWidth={stroke} />
        {segments.map((seg, i) => {
          const pct = seg.mb / total;
          const dashLen = circumference * pct;
          const dashOff = circumference * offset;
          offset += pct;
          return (
            <circle key={i} cx="70" cy="70" r={radius}
              fill="none" stroke={seg.color} strokeWidth={stroke}
              strokeDasharray={`${dashLen} ${circumference - dashLen}`}
              strokeDashoffset={-dashOff}
              strokeLinecap="round"
              style={{ transition: 'stroke-dasharray 600ms cubic-bezier(0.16,1,0.3,1)' }}
            />
          );
        })}
      </svg>
      <div className="ud-donut-center">
        <span className="ud-donut-value">{storage.totalMb.toFixed(1)}</span>
        <span className="ud-donut-unit">MB</span>
      </div>
    </div>
  );
}
```

**Donut CSS:**
```css
.ud-donut-wrap {
  position: relative;
  display: flex;
  justify-content: center;
  padding: 16px 0;
}

.ud-donut-center {
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
}

.ud-donut-value {
  font-size: 22px;
  font-weight: 700;
  color: #111827;
  display: block;
  line-height: 1;
}

.ud-donut-unit {
  font-size: 11px;
  color: #9ca3af;
  font-weight: 500;
}
```

**Legend (chart altında):**
```css
.ud-storage-legend {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 0 8px;
}

.ud-storage-legend-item {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: #374151;
}

/* Rəng dot */
.ud-storage-legend-dot {
  width: 8px; height: 8px;
  border-radius: 2px; /* Rounded square — donut ilə kontrast, daha interesting */
  flex-shrink: 0;
}

/* Sağ tərəf: count + size */
.ud-storage-legend-meta {
  margin-left: auto;
  display: flex;
  gap: 12px;
  font-size: 12px;
}

.ud-storage-legend-count { color: #6b7280; }
.ud-storage-legend-size  { color: #111827; font-weight: 600; min-width: 52px; text-align: right; }
```

### 3C: Organization Card (Sol, aşağı)

**Department + Supervisors + Subordinates — bir card-da, divider ilə ayrılır.**

```css
.ud-org-section {
  padding: 14px 0;
  border-bottom: 1px solid #f3f4f6;
}

.ud-org-section:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.ud-org-section-title {
  font-size: 11px;
  font-weight: 600;
  color: #9ca3af;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

/* Count badge — supervisor/subordinate sayını göstərir */
.ud-org-count {
  background: #f1f5f9;
  color: #64748b;
  font-size: 10px;
  font-weight: 700;
  padding: 1px 7px;
  border-radius: 10px;
  margin-left: 8px;
}
```

**Department sub-section:**
- Mövcud department row saxlanılır
- Change/Remove button-ları eyni qalır

**Supervisors sub-section:**
- Mövcud supervisor row-lar + add button saxlanılır
- Yenilik: count badge `Supervisors (2)`

**Subordinates sub-section:**
- Mövcud subordinate row-lar saxlanılır
- Yenilik: count badge `Subordinates (3)`

### 3D: Security & Access Card (Sag, aşağı)

**Security tab-dan birləşdirilmiş card:**

```
┌──────────────────────────────────────┐
│  SECURITY & ACCESS                   │
│                                      │
│  Last Login     2 minutes ago        │
│  Pwd Changed    14 days ago          │
│  Account Status ● Active             │
│                                      │
│  ── Actions ──────────────────────── │
│                                      │
│  [🔑 Reset Password →]              │
│  [⏸  Deactivate Account →]          │
│                                      │
│  ── Activity ─────────────────────── │
│  Coming soon                         │
└──────────────────────────────────────┘
```

**Action buttons dizaynı:**
```css
.ud-security-action {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  background: #fff;
  color: #374151;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  width: 100%;
  text-align: left;
  margin-bottom: 8px;
  transition: background 150ms cubic-bezier(0.4, 0, 0.2, 1),
              border-color 150ms cubic-bezier(0.4, 0, 0.2, 1);
}

.ud-security-action:hover {
  background: #f9fafb;
  border-color: #d1d5db;
}

.ud-security-action.danger {
  border-color: rgba(239,68,68,0.2);
  color: #ef4444;
}

.ud-security-action.danger:hover {
  background: rgba(239,68,68,0.04);
  border-color: rgba(239,68,68,0.4);
}

.ud-security-action-icon {
  width: 32px; height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.ud-security-action-icon.key {
  background: rgba(37,99,235,0.08);
  color: #2563eb;
}

.ud-security-action-icon.deactivate {
  background: rgba(239,68,68,0.08);
  color: #ef4444;
}
```

**Reset Password inline form:**
- Mövcud form davranışı saxlanılır
- Sağ card-ın içində açılır, action button-u gizləyərək

---

## Section 4: Permissions (Full-width)

**Yeni layout:** Module card-lar horizontal grid (3 sütun). Mövcud toggle davranışı saxlanılır.

```css
.ud-permissions-section {
  margin-top: 4px;
}

.ud-permissions-title {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #f3f4f6;
}

.ud-perm-modules-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 14px;
}

.ud-perm-module-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 18px 20px;
}

/* Module title — card üst hissəsində, accent rəngli sol border */
.ud-perm-module-card-title {
  font-size: 13px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 14px;
  padding-left: 10px;
  border-left: 3px solid #2fc6f6;
}

/* Permission item-lar daha compact */
.ud-perm-toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 0;
}

.ud-perm-toggle-label {
  font-size: 13px;
  color: #4b5563;
}

/* Granted permissions count badge */
.ud-perm-granted-count {
  font-size: 10px;
  font-weight: 600;
  color: #2563eb;
  background: rgba(37,99,235,0.08);
  padding: 2px 8px;
  border-radius: 10px;
  margin-left: auto;
  margin-right: 8px;
}
```

---

## Interaction States (10/10)

| State | Davranış |
|-------|----------|
| **Default** | Bütün section-lar visible, scroll ilə accessible |
| **Loading** | Skeleton layout: hero placeholder + 4 stat card skeleton + 2x2 card grid skeleton |
| **Empty (no storage)** | Donut chart əvəzinə "No files uploaded" empty state ilə subtle illustration |
| **Editing** | Personal Details card edit mode (inline, mövcud davranış) |
| **Hover** | Cards: `translateY(-1px)` + `box-shadow` artımı (material hover easing) |
| **Error** | Toast notification (mövcud ToastContext istifadə olunur) |
| **Online** | Status stat card: green accent, pulsing dot |
| **Offline** | Status stat card: gray accent, "Last seen X ago" |
| **Saving** | Button disabled + "Saving..." text, spinner yoxdur (minimalist) |
| **Delete confirm** | Mövcud modal saxlanılır, üstdən smooth fade-in |

---

## Animation Standards

```css
/* Card hover — human touch */
.ud-detail-card:hover,
.ud-stat-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.06);
  transition: transform 200ms cubic-bezier(0.4, 0, 0.2, 1),
              box-shadow 200ms cubic-bezier(0.4, 0, 0.2, 1);
}

/* Stats counter animation — yüklənəndə 0-dan artır */
@keyframes ud-count-up {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}

.ud-stat-value {
  animation: ud-count-up 400ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

/* Donut segments — rotation ilə gəlir */
.ud-donut-wrap svg {
  transform: rotate(-90deg); /* 12 o'clock start */
}

/* FORBIDDEN: ease, ease-in-out, linear */
```

---

## Anti-AI Checklist

- [x] Purple (#8b5cf6, #7c3aed) **istifadə olunmayıb**
- [x] SuperAdmin: amber tones, Admin: cyan tones, User: neutral
- [x] Uppercase title YALNIZ section label-larda (STORAGE, PERSONAL DETAILS)
- [x] Card title-lar sentence case (natural, human feel)
- [x] Alternating row backgrounds (əl ilə dizayn edilmiş hissi)
- [x] SVG donut chart (no library dependency)
- [x] Geometric gradient overlay (unique, not template)
- [x] Rounded-square legend dots (donut circles ilə kontrast)
- [x] Left accent borders (inconsistent widths: 3px stat cards, 3px perm modules — intentional variety)
- [x] NO gradient buttons, NO shadow-heavy cards, NO glassmorphism

---

## Data Consolidation Map

| Field | Köhnə yer | Yeni yer | Qeyd |
|-------|-----------|----------|------|
| Full Name | Hero + Personal Info | Hero (display) + Personal Details (edit) | |
| Position | Hero + Employment card | Hero only (edit form-da) | Employment card ləğv |
| Department | Employment + Organization tab | Organization section | Employment card ləğv |
| Account Created | Employment card | Stats Row "Member Since" card | |
| Password Changed | Employment + Security tab | Stats Row "Password" card + Security card | |
| Last Login | Security tab | Stats Row "Status" card + Security card | |
| Account Status | Hero badge + Security tab | Hero badge + Security card | Hero-da badge, Security-də action |
| Email | Personal Info | Hero (read-only) + Personal Details (edit) | |
| Phone | Personal Info | Hero (read-only) + Personal Details (edit) | |

---

## Removed Components

1. **Tab sistemi** — tamamilə ləğv
2. **Employment card** — field-ləri Personal Details-ə və Hero-ya paylaşdırıldı
3. **Ayrıca Session card** (Security tab) — Security & Access card-a birləşdi
4. **Ayrıca Account Status card** (Security tab) — Security & Access card-a birləşdi
5. **Storage simple bar** — Donut chart ilə əvəzləndi

---

## CSS Class Naming

- Mövcud `ud-` prefix saxlanılır
- Yeni class-lar: `ud-stats-row`, `ud-stat-card`, `ud-donut-*`, `ud-detail-card`, `ud-org-*`, `ud-security-action`
- Silinən class-lar: `ud-tabs`, `ud-tab`, `ud-overview-grid` (tab sistemi ləğv)

---

## Handoff Notes for Frontend Developer

1. **Tab state ləğv olunur** — `activeTab` state-i çıxarılır, bütün content birbaşa render
2. **Storage API** — donut chart üçün `imageMb`, `documentMb`, `otherMb` field-ləri lazım ola bilər (əgər backend-dən gəlmirsə, `totalMb`-dən hesablanmalı)
3. **Stats row** — `formatRelativeTime` helper yenidən istifadə olunur
4. **Member since** — `createdAtUtc`-dən gün fərqi hesablanır: `Math.floor((Date.now() - new Date(date)) / 86400000)`
5. **SVG Donut** — library lazım deyil, yuxarıdakı React component kopyalanıb istifadə oluna bilər
6. **Scroll behavior** — tek page olduğu üçün `scroll-behavior: smooth` əlavə olunmalı
7. **Permissions section** — `hasPermission("Permissions.Read")` yoxlanışı saxlanılır, false olduqda tamamilə gizlənir
