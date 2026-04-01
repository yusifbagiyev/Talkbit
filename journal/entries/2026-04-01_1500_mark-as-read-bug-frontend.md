# Frontend Task: Mark-as-Read Bug Fix

**From**: Product Owner
**To**: Frontend Developer
**Date**: 2026-04-01
**Priority**: P0 — Mesajlar heç vaxt "oxundu" olaraq işarələnmir

---

## Problem

Conversation açılanda ekranda görünən unread mesajlar heç vaxt "read" olaraq işarələnmir. Nəticədə:
- Tək checkmark (✓) qalır, ikiqat checkmark (✓✓) heç vaxt görünmür
- `unreadCount` azalmır
- Backend-ə `batch-read` sorğusu heç vaxt göndərilmir

---

## Kök Səbəb

`Chat.jsx` — line 3190-3218: scroll listener attach olunur, amma **ilk yüklənmədə `handleScroll()` əl ilə çağırılmır**.

```
1. Conversation açılır → mesajlar render olunur
2. İstifadəçi scroll etmir → handleScroll heç fire olmur
3. Ekrandakı unread mesajlar detect olunmur
4. visibleUnreadRef boş qalır → flushReadBatch çağırılmır
5. Backend-ə batch-read sorğusu getmir
6. Mesajlar database-də unread qalır
```

`handleScroll` (line 3104) unread mesajları viewport-da detect edib `visibleUnreadRef`-ə əlavə edir, sonra 300ms timer ilə `flushReadBatch` çağırır. Amma bu yalnız scroll event-də işləyir.

---

## Düzəliş

**Fayl:** `chatapp-frontend/src/pages/Chat.jsx`

**Line 3193-dən sonra** — scroll listener attach olunandan sonra mesajların render olmasını gözlə və `handleScroll()`-u əl ilə çağır:

```javascript
area.addEventListener("scroll", handleScroll, { passive: true });

// İlk yüklənmədə ekranda görünən unread mesajları detect et
// requestAnimationFrame — mesajların DOM-da render olmasını gözləyir
requestAnimationFrame(() => {
  handleScroll();
});
```

Bu ekrandakı mövcud unread mesajları dərhal detect edəcək → `visibleUnreadRef`-ə əlavə edəcək → 300ms sonra `flushReadBatch` çağırılacaq → backend-ə `batch-read` sorğusu gedəcək.

---

## Test

1. User A → User B-yə 5 mesaj göndərsin
2. User B conversation-u açsın (scroll etmədən)
3. **Gözlənilən nəticə:** 300ms sonra 5 mesaj avtomatik "read" olmalıdır
4. User A-da ikiqat checkmark (✓✓) görünməlidir
5. Conversation list-də unreadCount 0 olmalıdır

---

## Qeydlər

- `flushReadBatch` (line 847) düzgün işləyir — `apiPost` ilə backend-ə `batch-read` göndərir
- Backend endpoint-ləri düzgündür — `/api/conversations/{id}/messages/batch-read` və `/api/channels/{id}/messages/batch-read`
- SignalR `MessageRead` event handler (useChatSignalR.js:175) düzgündür — digər istifadəçidən gələn read receipt-i handle edir
- Scroll zamanı da düzgün işləyəcək — əlavə dəyişiklik lazım deyil
