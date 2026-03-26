# UI/UX Task: Admin Panel Full Redesign

**From**: Product Owner
**To**: UI/UX Developer
**Date**: 2026-03-26
**Priority**: P1
**Handoff to**: Frontend Developer (after completion)

---

## Context

Admin Panel mövcuddur, lakin dizaynı modernləşdirilməlidir. Bundan əlavə, Users bölməsi tamamilə yenidən dizayn edilməlidir — SuperAdmin üçün bütün şirkətlər üzrə iyerarxiya, Admin üçün öz şirkəti üzrə iyerarxiya.

---

## Mövcud Vəziyyət

Admin Panel hazırda 4 bölmədən ibarətdir:

| Bölmə | Kim görür |
|-------|-----------|
| Companies | SuperAdmin |
| Users | Admin |
| Departments | Admin |
| Positions | Admin |

**Yeni tələb**: Users bölməsi həm SuperAdmin, həm Admin üçün görünəcək, lakin fərqli məzmunla.

---

## 1. Ümumi Redesign Prinsipi

Bütün bölmələr üçün tətbiq ediləcək:

- **Tipografiya**: Başlıqlar daha bold, table header-ləri `font-weight: 400` (artıq var), section title-lar `20px / 700`
- **Kartlar**: Cədvəllər `box-shadow: 0 1px 4px rgba(0,0,0,0.06)` ilə kart kimi görünür
- **Rənglər**: Mövcud CSS dəyişənlər saxlanılır (`--primary-color: #2fc6f6`, və s.)
- **Boşluqlar**: Komponentlər arası `gap: 20px`, section içi `gap: 16px`
- **Hover effektləri**: Cədvəl sıralarında `transition: background 150ms`
- **Bütün animasiyalar**: `admin-shared.css`-dən istifadə et — yenidən yaratma
- **Prefix qaydaları**: mövcud `cm-*`, `um-*`, `dm-*`, `pm-*` saxla

---

## 2. Admin Panel Nav — Yenilənmiş Struktur

```
┌──────────────────────┐
│  ap-nav (220px)      │
│                      │
│  🏢  Companies       │  ← SuperAdmin only
│  👥  Users           │  ← SuperAdmin + Admin (YENİ: hər ikisi)
│  🏗  Departments     │  ← Admin only
│  💼  Positions       │  ← Admin only
│                      │
└──────────────────────┘
```

Nav item dizaynı dəyişmir — mövcud spec:
- Default: `color: var(--gray-600); border-left: 3px solid transparent`
- Active: `background: rgba(47,198,246,0.10); border-left-color: var(--primary-color); color: var(--primary-color); font-weight: 600`

---

## 3. Users Bölməsi — İki Fərqli Görünüş

### 3a. SuperAdmin — Bütün Şirkətlər Üzrə İyerarxiya

SuperAdmin üçün Users bölməsi şirkətlər üzrə qruplaşdırılmış ağac görünüşüdür.

```
┌──────────────────────────────────────────────────────────────────────┐
│  Users                                         [🔍 Search...]        │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ▼  🏢 166 Logistics                  [42 users]                     │
│  │                                                                    │
│  │  ▼ 🏗 Engineering                  [12 users]                     │
│  │  │  ▼ 🏗 Frontend                  [4 users]                      │
│  │  │  │   👤 Aysel H. — Frontend Lead        ★ Head                │
│  │  │  │   👤 Murad B. — Frontend Dev                               │
│  │  │  └ 🏗 Backend                   [5 users]                      │
│  │  │      👤 Rəşad Ə. — Backend Lead          ★ Head               │
│  │  └ 🏗 Finance                      [6 users]                      │
│  │      👤 Leyla M. — CFO              ★ Head                        │
│  └  (no department)                                                   │
│       👤 Aqil Z. — Head of Company                                   │
│                                                                       │
│  ▼  🏢 156 Evakuasiya                 [18 users]                     │
│  │  ▼ 🏗 Operations ...                                              │
│  └  ...                                                               │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

**Spec:**

#### Company Node (`hi-company-node`)
- `background: var(--white); border: 1px solid var(--gray-200); border-radius: 10px; padding: 12px 16px; margin-bottom: 8px`
- Logo (36px) + company name (`font-size: 16px; font-weight: 700`) + user count badge
- Expand/collapse chevron — default **expanded**
- `box-shadow: 0 1px 4px rgba(0,0,0,0.06)`

#### Department Node (`hi-dept-node`)
- Indent: `padding-left: calc(level * 24px + 16px)`
- `background: var(--gray-50); border-bottom: 1px solid var(--border-light); height: 40px`
- Folder icon + dept name (`font-weight: 600; font-size: 13px`) + user count
- Expand/collapse chevron
- Dept head name: `color: var(--gray-400); font-size: 12px` (subtitle yanında)

#### User Row (`hi-user-row`)
- Indent: parent dept indent + 24px
- `height: 44px; background: var(--white); border-bottom: 1px solid var(--border-light)`
- Avatar (28px) + full name + position badge + role badge
- `★ Head` işarəsi: `color: var(--primary-color); font-size: 11px; font-weight: 600` — dept head olanlara

#### Search
- Global search: filterlər bütün şirkətlər üzrə işləyir
- Axtarış nəticələri: uyğun user-lər highlight edilir, uyğun olmayan dept/company-lər collapse olur

---

### 3b. Admin — Öz Şirkəti Üzrə İyerarxiya

Admin üçün eyni ağac görünüşü, lakin company node yoxdur — birbaşa departamentlər göstərilir.

```
┌──────────────────────────────────────────────────────────────────────┐
│  Users — 166 Logistics              [42]    [🔍 Search...]           │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ▼ 🏗 Engineering                   [12 users]                       │
│  │  ▼ 🏗 Frontend                   [4 users]                        │
│  │  │   👤 Aysel H. — Frontend Lead        ★ Head                   │
│  │  │   👤 Murad B. — Frontend Dev                                   │
│  │  └ 🏗 Backend                    [5 users]                        │
│  │      👤 Rəşad Ə. — Backend Lead         ★ Head                   │
│  └ 🏗 Finance                       [6 users]                        │
│      👤 Leyla M. — CFO              ★ Head                           │
│                                                                       │
│  (No department)                                                      │
│  👤 Aqil Z. — Head of Company                                        │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

Company node yoxdur — dept-lər birbaşa göstərilir. Qalanı eynidir.

---

## 4. Companies Bölməsi Redesign

Mövcud table layout saxlanılır. Yalnız vizual keyfiyyət artırılır:

```
┌──────────────────────────────────────────────────────────────────────┐
│  Companies   [2]                              [+ New Company]        │
├──────────────────────────────────────────────────────────────────────┤
│  [🔍 Search companies...]                                             │
├──────────────────────────────────────────────────────────────────────┤
│  COMPANY           │ DESCRIPTION    │ STATUS    │                    │
├────────────────────┼────────────────┼───────────┼────────────────────┤
│  🏢 166 Logistics  │  —             │ • Active  │  •••               │
│  🏢 156 Evakuasiya │  —             │ • Active  │  •••               │
└──────────────────────────────────────────────────────────────────────┘
```

Əlavə ediləcəklər:
- Company row-a click → detail view (company stats: user count, dept count)
- Logo olmayan şirkətlər üçün initials avatar (artıq var — saxla)
- `•••` dropdown: Edit, Assign Admin, Deactivate — dizayn dəyişmir, yalnız overflow fix (artıq edildi)

---

## 5. Interaction States — Hierarchy View

| State | Spec |
|-------|------|
| Expand/Collapse | chevron rotate 90° — `transition: transform 200ms` |
| Hover (dept node) | `background: #f0f9ff` |
| Hover (user row) | `background: #f8fafc` |
| Search match | matched text `background: rgba(47,198,246,0.15); border-radius: 3px` |
| No match | `color: var(--gray-300)` on non-matching nodes |
| Loading | skeleton — 3 company nodes + 2 dept nodes per company |
| Empty | "No users found." icon + message |
| Collapsed | children hidden, chevron points right |
| Expanded | children visible, chevron points down |

---

## 6. CSS Naming

```
Hierarchy View:    hi-*
  hi-tree              — root container
  hi-company-node      — company block
  hi-company-header    — clickable header row
  hi-dept-node         — department row
  hi-dept-header       — clickable dept header
  hi-user-row          — user row
  hi-chevron           — expand/collapse icon
  hi-avatar            — 28px user avatar
  hi-role-badge        — role tag
  hi-head-badge        — "★ Head" marker
  hi-count-badge       — "[12 users]" tag
  hi-search            — search input
  hi-no-dept-section   — "No department" group
```

---

## 7. Anti-AI Checklist

- [ ] Company node → dept list: expand/collapse çalışır, default expanded
- [ ] Dept head user: `★ Head` işarəsi ilə həm dept başlanğıcında, həm normal sırada görünür
- [ ] "No department" qrupu: ayrıca section kimi, dept node-u kimi deyil
- [ ] Search: yalnız user adlarını deyil, dept adlarını da filter edir
- [ ] Loading state: skeleton hierarchy (company + dept + user placeholders)
- [ ] Admin view: company node YOX — birbaşa dept-lər

---

## Output

`agents/uiux-developer/outputs/2026-03-26_wireframe_admin-panel-redesign.md`
