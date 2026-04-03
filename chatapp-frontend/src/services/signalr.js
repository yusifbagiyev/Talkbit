// ─── signalr.js — Real-Time WebSocket Connection ─────────────────────────────
// SignalR: Microsoft-un real-time communication library-si.
// WebSocket vasitəsilə server client-ə birbaşa mesaj göndərə bilir.
// .NET-də: IHubContext<ChatHub> kimi işləyir — amma bu tərəf client (JavaScript) hissəsidir.
//
// Analogy: HTTP = məktub (göndər, gözlə), SignalR = telefon zəngi (hər zaman açıq)
//
// Bu faylda:
//   - Server ilə bağlantı qurmaq (startConnection)
//   - Bağlantını almaq (getConnection) — event handler-lər əlavə etmək üçün

import { HubConnectionBuilder, LogLevel } from "@microsoft/signalr";

// SignalR hub-ının URL-i — backend-dəki ChatHub endpoint-i
// Docker-da: window.__ENV__.API_BASE_URL runtime-da set olunur (nginx/docker-entrypoint.sh)
// Development: public/env.js "http://localhost:7000" set edir
// Production: Dockerfile env.js-i boş string ilə override edir
const HUB_URL = (window.__ENV__?.API_BASE_URL ?? "") + "/hubs/chat";

// ─── Module-Level Singleton ───────────────────────────────────────────────────
// connection: aktiv SignalR bağlantısı (1 ədəd — singleton pattern)
// connectionPromise: bağlantı qurularkən gözlənilən Promise
// Bu 2 dəyişən sayəsində eyni anda 2 bağlantı yaranmır (race condition yoxdur)
let connection = null;
let connectionPromise = null;

// stopRequested: logout zamanı true olur — onclose handler-da retry olmasın
let stopRequested = false;

// retryTimerId: onclose retry setTimeout ID-si — cleanup üçün
let retryTimerId = null;

// retryCount: exponential backoff üçün sayğac (limit yoxdur — tab aktiv olduqda həmişə retry)
let retryCount = 0;

// ─── Tab bağlananda bağlantını təmiz bağla ──────────────────────────────────
function handleBeforeUnload() {
  stopRequested = true;
  if (retryTimerId) {
    clearTimeout(retryTimerId);
    retryTimerId = null;
  }
  if (connection) {
    connection.stop();
  }
}
window.addEventListener("beforeunload", handleBeforeUnload);

// ─── Internet geri gələndə dərhal reconnect et ──────────────────────────────
// Browser "online" event-i: WiFi/ethernet bərpa olunduqda fire olur
function handleOnline() {
  if (stopRequested) return;
  if (connection) return; // artıq bağlıdır
  // Mövcud retry timer-i ləğv et — dərhal cəhd edəcəyik
  if (retryTimerId) {
    clearTimeout(retryTimerId);
    retryTimerId = null;
  }
  retryCount = 0; // İnternet geri gəldi — sayğacı sıfırla
  startConnection().catch(() => {});
}
window.addEventListener("online", handleOnline);

// ─── getSignalRToken ──────────────────────────────────────────────────────────
// SignalR JWT token alır. SignalR WebSocket-də HTTP cookie işlətmir,
// ona görə ayrıca JWT token lazımdır.
// Server: GET /api/auth/signalr-token → { token: "eyJ..." }
async function getSignalRToken() {
  const response = await fetch((window.__ENV__?.API_BASE_URL ?? "http://localhost:7000") + "/api/auth/signalr-token", {
    credentials: "include",   // Session cookie göndər ki, server bizi tanısın
  });

  if (!response.ok) throw new Error("Failed to get SignalR token");
  const data = await response.json();
  return data.token;           // JWT string-i qaytar
}

// ─── startConnection ──────────────────────────────────────────────────────────
// SignalR bağlantısını başladır. Singleton pattern:
//   - Artıq bağlantı varsa → mövcud bağlantını qaytar
//   - Bağlantı gedirsə → eyni Promise-i qaytar (2-ci start etmə)
//   - Yoxdursa → yeni bağlantı qur
export async function startConnection() {
  // Artıq aktiv bağlantı var → onu qaytar
  if (connection) return connection;

  // Bağlantı hələ qurulur (başqa bir çağırış başlatıb) → eyni promise-i gözlə
  if (connectionPromise) return connectionPromise;

  // Yeni bağlantı başlayır — stopRequested sıfırla
  stopRequested = false;

  connectionPromise = (async () => {
    const conn = new HubConnectionBuilder()
      .withUrl(HUB_URL, {
        accessTokenFactory: () => getSignalRToken(),
      })
      // withAutomaticReconnect: şəbəkə kəsildikdə avtomatik yenidən qoşul
      // Uzun retry siyahısı — backend restart-a kifayət qədər vaxt verir
      .withAutomaticReconnect([0, 1000, 2000, 5000, 5000, 10000, 10000, 30000, 30000, 60000])
      .configureLogging(LogLevel.Warning)
      .build();

    conn.onreconnecting(() => {
      connection = null;
      notifyConnectionState("reconnecting");
    });

    conn.onreconnected(() => {
      connection = conn;
      notifyConnectionState("connected");
    });

    // onclose: bütün reconnect cəhdləri uğursuz → sonsuz retry loop (5s interval)
    conn.onclose(() => {
      connection = null;
      connectionPromise = null;
      notifyConnectionState("reconnecting");

      if (!stopRequested) {
        scheduleRetry();
      }
    });

    // Server-dən broadcast olunan event-lər üçün default handler-lər
    // Admin səhifələrdə useChatSignalR aktiv deyil — handler olmadıqda warning yaranır
    conn.on("UserOnline", () => {});
    conn.on("UserOffline", () => {});

    await conn.start();
    retryCount = 0; // Uğurlu bağlantı — sayğacı sıfırla
    notifyConnectionState("connected");

    connection = conn;
    connectionPromise = null;
    return conn;
  })().catch((err) => {
    // startConnection fail oldu — connectionPromise-i sıfırla ki, retry mümkün olsun
    connection = null;
    connectionPromise = null;
    notifyConnectionState("reconnecting");

    if (!stopRequested) {
      scheduleRetry();
    }
    throw err;
  });

  return connectionPromise;
}

// ─── scheduleRetry ────────────────────────────────────────────────────────────
// Exponential backoff: 5s → 10s → 20s → 30s (cap) — limit yoxdur, həmişə cəhd edir.
// Tab gizlidirsə retry dayandırılır — tab aktiv olduqda dərhal yenidən başlayır.
function getRetryDelay() {
  // 5s, 10s, 20s, 30s, 30s, 30s, ...
  return Math.min(5000 * Math.pow(2, retryCount), 30000);
}

function scheduleRetry() {
  if (retryTimerId) clearTimeout(retryTimerId);
  retryCount++;

  // Tab gizlidirsə retry etmə — handleVisibilityChange aktiv olduqda başladacaq
  if (document.hidden) {
    notifyConnectionState("reconnecting");
    return;
  }

  const delay = getRetryDelay();
  retryTimerId = setTimeout(() => {
    retryTimerId = null;
    if (stopRequested) return;
    startConnection().catch(() => {});
  }, delay);
}

// ─── Tab aktiv olduqda dərhal reconnect cəhd et ──────────────────────────────
// Bu sayədə backend 5 dəq sonra geri gəlsə belə, user tab-a keçdikdə dərhal bağlanır.
function handleVisibilityChange() {
  if (document.hidden || stopRequested) return;
  if (connection) return; // artıq bağlıdır
  // Login səhifəsində connection heç vaxt qurulmayıb — retry etmə
  if (!retryTimerId) return;
  // Mövcud retry timer-i ləğv et — dərhal cəhd edəcəyik
  clearTimeout(retryTimerId);
  retryTimerId = null;
  retryCount = 0;
  startConnection().catch(() => {});
}
document.addEventListener("visibilitychange", handleVisibilityChange);

// ─── stopConnection ───────────────────────────────────────────────────────────
// Bağlantını dayandırır. Logout zamanı çağırılır.
export async function stopConnection() {
  // stopRequested = true → onclose handler retry etməsin
  stopRequested = true;

  // Pending retry timer-i ləğv et
  if (retryTimerId) {
    clearTimeout(retryTimerId);
    retryTimerId = null;
  }

  // Əgər bağlantı hələ qurulursa — əvvəl gözlə, sonra dayandır
  if (connectionPromise) {
    try { await connectionPromise; } catch { /* ignore — we're stopping anyway */ }
  }
  if (connection) {
    const conn = connection;
    connection = null;          // Reference-i dərhal sıfırla
    connectionPromise = null;
    await conn.stop();          // WebSocket-i bağla
  }
}

// ─── getConnection ────────────────────────────────────────────────────────────
// Mövcud bağlantını qaytarır (null ola bilər əgər hələ qurulmayıbsa).
// Chat.jsx-dən: hub metodlarını çağırmaq üçün istifadə olunur.
// Məsələn: getConnection().invoke("GetOnlineStatus", [userId])
export function getConnection() {
  return connection;
}

// ─── Connection State Listeners ─────────────────────────────────────────────
// callback(state): "connected" | "reconnecting" | "disconnected"
const connectionStateCallbacks = new Set();

export function onConnectionStateChange(callback) {
  connectionStateCallbacks.add(callback);
  // Unsubscribe funksiyası qaytar — cleanup üçün
  return () => connectionStateCallbacks.delete(callback);
}

function notifyConnectionState(state) {
  for (const cb of connectionStateCallbacks) cb(state);
}

// ─── cleanup — module-level event listener-ləri silir ────────────────────────
// SPA unmount / test cleanup üçün
export function cleanup() {
  window.removeEventListener("beforeunload", handleBeforeUnload);
  window.removeEventListener("online", handleOnline);
  document.removeEventListener("visibilitychange", handleVisibilityChange);
  connectionStateCallbacks.clear();
}

