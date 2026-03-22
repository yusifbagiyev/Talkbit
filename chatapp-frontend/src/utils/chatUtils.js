// ─── chatUtils.js — Pure Utility Functions ───────────────────────────────────
// Bu faylda heç bir React yoxdur — sadə JavaScript funksiyaları.
// .NET-də: static helper class kimi. Komponentlər bu funksiyaları import edib istifadə edir.

// ─── Constants ────────────────────────────────────────────────────────────────
// "export const" — bu sabitlər birbaşa import edilə bilər:
// import { MESSAGE_PAGE_SIZE } from "../utils/chatUtils"

export const MESSAGE_PAGE_SIZE = 30; // Hər dəfə neçə mesaj yüklənir
export const CONVERSATION_PAGE_SIZE = 50; // Conversation list-i neçəyə qədər yüklənir
export const HIGHLIGHT_DURATION_MS = 3000; // Scroll-dan sonra mesajın 3 saniyə vurğulanması
export const TYPING_DEBOUNCE_MS = 2000; // Yazmağı dayandırandan 2 saniyə sonra "yazır" biter
export const MESSAGE_MAX_LENGTH = 10000; // Mesaj maksimum uzunluğu
export const BATCH_DELETE_THRESHOLD = 5; // 5-dən çox mesaj → batch delete API istifadə et
export const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB — backend upload limiti
export const MAX_BATCH_FILES = 20; // Backend batch limit (max 20 mesaj bir request-də)

// İcazə verilən fayl extension-ları — backend FileTypeHelper.ContentTypeMapping ilə sinxron
export const ALLOWED_FILE_EXTENSIONS = new Set([
  // Images
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".svg",
  ".bmp",
  // Documents
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".txt",
  ".csv",
  // Videos
  ".mp4",
  ".mpeg",
  ".mov",
  ".avi",
  ".webm",
  // Audio
  ".mp3",
  ".wav",
  ".ogg",
  ".weba",
  // Archives
  ".zip",
  ".rar",
  ".7z",
  ".tar",
  ".gz",
]);

// Fayl extension-ının icazə verilən siyahıda olub-olmadığını yoxla
export function isAllowedFileExtension(fileName) {
  if (!fileName) return false;
  const ext =
    fileName.lastIndexOf(".") !== -1
      ? fileName.slice(fileName.lastIndexOf(".")).toLowerCase()
      : "";
  return ALLOWED_FILE_EXTENSIONS.has(ext);
}

// ─── formatFileSize ─────────────────────────────────────────────────────────
// Byte dəyərini oxunaqlı formata çevirir: "2.4 MB", "128 KB", "512 B"
export function formatFileSize(bytes) {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

// ─── getChatEndpoint ──────────────────────────────────────────────────────────
// Chat tipinə görə doğru API URL-i qaytar.
// type 0 = DM (Direct Message/Conversation), type 1 = Channel
export function getChatEndpoint(chatId, chatType, path = "") {
  if (chatType === 0) return `/api/conversations/${chatId}${path}`; // DM
  if (chatType === 1) return `/api/channels/${chatId}${path}`; // Channel
  return null; // type 2 (DepartmentUser) — endpoint yoxdur
}

// ─── Avatar Color Palette ─────────────────────────────────────────────────────
// Avatar üçün istifadə olunan 5 rəng — profil şəkli olmayanda göstərilir.
// getAvatarColor() bu array-dən hash ilə rəng seçir.
const avatarColors = [
  "#4BA5C3", // mavi
  "#F76187", // çəhrayı
  "#8474C8", // bənövşəyi
  "#AB7761", // qəhvəyi
  "#64A513", // yaşıl
  "#ea580c", // orange
];

// ─── getInitials ──────────────────────────────────────────────────────────────
// İstifadəçinin adından 2 hərf götürür. Avatar-da mətn kimi göstərilir.
// "Ali Hasanov" → "AH"
// "Ali" → "A"
// null/undefined → "?"
export function getInitials(name) {
  if (!name) return "?"; // Ad yoxdur → sual işarəsi
  const parts = name.split(" "); // "Ali Hasanov" → ["Ali", "Hasanov"]
  if (parts.length >= 2) {
    // parts[0][0] → "A" (Alinin ilk hərfi)
    // parts[1][0] → "H" (Hasanovun ilk hərfi)
    // .toUpperCase() → böyük hərfə çevir
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name[0].toUpperCase(); // Yalnız 1 söz varsa → ilk hərfi qaytar
}

// ─── getAvatarColor ───────────────────────────────────────────────────────────
// İstifadəçi adından deterministik rəng hesablayır.
// Eyni ad hər zaman eyni rəngi qaytarır (hash-based).
// "Ali" → həmişə indigo, "Leyla" → həmişə pink kimi.
//
// Hash nədir? Bir string-i rəqəmə çevirmək üçün riyazi əməliyyat.
export function getAvatarColor(name) {
  if (!name) return avatarColors[0]; // Ad yoxdur → ilk rəng (indigo)
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    // charCodeAt(i): hərfin ASCII kodu (məsələn "A" = 65)
    // (hash << 5) - hash: hash * 31 — bu hash funksiyasında standart çarpan
    // Hər hərf hash-ə əlavə olunur
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  // Math.abs(hash): mənfi ola bilər, mütləq dəyər götür
  // % avatarColors.length: 0-11 arasında index əldə et
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

// ─── formatTime ──────────────────────────────────────────────────────────────
// Conversation list-dəki son mesajın vaxtını formatlaşdırır.
// Bu gün → "14:30", Dünən → "Yesterday", Bu həftə → "Mon", Köhnə → "Jan 5"
// .NET-də: DateTime.ToString("HH:mm") kimi amma daha "ağıllı"
export function formatTime(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString); // string-dən Date obyekti
  const now = new Date(); // İndiki vaxt
  // Günlər arasındakı fərq: millisaniyəni → günə çevir
  const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    // Bu gün → "14:30" formatı (Azərbaycan locale)
    return date.toLocaleTimeString("az-AZ", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } else if (diffDays === 1) {
    return "Yesterday"; // Dünən
  } else if (diffDays < 7) {
    // Bu həftə → qısa gün adı: "Mon", "Tue"...
    return date.toLocaleDateString("en-US", { weekday: "short" });
  } else {
    // 7 gündən köhnə → "Jan 5" formatı
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  }
}

// ─── formatMessageTime ────────────────────────────────────────────────────────
// Mesaj bubble-ında görünən vaxt (sadəcə saat:dəqiqə).
// "2026-02-21T14:30:00Z" → "14:30"
export function formatMessageTime(dateString) {
  const date = new Date(dateString);
  return date.toLocaleTimeString("az-AZ", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── getLastSeenText ──────────────────────────────────────────────────────────
// Chat header-da "Last seen X min ago" mətnini qaytarır.
// Fərqli vaxt intervalları üçün fərqli mətn.
export function getLastSeenText(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date; // Millisaniyə fərqi
  const diffMins = Math.floor(diffMs / 60000); // Dəqiqə fərqi
  const diffHours = Math.floor(diffMs / 3600000); // Saat fərqi
  const diffDays = Math.floor(diffMs / 86400000); // Gün fərqi

  if (diffMins < 1) return "Last seen just now";
  if (diffMins < 60) return `Last seen ${diffMins} min ago`; // Template literal: ${variable}
  if (diffHours < 24) return `Last seen ${diffHours} hours ago`; // .NET-də: $"Last seen {hours} hours ago"
  return `Last seen ${diffDays} days ago`;
}

// ─── formatSectionDate ───────────────────────────────────────────────────────
// Sidebar panel section headers üçün tam tarix formatı
// "Monday, March 14, 2026" — həmişə eyni format, today/yesterday yoxdur
export function formatSectionDate(dateString) {
  return new Date(dateString).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// ─── formatRelativeDate ─────────────────────────────────────────────────────
// Today → vaxt göstər, Yesterday → "yesterday", digər → short date
export function formatRelativeDate(dateString) {
  const d = new Date(dateString);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();
  if (isToday)
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (isYesterday) return "yesterday";
  if (d.getFullYear() === now.getFullYear()) {
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ─── formatDateSeparator ──────────────────────────────────────────────────────
// Tarix separator-u üçün label formatı:
//   Bugün      → "Today"
//   Dünən      → "Yesterday"
//   Eyni il    → "Monday, December 22"
//   Fərqli il  → "Monday, November 11, 2024"
function formatDateSeparator(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  // Gün fərqi — local timezone-da müqayisə
  const dateDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((today - dateDay) / 86400000);

  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";

  // Fərqli il → "Monday, November 11, 2024"
  if (date.getFullYear() !== now.getFullYear()) {
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }
  // Eyni il → "Monday, December 22"
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

// ─── groupMessagesByDate ──────────────────────────────────────────────────────
// Mesajları tarixə görə qruplaşdırır — aralarına date separator əlavə edir.
//
// Input: [msg1(today), msg2(today), msg3(yesterday)]
// Output: [
//   { type: "date", label: "Yesterday" },
//   { type: "message", data: msg3 },
//   { type: "date", label: "Today" },
//   { type: "message", data: msg1 },
//   { type: "message", data: msg2 },
// ]
//
// Chat.jsx bu array-i .map() ilə render edir:
//   type === "date" → <div class="date-separator">
//   type === "readLater" → <div class="read-later-separator">
//   type === "message" → <MessageBubble />
//
// readLaterMessageId (optional) — "sonra oxu" olaraq işarələnmiş mesajın id-si.
// newMessagesStartId (optional) — ilk oxunmamış mesajın id-si.
// Varsa, həmin mesajdan ƏVVƏL müvafiq separator əlavə olunur.
// msgs DESC sırada gəlir (yeni→köhnə) — copy+reverse əvəzinə tərsinə iterate edirik
export function groupMessagesByDate(
  msgs,
  readLaterMessageId,
  newMessagesStartId,
) {
  const groups = [];
  let currentDateKey = ""; // Müqayisə açarı (sabit format)

  // DESC array-ı tərsinə iterate et — ASC nəticə ver (copy+reverse əvəzinə)
  for (let i = msgs.length - 1; i >= 0; i--) {
    const msg = msgs[i];
    // Müqayisə üçün sabit tarix açarı: "2026-02-21"
    const d = new Date(msg.createdAtUtc);
    const dateKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

    // Yeni tarix başlayırsa — date separator əlavə et
    if (dateKey !== currentDateKey) {
      currentDateKey = dateKey;
      // Görüntü üçün nisbi format: Today, Yesterday, və ya tam tarix
      const label = formatDateSeparator(msg.createdAtUtc);
      groups.push({ type: "date", label });
    }

    // Read later separator — işarələnmiş mesajdan ƏVVƏL göstər
    if (readLaterMessageId && msg.id === readLaterMessageId) {
      groups.push({ type: "readLater" });
    }

    // New messages separator — ilk oxunmamış mesajdan ƏVVƏL göstər
    if (newMessagesStartId && msg.id === newMessagesStartId) {
      groups.push({ type: "newMessages" });
    }

    groups.push({ type: "message", data: msg }); // Mesajı əlavə et
  }
  return groups;
}

// ─── Mention Utility Funksiyaları ─────────────────────────────────────────────

/**
 * Textarea-da caret pozisiyasına əsasən @ mention trigger-i aşkar et.
 * @param {string} text — textarea-nın tam dəyəri
 * @param {number} caretPos — caret pozisiyası (selectionStart)
 * @returns {{ searchText: string, mentionStart: number } | null}
 */
export function detectMentionTrigger(text, caretPos) {
  const before = text.substring(0, caretPos);
  const lastAt = before.lastIndexOf("@");
  if (lastAt === -1) return null;

  // @ söz başlanğıcında olmalıdır (əvvəl whitespace, newline və ya mətinin başı)
  if (lastAt > 0 && !/\s/.test(before[lastAt - 1])) return null;

  // @ dan sonra newline varsa — artıq mention deyil
  const afterAt = before.substring(lastAt + 1);
  if (afterAt.includes("\n")) return null;

  return { searchText: afterAt, mentionStart: lastAt };
}

/**
 * Mesaj mətnini mention segmentlərinə ayır.
 * @param {string} content — mesaj mətni
 * @param {Array|null} mentions — [{ userId, userFullName, isAllMention }]
 * @returns {Array} [{ type: 'text'|'mention', text, userId?, userFullName?, isAll? }]
 */
// getMessagePreview — mesajın qısa preview mətni (conversation list, pinned, favorites)
// Image-only → "[Image]", Image + text → "[Image] text", File-only → "[File]", File + text → "[File] text"
export function getMessagePreview(msg) {
  const ct = msg.fileContentType || msg.fileContenttype || "";
  const isImage = ct.startsWith("image/");
  if (msg.content && msg.fileId) {
    return isImage ? `[Image] ${msg.content}` : `[File] ${msg.content}`;
  }
  if (!msg.content && msg.fileId) {
    return isImage ? "[Image]" : "[File]";
  }
  return msg.content || "";
}

export function parseMentions(content, mentions) {
  if (!mentions || mentions.length === 0 || !content) {
    return [{ type: "text", text: content }];
  }

  // Mention pattern-lərini hazırla (@ olmadan — @ yalnız trigger-dir)
  const patterns = mentions.map((m) => ({
    pattern: m.isAllMention
      ? "All members"
      : m.userFullName || m.mentionedUserFullName,
    userId: m.userId || m.mentionedUserId,
    userFullName: m.userFullName || m.mentionedUserFullName,
    isAll: !!m.isAllMention,
  }));

  const segments = [];
  let remaining = content;

  while (remaining.length > 0) {
    let earliest = remaining.length;
    let match = null;

    for (const p of patterns) {
      const idx = remaining.indexOf(p.pattern);
      if (idx !== -1 && idx < earliest) {
        earliest = idx;
        match = p;
      }
    }

    if (!match) {
      segments.push({ type: "text", text: remaining });
      break;
    }

    if (earliest > 0) {
      segments.push({ type: "text", text: remaining.substring(0, earliest) });
    }

    segments.push({
      type: "mention",
      text: match.pattern,
      userId: match.userId,
      userFullName: match.userFullName,
      isAll: match.isAll,
    });

    remaining = remaining.substring(earliest + match.pattern.length);
  }

  return segments;
}

// ─── mergeMessageWithPrev ────────────────────────────────────────────────────
// API-dən gələn mesajı əvvəlki SignalR state ilə birləşdirir
// SignalR status/readBy daha yüksəkdirsə — onu saxla (race condition qoruması)
export function mergeMessageWithPrev(msg, prev) {
  if (!prev) return msg;
  let merged = msg;
  if (prev.status !== undefined && prev.status > msg.status) {
    merged = { ...merged, status: prev.status, isRead: prev.status >= 3 };
  }
  if (
    prev.readByCount !== undefined &&
    prev.readByCount > (msg.readByCount || 0)
  ) {
    merged = { ...merged, readByCount: prev.readByCount, readBy: prev.readBy };
  }
  return merged;
}

// ─── computeOptimisticReactions ──────────────────────────────────────────────
// Reaction toggle-u lokal hesablayır (API çağırışından əvvəl UI-da göstərmək üçün).
// Server cavabı gəldikdə authoritative data ilə əvəz olunacaq.
export function computeOptimisticReactions(
  reactions,
  emoji,
  userId,
  userFullName,
) {
  const prev = reactions || [];
  const idx = prev.findIndex((r) => r.emoji === emoji);

  if (idx === -1) {
    // Yeni emoji — əlavə et
    return [
      ...prev,
      { emoji, count: 1, userIds: [userId], userFullNames: [userFullName] },
    ];
  }

  const existing = prev[idx];
  const userIdx = existing.userIds?.indexOf(userId) ?? -1;

  if (userIdx !== -1) {
    // İstifadəçi artıq react edib → sil (toggle off)
    if (existing.count <= 1) {
      // Son reaction idi → bütün entry-ni sil
      return prev.filter((_, i) => i !== idx);
    }
    return prev.map((r, i) =>
      i === idx
        ? {
            ...r,
            count: r.count - 1,
            userIds: r.userIds.filter((id) => id !== userId),
            userFullNames: (r.userFullNames || []).filter(
              (_, j) => j !== userIdx,
            ),
          }
        : r,
    );
  }

  // İstifadəçi hələ react etməyib → əlavə et (toggle on)
  return prev.map((r, i) =>
    i === idx
      ? {
          ...r,
          count: r.count + 1,
          userIds: [...(r.userIds || []), userId],
          userFullNames: [...(r.userFullNames || []), userFullName],
        }
      : r,
  );
}

// ─── highlightMatches ─────────────────────────────────────────────────────────
// Mətndə axtarış sözünü tapıb {text, highlight} array qaytarır (case-insensitive)
// İstifadə: highlightMatches(text, query).map((p, i) => p.highlight ? <mark key={i}>{p.text}</mark> : p.text)
export function highlightMatches(text, query) {
  if (!query || !text) return null;
  const lower = text.toLowerCase();
  const parts = [];
  let last = 0;
  let idx = lower.indexOf(query, last);
  if (idx === -1) return null;
  while (idx !== -1) {
    if (idx > last) parts.push({ text: text.slice(last, idx) });
    parts.push({ text: text.slice(idx, idx + query.length), highlight: true });
    last = idx + query.length;
    idx = lower.indexOf(query, last);
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}
