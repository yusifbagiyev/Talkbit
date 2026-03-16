// ─── useChatScroll.js — Custom Hook: Infinite Scroll for Chat (Virtuoso) ─────
// Bu hook chat mesajları üçün "infinite scroll" pagination məntiğini idarə edir.
// Scroll listener (Chat.jsx) bu hook-un funksiyalarını çağırır.
//
// Problem: Chat-ı açanda yalnız son 30 mesaj yüklənir.
//   - Yuxarı scroll etdikdə → köhnə mesajlar yüklənir (handleStartReached)
//   - "Around" mesaja scroll etdikdə aşağı scroll edəndə → yeni mesajlar yüklənir (handleEndReached)

import { useState, useRef } from "react";
import { apiGet } from "../services/api";
import { getChatEndpoint, MESSAGE_PAGE_SIZE } from "../utils/chatUtils";

// ─── useChatScroll ────────────────────────────────────────────────────────────
// messages: hal-hazırdakı mesajlar array-ı (ən yeni index 0-da, ən köhnə sonda)
// selectedChat: hansı chat açıqdır
// setMessages: messages state-ini yeniləmək üçün
// allReadPatchRef: unreadCount===0 ilə girdikdə true — scroll ilə yüklənən mesajları isRead:true patch et
export default function useChatScroll(messages, selectedChat, setMessages, allReadPatchRef) {

  // loadingMoreRef: hal-hazırda köhnə/yeni mesajlar yüklənirmi? (race condition önləmək üçün)
  const loadingMoreRef = useRef(false);

  // hasMoreRef: yuxarıda daha köhnə mesaj varmı? false → daha yükləmə
  const hasMoreRef = useRef(true);

  // hasMoreDownRef: aşağıda daha yeni mesaj varmı? (around scroll zamanı)
  const hasMoreDownRef = useRef(false);

  // loadOlderTriggeredRef: köhnə mesaj yükləndi → Chat.jsx firstItemIndex-i azaltmalıdır
  // Həmçinin scroll listener guard kimi istifadə olunur — Virtuoso firstItemIndex-i
  // tətbiq edənə qədər yeni handleStartReached çağırılmasını bloklayır
  const loadOlderTriggeredRef = useRef(false);

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

      // loadOlderTriggeredRef yalnız YENİ mesajlar əlavə olunduqda true olur
      // Bu, Chat.jsx-in firstItemIndex-i azaltmasını və scroll listener-in
      // Virtuoso pozisiyanı bərpa edənə qədər yeni fetch başlatmamasını təmin edir
      let hasNew = false;
      setMessages((prev) => {
        const existingIds = new Set(prev.map((m) => m.id));
        const unique = olderMessages.filter((m) => !existingIds.has(m.id));
        if (unique.length === 0) return prev;
        hasNew = true;
        const final = allReadPatchRef?.current
          ? unique.map((m) => m.isRead ? m : { ...m, isRead: true })
          : unique;
        return [...prev, ...final];
      });

      if (hasNew) loadOlderTriggeredRef.current = true;
    } catch (err) {
      console.error("Failed to load older messages:", err);
      if (err.message === "Session expired") {
        hasMoreRef.current = false;
      }
    } finally {
      // Minimum 400ms göstər — loading bar-ın CSS transition ilə görünməsini təmin et
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
  // Yalnız around mode-da aktiv (hasMoreDownRef === true)
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
        const final = allReadPatchRef?.current
          ? reversed.map((m) => m.isRead ? m : { ...m, isRead: true })
          : reversed;
        return [...final, ...prev];
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
  };
}
