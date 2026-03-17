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
const HUB_URL = (window.__ENV__?.API_BASE_URL ?? "http://localhost:7000") + "/hubs/chat";

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

// ─── Tab bağlananda bağlantını təmiz bağla ──────────────────────────────────
window.addEventListener("beforeunload", () => {
  stopRequested = true;
  if (retryTimerId) {
    clearTimeout(retryTimerId);
    retryTimerId = null;
  }
  if (connection) {
    connection.stop();
  }
});

// ─── Internet geri gələndə dərhal reconnect et ──────────────────────────────
// Browser "online" event-i: WiFi/ethernet bərpa olunduqda fire olur
// scheduleRetry 5s gözləyir — bu event dərhal yenidən cəhd edir
window.addEventListener("online", () => {
  if (stopRequested) return;
  if (connection) return; // artıq bağlıdır
  // Mövcud retry timer-i ləğv et — dərhal cəhd edəcəyik
  if (retryTimerId) {
    clearTimeout(retryTimerId);
    retryTimerId = null;
  }
  startConnection().catch(() => {});
});

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

    await conn.start();
    notifyConnectionState("connected");

    connection = conn;
    connectionPromise = null;
    return conn;
  })().catch((err) => {
    // startConnection fail oldu — connectionPromise-i sıfırla ki, retry mümkün olsun
    console.error("SignalR: initial connection failed:", err);
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
// Sonsuz retry loop — hər 5 saniyədən bir yenidən bağlanmağa cəhd edir
// Backend restart olduqda bu loop backend geri gələnə qədər davam edir
function scheduleRetry() {
  if (retryTimerId) clearTimeout(retryTimerId);
  retryTimerId = setTimeout(() => {
    retryTimerId = null;
    if (stopRequested) return;
    startConnection().catch(() => {
      // startConnection öz catch-ində scheduleRetry çağırır — əlavə iş lazım deyil
    });
  }, 5000);
}

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
    await connectionPromise;
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

// ─── Connection State Listener ──────────────────────────────────────────────
// Chat.jsx-dən SignalR bağlantı vəziyyətini izləmək üçün callback register et
// callback(state): "connected" | "reconnecting" | "disconnected"
let connectionStateCallback = null;

export function onConnectionStateChange(callback) {
  connectionStateCallback = callback;
}

function notifyConnectionState(state) {
  if (connectionStateCallback) connectionStateCallback(state);
}

