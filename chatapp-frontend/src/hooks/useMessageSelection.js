// ─── useMessageSelection.js — Custom Hook: Mesaj Seçmə Rejimi ─────────────
// Bu hook çox-mesaj seçmə (select mode) məntiqini idarə edir.
// SelectToolbar komponentindən istifadə olunan state-ləri və handler-ləri təmin edir.

import { useState, useCallback, useMemo } from "react";
import { apiPost, apiDelete } from "../services/api";
import { getChatEndpoint, BATCH_DELETE_THRESHOLD } from "../utils/chatUtils";

export default function useMessageSelection(
  selectedChat,
  messages,
  setMessages,
  user,
) {
  // selectMode — çox mesaj seçmə rejimi (true = SelectToolbar görünür)
  const [selectMode, setSelectMode] = useState(false);

  // selectedMessages — seçilmiş mesajların id-ləri (Set<messageId>)
  const [selectedMessages, setSelectedMessages] = useState(new Set());

  // deleteConfirmOpen — "Delete messages?" modal-ı açıq/bağlı (SelectToolbar — çox mesaj)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // handleEnterSelectMode — ilk mesajı seçdikdə select mode başlasın
  const handleEnterSelectMode = useCallback((msgId) => {
    setSelectMode(true);
    setSelectedMessages(new Set([msgId]));
  }, []);

  // handleToggleSelect — mesajı seç / seçimi ləğv et
  const handleToggleSelect = useCallback((msgId) => {
    setSelectedMessages((prev) => {
      const next = new Set(prev);
      if (next.has(msgId)) {
        next.delete(msgId);
      } else {
        next.add(msgId);
      }
      return next;
    });
  }, []);

  // handleExitSelectMode — select mode-dan çıx, seçimləri sıfırla
  const handleExitSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelectedMessages(new Set());
  }, []);

  // handleDeleteSelected — seçilmiş bütün mesajları sil (SelectToolbar-dan)
  const handleDeleteSelected = useCallback(async () => {
    if (!selectedChat || selectedMessages.size === 0) return;
    try {
      const ids = [...selectedMessages];
      const base = getChatEndpoint(
        selectedChat.id,
        selectedChat.type,
        "/messages",
      );
      if (!base) return;

      // Çox mesaj varsa batch delete, azdırsa paralel individual delete
      if (ids.length > BATCH_DELETE_THRESHOLD) {
        await apiPost(`${base}/batch-delete`, { messageIds: ids });
      } else {
        await Promise.all(ids.map((id) => apiDelete(`${base}/${id}`)));
      }

      // Soft delete — hamısını isDeleted: true et
      setMessages((prev) =>
        prev.map((m) => (ids.includes(m.id) ? { ...m, isDeleted: true } : m)),
      );
      handleExitSelectMode();
    } catch {
      /* ignore */
    }
  }, [selectedChat, selectedMessages, handleExitSelectMode, setMessages]);

  // hasOthersSelected — seçilmiş mesajların arasında başqasının mesajı varmı?
  // true olduqda Delete button deaktiv olur
  // Optimallaşdırılmış: messages-ı bir dəfə iterate edir, Set.has() ilə O(1) yoxlama — cəmi O(n)
  const hasOthersSelected = useMemo(() => {
    if (selectedMessages.size === 0) return false;
    for (const m of messages) {
      if (selectedMessages.has(m.id) && m.senderId !== user.id) return true;
    }
    return false;
  }, [selectedMessages, messages, user.id]);

  // resetSelection — handleSelectChat-da çağırılır (state sıfırlama)
  function resetSelection() {
    setSelectMode(false);
    setSelectedMessages(new Set());
    setDeleteConfirmOpen(false);
  }

  return {
    selectMode,
    selectedMessages,
    deleteConfirmOpen,
    setDeleteConfirmOpen,
    hasOthersSelected,
    handleEnterSelectMode,
    handleToggleSelect,
    handleExitSelectMode,
    handleDeleteSelected,
    resetSelection,
  };
}
