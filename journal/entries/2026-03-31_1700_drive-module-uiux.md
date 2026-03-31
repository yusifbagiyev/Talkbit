# UI/UX Task: Employee Drive — Dizayn Specification

**From**: Product Owner
**To**: UI/UX Developer
**Date**: 2026-03-31
**Priority**: P1
**Referans**: Bitrix24 "My Drive" screenshot-ları

---

## Xülasə

Hər istifadəçi üçün şəxsi fayl saxlama sistemi — "My Drive". Bitrix24-ün Drive dizaynı referans olaraq istifadə olunmalıdır. Fayllar tam private-dir, heç kəs başqasının fayllarını görə bilməz. Limit: 3GB per user.

---

## 1. Səhifə Layout

Top navbar-da "Drive" butonu klikləndikdə bu səhifə açılır.

**Bitrix24 referans (root view):**
- Background: tünd mavi kosmik gradient (Bitrix24 dark theme) — bizdə açıq boz background olacaq
- Header: "My Drive" başlıq (bold, ağ/qara) + "+ Add" yaşıl buton + search input + "Recycle Bin" butonu + settings icon
- Breadcrumb: "My Drive" (root-da tək element)
- Sağda: "Files deleted to the Recycle Bin are kept for 30 days" info + sort dropdown + view toggle (3 buton: list, medium grid, large grid)
- Folder card-lar: böyük (240x200px), açıq mavi folder icon, aşağıda ad, sol yuxarıda hamburger/drag handle
- Folder-lərin fərqli icon-ları var: standart folder, shared folder (adam iconlu)

```
┌─────────────────────────────────────────────────────────────────────┐
│  My Drive    [+ Add ▾]    [Filter and search____🔍]    [Recycle Bin ⚙] │
├─────────────────────────────────────────────────────────────────────┤
│  My Drive                          Files deleted ... 30 days        │
│                                    [By date changed ▾] [≡] [⊞] [⊟] │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                         │
│  │  ≡       │  │  ≡       │  │  ≡       │                         │
│  │  📁      │  │  📁      │  │  📁 👥   │                         │
│  │          │  │          │  │          │                         │
│  │Stored    │  │Uploaded  │  │ozsut     │                         │
│  │files     │  │files     │  │inter   🔗│                         │
│  └──────────┘  └──────────┘  └──────────┘                         │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Header Bar

### Sol tərəf
- **"My Drive"** başlıq — bold, 20-22px
- **"+ Add" butonu** — primary color (yaşıl/mavi), dropdown:
  - Upload file(s)
  - Upload folder
  - Create folder

### Sağ tərəf
- **Search input** — "Filter and search" placeholder, 250-300px
- **Recycle Bin butonu** — outline/secondary style
- **Settings icon** (⚙) — storage quota göstərmə

---

## 3. Toolbar Bar (Breadcrumb + Sort + View)

### Sol tərəf — Breadcrumb
```
My Drive > Documents > Reports
```
- Hər element klikləməli (o folder-ə qayıdır)
- Separator: `>` və ya `/`
- Aktiv folder bold

### Sağ tərəf
- **Info mesajı**: "Files deleted to the Recycle Bin are kept for 30 days" — subtle, muted text
- **Sort dropdown**: By date changed, By name, By size, By type
- **View toggle**: 3 buton — List [≡], Medium Grid [⊞], Large Grid [⊟]

---

## 4. File/Folder Grid View (Default)

Bitrix24 referansına əsasən:

### Folder Card
```
┌────────────────┐
│  ≡             │  ← drag handle (yuxarı sol)
│                │
│  📁            │  ← folder icon, böyük (48-64px)
│                │
│  Folder Name   │  ← 13px, truncate if long
│  4 items       │  ← muted, 11px
└────────────────┘
```

### Image File Card
```
┌────────────────┐
│  ≡             │  ← drag handle
│                │
│  [thumbnail]   │  ← şəklin kiçildilmiş preview-u
│                │
│  _MG_2588.JPG  │  ← fayl adı, 13px, truncate
└────────────────┘
```

### Document/Other File Card
```
┌────────────────┐
│  ≡             │  ← drag handle
│                │
│  📄 DOC        │  ← fayl tip icon-u (PDF, DOC, XLS, ZIP...)
│                │
│  report.pdf    │  ← fayl adı
│  2.3 MB        │  ← fayl ölçüsü, muted
└────────────────┘
```

### Card Ölçüləri
- **Large Grid**: 200x220px cards, 6 per row
- **Medium Grid**: 150x170px cards, 8 per row
- **Gap**: 12-16px

### Card States
- **Default**: white background, subtle border, border-radius: 8px
- **Hover**: açıq mavi background (`rgba(0,120,255,0.05)`), border-color dəyişir
- **Selected**: açıq mavi background (`rgba(0,120,255,0.1)`), border: 2px solid accent
- **Multi-select**: checkbox görünür (yuxarı sol)

---

## 5. List View

```
┌────────────────────────────────────────────────────────────────┐
│ ☐ │ 📁 │ Documents              │ —        │ Mar 28, 2026     │
│ ☐ │ 📁 │ Photos                 │ —        │ Mar 25, 2026     │
│ ☐ │ 🖼️ │ _MG_2588.JPG           │ 3.2 MB   │ Mar 30, 2026     │
│ ☐ │ 📄 │ report_q1.pdf          │ 1.8 MB   │ Mar 29, 2026     │
│ ☐ │ 📊 │ sales_data.xlsx        │ 456 KB   │ Mar 27, 2026     │
└────────────────────────────────────────────────────────────────┘
  ^     ^        ^                    ^            ^
  CB   Icon    Name                  Size         Modified
```

- Row height: 44-48px
- Hover: background dəyişir
- Sort: column header klikləmə ilə (asc/desc toggle)

---

## 6. Selection Action Toolbar

Fayl seçiləndə header-ın altında toolbar görünür (Bitrix24 kimi):

```
┌─────────────────────────────────────────────────────────────────────┐
│  Selected: 3   📋DETAILS  ⬇DOWNLOAD  ✏RENAME  📂MOVE  🗑DELETE   ✕ │
└─────────────────────────────────────────────────────────────────────┘
```

### MVP Action-lar
| Action | Tək fayl | Multi-select | Qeyd |
|--------|----------|-------------|------|
| Details | ✅ | ❌ | Sağ panel açılır |
| Download | ✅ | ✅ | Multi: ZIP olaraq |
| Rename | ✅ | ❌ | Inline edit |
| Move | ✅ | ✅ | Folder seçmə dialog |
| Delete | ✅ | ✅ | Recycle Bin-ə göndərir |

### Gələcək Action-lar (post-MVP)
- Share, Copy, Revision History

---

## 7. Right-Click Context Menu

Fayl/folder üzərində sağ klik:

```
┌──────────────────┐
│ 📋 Details       │
│ ⬇ Download       │
│ ✏ Rename         │
│ 📂 Move to...    │
│ ────────────     │
│ 🗑 Delete        │
└──────────────────┘
```

- Divider ilə destructive action-lar ayrılır
- Delete qırmızı rəngdə

---

## 8. Details Panel (Sağ tərəfdən slide-in)

Bitrix24 "DETAILS" klikləndikdə sağdan panel açılır:

```
┌─────────────────────────┐
│  ✕  File Details        │
├─────────────────────────┤
│                         │
│  [Preview/Thumbnail]    │
│                         │
│  Name: report.pdf       │
│  Type: PDF Document     │
│  Size: 2.3 MB           │
│  Created: Mar 30, 2026  │
│  Modified: Mar 31, 2026 │
│                         │
│  [Download]  [Delete]   │
└─────────────────────────┘
```

- Width: 350-380px
- Slide-in animation: sağdan
- Şəkillər üçün böyük preview
- Sənədlər üçün icon + metadata

---

## 9. Storage Quota Indicator

Header-da və ya settings-də:

```
┌───────────────────────────────────┐
│  Storage: 1.2 GB / 3.0 GB used   │
│  [████████░░░░░░░░░░░] 40%       │
└───────────────────────────────────┘
```

- Progress bar: yaşıl (0-70%), sarı (70-90%), qırmızı (90-100%)
- Tooltip: "1.2 GB of 3.0 GB used"
- 90%+ olanda warning mesajı

---

## 10. Recycle Bin Səhifəsi

Ayrıca view — "Recycle Bin" butonu klikləndikdə:

```
┌─────────────────────────────────────────────────────────────────────┐
│  🗑 Recycle Bin    [Empty Recycle Bin]              [← Back to Drive] │
├─────────────────────────────────────────────────────────────────────┤
│  Files deleted to the Recycle Bin are kept for 30 days              │
├─────────────────────────────────────────────────────────────────────┤
│ ☐ │ 🖼️ │ old_photo.jpg    │ 1.2 MB │ Deleted: Mar 28 │ [↩ Restore] │
│ ☐ │ 📄 │ draft.docx       │ 456 KB │ Deleted: Mar 25 │ [↩ Restore] │
└─────────────────────────────────────────────────────────────────────┘
```

- List view only
- "Restore" butonu hər fayl üçün
- "Empty Recycle Bin" — bütün faylları birdəfəlik silir (permanent)
- 30 gündən köhnə fayllar avtomatik silinir

---

## 11. Empty States

### Boş Drive
```
┌─────────────────────────┐
│                         │
│    📁                   │
│    Your drive is empty  │
│                         │
│    [+ Upload files]     │
│                         │
└─────────────────────────┘
```

### Boş Folder
```
This folder is empty
Drag files here or click "+ Add" to upload
```

### Boş Recycle Bin
```
Recycle Bin is empty
Deleted files will appear here for 30 days
```

---

## 12. Drag & Drop

- Fayl brauzerdən drive-a drag-drop ilə upload
- Drive içindəki faylları folder-lər arasında drag-drop ilə move
- Drag zamanı: ghost element + drop target highlight

---

## 13. Color System

Mövcud CSS variable-ları istifadə et. Əlavə:

| Variable | Dəyər | İstifadə |
|----------|-------|----------|
| `--drive-card-bg` | `#ffffff` | Card background |
| `--drive-card-hover` | `rgba(0,120,255,0.05)` | Hover state |
| `--drive-card-selected` | `rgba(0,120,255,0.1)` | Selected state |
| `--drive-quota-green` | `#4caf50` | 0-70% usage |
| `--drive-quota-yellow` | `#ff9800` | 70-90% usage |
| `--drive-quota-red` | `#f44336` | 90-100% usage |

---

## 14. Responsive Davranış

- **Desktop (≥1024px)**: tam layout, grid view default
- **Tablet (768-1023px)**: kiçik grid, details panel overlay
- **Mobile (<768px)**: list view default, full-screen details

---

## Çıxarılacaq Artifacts

1. Drive main page wireframe (grid + list view)
2. Selection toolbar specification
3. Details panel wireframe
4. Recycle Bin wireframe
5. Empty states
6. File type icon mapping
7. Storage quota component
8. Context menu specification
9. Color/spacing tokens
