// ─── useChatScroll.js — Custom Hook: Infinite Scroll for Chat ─────────────────
// Bu hook chat mesajları üçün "infinite scroll" pagination məntiğini idarə edir.
// Scroll listener (Chat.jsx) bu hook-un funksiyalarını çağırır.
//
// Problem: Chat-ı açanda yalnız son 30 mesaj yüklənir.
//   - Yuxarı scroll etdikdə → köhnə mesajlar yüklənir (handleStartReached)
//   - "Around" mesaja scroll etdikdə aşağı scroll edəndə → yeni mesajlar yüklənir (handleEndReached)
//
// DOM LIMIT: Maksimum 300 mesaj DOM-da saxlanılır.
//   - Yuxarı scroll (prepend): 300-dən çox olsa ən yeniləri trim et → hasMoreDown = true
//   - Aşağı scroll (append): 300-dən çox olsa ən köhnələri trim et → hasMore = true

import { useState, useRef } from "react";
import { apiGet } from "../services/api";
import { getChatEndpoint, MESSAGE_PAGE_SIZE } from "../utils/chatUtils";

// DOM-da saxlanılan maksimum mesaj sayı — performans qoruması
const MAX_VISIBLE_MESSAGES = 300;

// ─── useChatScroll ────────────────────────────────────────────────────────────
// messages: hal-hazırdakı mesajlar array-ı (ən yeni index 0-da, ən köhnə sonda)
// selectedChat: hansı chat açıqdır
// setMessages: messages state-ini yeniləmək üçün
// allReadPatchRef: unreadCount===0 ilə girdikdə true — scroll ilə yüklənən mesajları isRead:true patch et
export default function useChatScroll(messages, selectedChat, setMessages, allReadPatchRef, messagesAreaRef) {

  // loadingMoreRef: hal-hazırda köhnə/yeni mesajlar yüklənirmi? (race condition önləmək üçün)
  const loadingMoreRef = useRef(false);

  // hasMoreRef: yuxarıda daha köhnə mesaj varmı? false → daha yükləmə
  const hasMoreRef = useRef(true);

  // hasMoreDownRef: aşağıda daha yeni mesaj varmı? (around scroll zamanı)
  const hasMoreDownRef = useRef(false);

  // loadOlderTriggeredRef: köhnə mesaj yükləndi — scroll listener guard
  // useLayoutEffect scroll correction bitənə qədər yeni handleStartReached çağırılmasını bloklayır
  const loadOlderTriggeredRef = useRef(false);

  // prependAnchorRef: scroll correction üçün — prepend əvvəli anchor elementin pozisiyası
  // useLayoutEffect (Chat.jsx) paint-dən əvvəl scroll offset-i düzəldir
  const prependAnchorRef = useRef(null);

  // loadingOlder: "köhnə mesajlar yüklənir" loading bar göstərmək üçün (UI state)
  const [loadingOlder, setLoadingOlder] = useState(false);

  // ─── handleStartReached ──────────────────────────────────────────────────────
  // Scroll listener trigger — istifadəçi yuxarıya yaxın olduqda çağırılır
  // Köhnə mesajları yükləyir (cursor-based pagination)
  async function handleStartReached() {
    if (loadingMoreRef.current) return;
    if (!hasMoreRef.current) return;
    if (!selectedChat) return;

    const oldestMsg = messages[messages.length - 1];
    if (!oldestMsg) return;

    const beforeDate = oldestMsg.createdAtUtc || oldestMsg.sentAt;
    if (!beforeDate) return;

    const base = getChatEndpoint(selectedChat.id, selectedChat.type, "/messages");
    if (!base) return;
    const endpoint = `${base}?pageSize=${MESSAGE_PAGE_SIZE}&before=${encodeURIComponent(beforeDate)}`;

    loadingMoreRef.current = true;
    setLoadingOlder(true);
    const loadStart = Date.now();

    try {
      const olderMessages = await apiGet(endpoint);

      if (!olderMessages || olderMessages.length === 0) {
        hasMoreRef.current = false;
        return;
      }

      // ─── Anchor capture — scroll correction üçün ─────────────────────────
      const area = messagesAreaRef?.current;
      if (area) {
        const bubbles = area.querySelectorAll("[data-bubble-id]");
        const containerTop = area.getBoundingClientRect().top;
        for (const bubble of bubbles) {
          const rect = bubble.getBoundingClientRect();
          if (rect.bottom > containerTop) {
            prependAnchorRef.current = {
              id: bubble.getAttribute("data-bubble-id"),
              relativeTop: rect.top - containerTop,
            };
            break;
          }
        }
      }

      // Prepend flash suppress — opacity:0 ilə gizlət, useLayoutEffect bərpa edəcək
      const scroller = messagesAreaRef?.current;
      if (scroller) {
        scroller.style.opacity = "0";
        if (scroller.parentElement) scroller.parentElement.style.opacity = "0";
      }

      setMessages((prev) => {
        const existingIds = new Set(prev.map((m) => m.id));
        const unique = olderMessages.filter((m) => !existingIds.has(m.id));
        if (unique.length === 0) return prev;
        loadOlderTriggeredRef.current = true;
        const final = unique.map((m) => {
          const patched = (allReadPatchRef?.current && !m.isRead) ? { ...m, isRead: true } : m;
          return patched === m ? { ...m, _prepended: true } : { ...patched, _prepended: true };
        });
        const merged = [...prev, ...final];

        // ─── DOM windowing: yuxarı scroll — 300-dən çox olsa ən yeniləri trim et ───
        if (merged.length > MAX_VISIBLE_MESSAGES) {
          hasMoreDownRef.current = true; // Trim etdik → aşağıda daha mesajlar var
          return merged.slice(merged.length - MAX_VISIBLE_MESSAGES);
        }
        return merged;
      });
    } catch (err) {
      console.error("Failed to load older messages:", err);
      if (err.message === "Session expired") {
        hasMoreRef.current = false;
      }
    } finally {
      const elapsed = Date.now() - loadStart;
      const minDuration = 400;
      if (elapsed < minDuration) {
        await new Promise((r) => setTimeout(r, minDuration - elapsed));
      }
      loadingMoreRef.current = false;
      setLoadingOlder(false);
    }
  }

  // ─── handleEndReached ──────────────────────────────────────────────────────────
  // Scroll listener trigger — istifadəçi aşağıya yaxın olduqda çağırılır
  // Yalnız around mode / trim sonrası aktiv (hasMoreDownRef === true)
  async function handleEndReached() {
    if (loadingMoreRef.current) return;
    if (!hasMoreDownRef.current) return;
    if (!selectedChat) return;

    const newestMsg = messages[0];
    if (!newestMsg) return;

    const afterDate = newestMsg.createdAtUtc || newestMsg.sentAt;
    if (!afterDate) return;

    const base = getChatEndpoint(selectedChat.id, selectedChat.type, "/messages/after");
    if (!base) return;
    const endpoint = `${base}?date=${encodeURIComponent(afterDate)}&limit=${MESSAGE_PAGE_SIZE}`;

    loadingMoreRef.current = true;

    try {
      const newerMessages = await apiGet(endpoint);

      if (!newerMessages || newerMessages.length === 0) {
        hasMoreDownRef.current = false;
        return;
      }

      setMessages((prev) => {
        const existingIds = new Set(prev.map((m) => m.id));
        const unique = newerMessages.filter((m) => !existingIds.has(m.id));
        if (unique.length === 0) return prev;
        const reversed = unique.reverse();
        const final = reversed.map((m) => {
          const patched = (allReadPatchRef?.current && !m.isRead) ? { ...m, isRead: true } : m;
          return patched === m ? { ...m, _prepended: true } : { ...patched, _prepended: true };
        });
        const merged = [...final, ...prev];

        // ─── DOM windowing: aşağı scroll — 300-dən çox olsa ən köhnələri trim et ───
        if (merged.length > MAX_VISIBLE_MESSAGES) {
          hasMoreRef.current = true; // Trim etdik → yuxarıda daha mesajlar var
          return merged.slice(0, MAX_VISIBLE_MESSAGES);
        }
        return merged;
      });
    } catch (err) {
      console.error("Failed to load newer messages:", err);
      if (err.message === "Session expired") {
        hasMoreDownRef.current = false;
      }
    } finally {
      loadingMoreRef.current = false;
    }
  }

  return {
    handleStartReached,
    handleEndReached,
    hasMoreRef,
    hasMoreDownRef,
    loadingOlder,
    loadOlderTriggeredRef,
    loadingMoreRef,
    prependAnchorRef,
  };
}
