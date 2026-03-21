// ─── api.js — Centralized HTTP Layer ─────────────────────────────────────────
// .NET-də: HttpClient + AuthenticationHandler kimi.
// Bütün API çağırışları bu fayldan keçir. Burda:
//   - Cookie avtomatik göndərilir (BFF pattern)
//   - 401 gəldikdə token refresh + retry avtomatik olur
//   - Proactive token refresh timer işləyir

// Backend server URL-i — bütün endpointlərə bu əlavə olunur
// Docker-da: window.__ENV__.API_BASE_URL nginx/docker-entrypoint.sh tərəfindən set olunur
// Development-də: public/env.js default "http://localhost:7000" istifadə edir
const BASE_URL = window.__ENV__?.API_BASE_URL ?? "http://localhost:7000";

// JWT access token 15 dəqiqəyə expire olur (appsettings.json: AccessTokenExpirationMinutes=15).
// Biz 12 dəqiqə sonra proaktiv refresh edirik ki, expire olmadan yeniləsin.
// 15 dəq - 3 dəq bufer = 12 dəqiqə → token heç vaxt expire olmur (normal şəraitdə).
// 12 * 60 * 1000 = 720,000 millisaniyə = 12 dəqiqə
const REFRESH_INTERVAL_MS = 12 * 60 * 1000;

// ─── Module-Level Variables ───────────────────────────────────────────────────
// Bu dəyişənlər faylın "özəl yaddaşı"dır — class-sız singleton kimi işləyir.

// refreshPromise: eyni anda 2+ 401 gəldikdə yalnız 1 refresh request göndərilsin.
// null — hal-hazırda refresh getmir.
// Promise — refresh gedir, gözlə.
let refreshPromise = null;

// refreshTimerId: setTimeout qaytardığı ID — clearTimeout üçün lazımdır
let refreshTimerId = null;

// sessionExpired: refresh uğursuz olduqda true olur — "kill switch"
// true olduqda heç bir API call refresh cəhd etmir, dərhal throw edir.
// Bu, 401 infinite retry loop-un qarşısını alır.
// .NET ekvivalenti: CancellationToken.IsCancellationRequested
let sessionExpired = false;

// ─── refreshToken ─────────────────────────────────────────────────────────────
// Server-dən yeni access token alır (refresh cookie vasitəsilə).
// "Singleton promise" pattern: eyni anda çoxlu 401 gəlsə, yalnız 1 refresh gedir.
async function refreshToken() {
  // Kill switch — artıq session expired olubsa, heç refresh cəhd etmə
  if (sessionExpired) throw new Error("Session expired");

  // Artıq refresh işləyirsə — eyni promise-i qaytar (2 request göndərmə)
  if (refreshPromise) return refreshPromise;

  // fetch — brauzer-in daxili HTTP client funksiyası (.NET-də HttpClient.PostAsync kimi)
  // credentials: "include" — cookie-ni avtomatik göndər (BFF pattern üçün vacib!)
  refreshPromise = fetch(BASE_URL + "/api/auth/refresh", {
    method: "POST",
    credentials: "include",
  })
    .then((res) => {
      // !res.ok → HTTP 4xx/5xx — refresh uğursuz → kill switch aktiv et
      if (!res.ok) {
        sessionExpired = true;   // Bütün sonrakı API call-ları dərhal dayandır
        stopRefreshTimer();      // Proactive timer-i ləğv et — boşuna refresh etməsin
        throw new Error("Refresh failed");
      }
      sessionExpired = false;    // Uğurlu — əvvəlki expired flag-ı sıfırla
      scheduleRefresh();         // Növbəti refresh-i planla (25 dəq sonra yenə)
      return true;
    })
    .finally(() => {
      // .finally() — uğurlu olsun ya olmasın, refreshPromise-i sıfırla
      // Növbəti çağırışda yenidən request göndərə bilsin
      refreshPromise = null;
    });

  return refreshPromise;
}

// ─── scheduleRefresh ──────────────────────────────────────────────────────────
// Token expire olmadan 5 dəq əvvəl avtomatik refresh planlaşdırır.
// setTimeout — JavaScript-in "gecikmə ilə funksiya çağır" mexanizmi.
// .NET-də: Timer ya da BackgroundService kimi.
function scheduleRefresh() {
  // Köhnə timer varsa sil — "restart" effekti
  if (refreshTimerId) clearTimeout(refreshTimerId);

  // 25 dəq sonra refreshToken() çağır
  refreshTimerId = setTimeout(async () => {
    try {
      await refreshToken();
    } catch {
      // Proactive refresh uğursuz — problem yoxdur.
      // Növbəti API call 401 alacaq, orada da retry edəcəyik.
    }
  }, REFRESH_INTERVAL_MS);
}

// ─── stopRefreshTimer ─────────────────────────────────────────────────────────
// Logout zamanı çağırılır — boşuna refresh etməsin.
function stopRefreshTimer() {
  if (refreshTimerId) {
    clearTimeout(refreshTimerId); // Timer-i ləğv et
    refreshTimerId = null;        // ID-ni sıfırla
  }
}

// ─── resetSessionExpired ────────────────────────────────────────────────────────
// Login uğurlu olduqda çağırılır — kill switch-i sıfırla.
// Əks halda istifadəçi yenidən login olsa belə, köhnə sessionExpired=true qalardı.
function resetSessionExpired() {
  sessionExpired = false;
}

// ─── apiFetch — Core HTTP Function ───────────────────────────────────────────
// Bütün API calls buradan keçir. 401 gəldikdə: refresh + retry.
// endpoint: "/api/users/me" kimi — BASE_URL-ə əlavə olunur
// options: { method, headers, body } — GET üçün boş, POST/PUT üçün dolu
async function apiFetch(endpoint, options = {}) {
  // Kill switch — session artıq expired-dirsə, heç request göndərmə
  // Bu, infinite loop-un ən sürətli "circuit breaker"-idir
  if (sessionExpired) throw new Error("Session expired");

  // fetch — HTTP sorğu göndər
  // ...options — spread operator: options-ın bütün xassələrini buraya kopyala
  // credentials: "include" — cookie-ni hər request-ə əlavə et (server session üçün)
  const response = await fetch(BASE_URL + endpoint, {
    ...options,
    credentials: "include",
  });

  // 401 Unauthorized → token expire olub → refresh et, yenidən cəhd et
  if (response.status === 401) {
    try {
      await refreshToken(); // Yeni token al
    } catch {
      // Refresh da uğursuz → session tamamilə bitib → login lazımdır
      throw new Error("Session expired");
    }

    // Orijinal sorğunu yenidən göndər (refresh-dən sonra yeni cookie var)
    const retryResponse = await fetch(BASE_URL + endpoint, {
      ...options,
      credentials: "include",
    });

    if (!retryResponse.ok) {
      // JSON-da server error mesajını götür (olmasa boş object {} qaytar)
      const error = await retryResponse.json().catch(() => ({}));
      throw new Error(error.error || "Request failed");
    }

    // 204 No Content: server cavab vermirdi (məsələn DELETE uğurlu)
    if (retryResponse.status === 204) return null;
    return retryResponse.json(); // JSON-u parse edib qaytır
  }

  // Normal (401 olmayan) error — serverdə problem
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || "Request failed");
  }

  // 204 No Content — boş cavab (məsələn POST /logout)
  if (response.status === 204) return null;

  // .json() — response body-ni JSON-a parse edir və Promise qaytarır
  return response.json();
}

// ─── Convenience Functions ────────────────────────────────────────────────────
// GET sorğusu — body yoxdur, sadəcə endpoint
// Auto-retry: network xətası olduqda 1 dəfə yenidən cəhd edir (1s gecikmə ilə)
// POST/PUT/DELETE retry olunmur — dublikat data yarana bilər
async function apiGet(endpoint) {
  try {
    return await apiFetch(endpoint);
  } catch (err) {
    // Yalnız network/fetch xətalarında retry et, session expired-da yox
    if (sessionExpired || err.message === "Session expired") throw err;
    // 1 saniyə gözlə, sonra yenidən cəhd et
    await new Promise((r) => setTimeout(r, 1000));
    return apiFetch(endpoint);
  }
}

// POST sorğusu — body var (JSON)
// JSON.stringify(body): JavaScript object-i JSON string-ə çevirir
// { "Content-Type": "application/json" }: servərə "body JSON formatındadır" deyirik
function apiPost(endpoint, body) {
  return apiFetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// PUT sorğusu — POST kimi, amma mövcud resursu yeniləmək üçün
function apiPut(endpoint, body) {
  return apiFetch(endpoint, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// DELETE sorğusu — body yoxdur, yalnız URL
function apiDelete(endpoint) {
  return apiFetch(endpoint, { method: "DELETE" });
}

// ─── apiUpload — Multipart File Upload with Progress + Cancel ────────────────
// XHR istifadə olunur çünki fetch upload progress dəstəkləmir.
// FormData göndərir (Content-Type brauzer tərəfindən auto set olunur — boundary ilə).
// onProgress({ loaded, total }) — raw bytes callback (caller format edir).
// abortController (optional) — cancel üçün: abortController.abort() → upload dayandırılır.
// 401 gəldikdə: refreshToken() + retry (apiFetch ilə eyni pattern).
function apiUpload(endpoint, formData, onProgress, abortController) {
  if (sessionExpired) return Promise.reject(new Error("Session expired"));

  function send() {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      // AbortController dəstəyi — cancel butonu üçün
      if (abortController) {
        if (abortController.signal.aborted) {
          return reject(new DOMException("Upload aborted", "AbortError"));
        }
        abortController.signal.addEventListener("abort", () => xhr.abort(), { once: true });
      }

      xhr.open("POST", BASE_URL + endpoint);
      xhr.withCredentials = true; // Cookie auth (BFF pattern)

      // Upload progress — raw loaded/total göndər (caller format edir)
      if (onProgress) {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            onProgress({ loaded: e.loaded, total: e.total });
          }
        };
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch {
            resolve(null);
          }
        } else if (xhr.status === 401) {
          reject({ status: 401 }); // Retry ilə idarə olunacaq
        } else {
          try {
            const err = JSON.parse(xhr.responseText);
            reject(new Error(err.error || "Upload failed"));
          } catch {
            reject(new Error("Upload failed"));
          }
        }
      };

      xhr.onerror = () => reject(new Error("Network error"));
      xhr.onabort = () => reject(new DOMException("Upload aborted", "AbortError"));
      // 2 dəqiqə timeout — network kəsilərsə upload sonsuza qədər gözləməsin
      xhr.timeout = 120_000;
      xhr.ontimeout = () => reject(new Error("Upload timeout"));
      xhr.send(formData);
    });
  }

  // İlk cəhd — 401 gəlsə refresh + retry
  return send().catch(async (err) => {
    if (err && err.status === 401) {
      await refreshToken();
      return send();
    }
    throw err;
  });
}

// getFileUrl — backend-in static fayl URL-ını tam URL-a çevirir
// Backend "/uploads/..." qaytarır, frontend fərqli port-dadır → BASE_URL prefix lazımdır
function getFileUrl(path) {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return BASE_URL + path;
}

// downloadFile — fayl yükləmə üçün mərkəzləşdirilmiş funksiya
// fileId varsa API endpoint-dən blob ilə yükləyir, yoxdursa birbaşa URL açır
function downloadFile(fileId, fileName, fallbackUrl) {
  if (!fileId) {
    if (fallbackUrl) window.open(getFileUrl(fallbackUrl), "_blank");
    return;
  }
  fetch(getFileUrl(`/api/files/${fileId}/download`), { credentials: "include" })
    .then((res) => res.blob())
    .then((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName || "file";
      a.click();
      URL.revokeObjectURL(url);
    })
    .catch(() => {
      if (fallbackUrl) window.open(getFileUrl(fallbackUrl), "_blank");
    });
}

// downloadFileByUrl — birbaşa URL-dən yükləmə (DetailSidebar files tab üçün)
// DOM-a əlavə et → klik → sil — bəzi brauzerlərdə DOM-da olmayan <a> işləmir
function downloadFileByUrl(fileUrl, fileName) {
  const a = document.createElement("a");
  a.href = fileUrl;
  a.download = fileName || "file";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// Named exports — başqa fayllar bunları import edə bilsin
export { apiGet, apiPost, apiPut, apiDelete, apiUpload, getFileUrl, downloadFile, downloadFileByUrl, scheduleRefresh, stopRefreshTimer, resetSessionExpired };
