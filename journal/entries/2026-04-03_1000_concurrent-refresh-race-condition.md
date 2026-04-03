# Bug Fix: Concurrent Refresh Race Condition — Session Cookie Silinir

**From**: Product Owner
**To**: Backend Developer + Frontend Developer
**Date**: 2026-04-03
**Priority**: P0 — İstifadəçi durduq yerdə logout olur

---

## Problem

İstifadəçi aktiv istifadə zamanı qəfil login səhifəsinə atılır. Backend loglardan kök səbəb:

```
10:08:14 — İki eyni vaxtda refresh sorğusu:
  FLFLH6 → 200 (uğurlu — yeni token, köhnə token invalidate oldu)
  FLFLH5 → 400 "Invalid or expired refresh token" (köhnə token artıq keçərsiz)
           ↓
  Backend "Invalid or expired" görür → _sid cookie SİLİR → LOGOUT
```

**Race condition:** `visibilitychange` handler + proactive refresh timer eyni vaxtda fire olur → 2 concurrent refresh → birincisi uğurlu olur (köhnə token invalidate), ikincisi uğursuz olur → backend cookie-ni silir.

---

## Backend Düzəliş

**Fayl:** `AuthController.cs` — lines 118-126

**Problem:** Concurrent refresh uğursuz olanda backend session-u silir və cookie-ni təmizləyir. Amma əslində session hələ etibarlıdır — digər concurrent request artıq yeni token yaradıb.

**Düzəliş:** "Invalid or expired refresh token" xətasında session-u silmə — sadəcə 400 qaytar. Frontend retry edəcək.

```csharp
if (result.IsFailure)
{
    // "Invalid or expired" — concurrent refresh race condition ola bilər.
    // Session-u silmə — digər request artıq yeni token yaratmış ola bilər.
    // Frontend növbəti API call-da yenidən refresh cəhd edəcək.
    return BadRequest(new { error = result.Error });
}
```

Lines 118-126 silinməlidir (session silmə + cookie clear). Yalnız `return BadRequest` qalmalıdır.

**Amma:** Əgər token həqiqətən keçərsizdirsə (manipulyasiya, əl ilə dəyişdirilmiş) — session silinməlidir. Bunu fərqləndirmək üçün: Redis-dəki session-un hələ mövcud olub-olmadığını yoxla. Əgər session mövcuddursa (digər request yeniləyib) → silmə. Session mövcud deyilsə → sil.

```csharp
if (isTokenInvalid)
{
    // Session hələ Redis-dədir? (digər concurrent refresh yeniləmiş ola bilər)
    var currentToken = await _sessionStore.GetRefreshTokenAsync(sessionId);
    if (string.IsNullOrEmpty(currentToken))
    {
        // Session həqiqətən expired — cookie-ni təmizlə
        ClearSessionCookie();
    }
    // Əgər session hələ mövcuddursa — silmə, digər request artıq yeniləyib
}
```

---

## Frontend Düzəliş

**Fayl:** `api.js`

**Problem:** `refreshToken()` singleton pattern var (`if (refreshPromise) return refreshPromise`), amma `visibilitychange` handler (`api.js`) və `scheduleRefresh` timer eyni vaxtda fire olur.

**Düzəliş:** `visibilitychange` handler-da refresh çağırmazdan əvvəl timer-i ləğv et:

```javascript
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && !sessionExpired && refreshTimerId) {
    // Timer-i ləğv et — ikiqat refresh olmasın
    clearTimeout(refreshTimerId);
    refreshTimerId = null;
    refreshToken().then(() => scheduleRefresh()).catch(() => {});
  }
});
```

---

## Frontend Düzəliş 2: Login səhifəsində SignalR retry

**Fayl:** `signalr.js`

SignalR `handleVisibilityChange` login səhifəsində `startConnection()` çağırır → 401 → retry loop. Login səhifəsində SignalR connection cəhd etməməlidir.

`signalr.js`-dəki `handleVisibilityChange`:
```javascript
function handleVisibilityChange() {
  if (document.visibilityState === "visible" && !stopRequested) {
    // Yalnız əvvəldən connection var idisə reconnect et
    // Login səhifəsində connection heç vaxt qurulmayıb → retry etmə
    if (!connection && !connectionPromise) return; // ← bu şərt əlavə olunmalıdır
    startConnection().catch(() => {});
  }
}
```

---

## Acceptance Criteria

- [ ] İki eyni vaxtda refresh sorğusu göndərilmir (frontend singleton + timer cancel)
- [ ] Concurrent refresh uğursuz olanda session cookie silinmir (backend)
- [ ] Login səhifəsində SignalR reconnect cəhd olunmur
- [ ] İstifadəçi aktiv istifadə zamanı logout olmur
- [ ] `visibilitychange` refresh uğurlu olduqda timer yenidən qurulur
