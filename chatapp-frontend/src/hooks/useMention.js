// ─── useMention.js — Custom Hook: @ Mention Sistemi ─────────────────────────
// Bu hook mention autocomplete məntiqini idarə edir:
//   - @ yazıldıqda panel açılır
//   - Lokal + API axtarışı (debounced)
//   - Keyboard navigation (ArrowUp/Down/Enter/Tab/Escape)
//   - Seçilmiş mention-ların göndərmə üçün hazırlanması

import { useState, useRef, useEffect, useCallback } from "react";
import { apiGet } from "../services/api";
import { detectMentionTrigger } from "../utils/chatUtils";

// ─── useMention ─────────────────────────────────────────────────────────────
// selectedChat: hansı chat açıqdır
// channelMembers: channel üzvlərinin lookup map-i
// conversations: bütün söhbət siyahısı (recent users üçün)
// user: cari istifadəçi
// inputRef: textarea DOM referansı
// messageText: cari mesaj mətni (handleMentionSelect üçün)
// setMessageText: mesaj mətnini yeniləmək üçün
export default function useMention({ selectedChat, channelMembers, conversations, user, inputRef, messageText, setMessageText }) {

  // ─── State-lər ────────────────────────────────────────────────────────────
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionSearch, setMentionSearch] = useState("");
  const [mentionItems, setMentionItems] = useState([]);
  const [mentionSelectedIndex, setMentionSelectedIndex] = useState(0);
  const [mentionLoading, setMentionLoading] = useState(false);

  // ─── Ref-lər ──────────────────────────────────────────────────────────────
  const mentionStartRef = useRef(-1);          // @ simvolunun textarea pozisiyası
  const mentionPanelRef = useRef(null);        // Click-outside ref
  const mentionSearchTimerRef = useRef(null);  // Debounce timer
  const activeMentionsRef = useRef([]);        // Seçilmiş mention-lar (göndərmə üçün)
  const conversationsRef = useRef(conversations); // conversations ref — useEffect dep-dən çıxarır
  conversationsRef.current = conversations;
  const channelMembersRef = useRef(channelMembers); // channelMembers ref — useEffect dep-dən çıxarır
  channelMembersRef.current = channelMembers;
  const messageTextRef = useRef(messageText);        // messageText ref — useCallback dep-dən çıxarır
  messageTextRef.current = messageText;
  const mentionItemsRef = useRef(mentionItems);      // mentionItems ref — useCallback dep-dən çıxarır
  mentionItemsRef.current = mentionItems;
  const mentionSelectedIndexRef = useRef(mentionSelectedIndex); // mentionSelectedIndex ref
  mentionSelectedIndexRef.current = mentionSelectedIndex;

  // ─── closeMentionPanel ─────────────────────────────────────────────────────
  const closeMentionPanel = useCallback(() => {
    setMentionOpen(false);
    setMentionSearch("");
    setMentionItems([]);
    setMentionSelectedIndex(0);
    mentionStartRef.current = -1;
    if (mentionSearchTimerRef.current) {
      clearTimeout(mentionSearchTimerRef.current);
    }
  }, []);

  // ─── detectMentionInText ───────────────────────────────────────────────────
  // Textarea dəyişdikdə @ trigger yoxla (handleMessageTextChange-dən çağırılır)
  // onCloseEmoji: emoji panel açıqdırsa bağlamaq üçün callback
  const detectMentionInText = useCallback((newText, caretPos, onCloseEmoji) => {
    const trigger = detectMentionTrigger(newText, caretPos);
    if (trigger) {
      mentionStartRef.current = trigger.mentionStart;
      setMentionSearch(trigger.searchText);
      if (!mentionOpen) setMentionOpen(true);
      setMentionSelectedIndex(0);
      if (onCloseEmoji) onCloseEmoji();
    } else {
      if (mentionOpen) closeMentionPanel();
    }
  }, [mentionOpen, closeMentionPanel]);

  // ─── handleMentionSelect ──────────────────────────────────────────────────
  // Mention elementi seçildikdə (paneldən klik və ya Enter/Tab)
  const handleMentionSelect = useCallback((item) => {
    const textarea = inputRef.current;
    if (!textarea) return;

    const currentText = messageTextRef.current;
    const start = mentionStartRef.current;
    const caretPos = textarea.selectionStart;

    // @searchText → FullName əvəz et (@ olmadan — @ yalnız trigger-dir)
    const before = currentText.substring(0, start);
    const after = currentText.substring(caretPos);
    const mentionText = item.isAll ? "All members" : item.fullName;
    const newValue = before + mentionText + " " + after;

    setMessageText(newValue);
    closeMentionPanel();

    // activeMentionsRef-ə əlavə et (göndərmə zamanı istifadə olunacaq)
    if (item.isAll) {
      activeMentionsRef.current.push({
        userId: null, userFullName: "All", isAllMention: true,
      });
    } else if (item.type === "channel") {
      activeMentionsRef.current.push({
        userId: item.id, userFullName: item.fullName, isAllMention: false, isChannel: true,
      });
    } else {
      activeMentionsRef.current.push({
        userId: item.id, userFullName: item.fullName, isAllMention: false,
      });
    }

    // Caret pozisiyasını mention-dan sonraya qoy
    const newCaretPos = before.length + mentionText.length + 1;
    requestAnimationFrame(() => {
      textarea.setSelectionRange(newCaretPos, newCaretPos);
      textarea.focus();
    });
  }, [inputRef, setMessageText, closeMentionPanel]);

  // ─── handleMentionKeyDown ──────────────────────────────────────────────────
  // Mention panel keyboard navigation — true qaytarırsa event handle olunub
  const handleMentionKeyDown = useCallback((e) => {
    const items = mentionItemsRef.current;
    if (!mentionOpen || items.length === 0) return false;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setMentionSelectedIndex((prev) =>
        prev < items.length - 1 ? prev + 1 : 0
      );
      return true;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setMentionSelectedIndex((prev) =>
        prev > 0 ? prev - 1 : items.length - 1
      );
      return true;
    }
    if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      handleMentionSelect(items[mentionSelectedIndexRef.current]);
      return true;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      closeMentionPanel();
      return true;
    }
    return false;
  }, [mentionOpen, handleMentionSelect, closeMentionPanel]);

  // ─── prepareMentionsForSend ────────────────────────────────────────────────
  // Göndərmə zamanı mention-ları hazırla və activeMentionsRef-i sıfırla
  const prepareMentionsForSend = useCallback((text, chatType) => {
    const mentionsToSend = activeMentionsRef.current
      .filter((m) => {
        if (m.isAllMention) return text.includes("All members");
        if (m.isChannel) return false;
        return text.includes(m.userFullName);
      })
      .map((m) => ({
        userId: m.userId,
        userFullName: m.userFullName,
        ...(chatType === 1 ? { isAllMention: !!m.isAllMention } : {}),
      }));
    activeMentionsRef.current = [];
    return mentionsToSend;
  }, []);

  // ─── resetMention ──────────────────────────────────────────────────────────
  // handleSelectChat-da çağırılır (state sıfırlama)
  const resetMention = useCallback(() => {
    closeMentionPanel();
    activeMentionsRef.current = [];
  }, [closeMentionPanel]);

  // ─── Mention search useEffect ─────────────────────────────────────────────
  useEffect(() => {
    if (!mentionOpen || !selectedChat) return;

    let localResults = [];

    if (selectedChat.type === 1) {
      // ── Channel: "All members" + üzvlər ──
      const allItem = { id: null, fullName: "All members", type: "all", isAll: true };
      const members = channelMembersRef.current[selectedChat.id] || {};
      const memberList = Object.entries(members)
        .filter(([uid]) => uid !== user.id)
        .map(([uid, m]) => ({
          id: uid,
          fullName: m.fullName,
          position: m.role === 3 ? "Owner" : m.role === 2 ? "Admin" : "User",
          type: "user",
          isAll: false,
        }));

      if (mentionSearch) {
        const q = mentionSearch.toLowerCase();
        const filtered = memberList.filter((m) =>
          m.fullName.toLowerCase().includes(q)
        );
        if ("all members".includes(q) || "all".startsWith(q)) {
          localResults = [allItem, ...filtered];
        } else {
          localResults = filtered;
        }
      } else {
        localResults = [allItem, ...memberList];
      }
    } else if (selectedChat.type === 0 || selectedChat.type === 2) {
      // ── DM / DepartmentUser: digər istifadəçini göstər ──
      const otherUser = {
        id: selectedChat.otherUserId || selectedChat.userId || selectedChat.id,
        fullName: selectedChat.name,
        position: selectedChat.otherUserPosition || selectedChat.positionName || "User",
        type: "user",
        isAll: false,
      };

      if (mentionSearch) {
        const q = mentionSearch.toLowerCase();
        if (otherUser.fullName.toLowerCase().includes(q)) {
          localResults = [otherUser];
        }
      } else {
        localResults = [otherUser];
      }
    }

    // Recent chats-dan istifadəçiləri əlavə et
    const existingLocalIds = new Set(localResults.map((r) => r.id).filter(Boolean));
    existingLocalIds.add(user.id);
    const recentUsers = conversationsRef.current
      .filter((c) => (c.type === 0 || c.type === 2) && c.id !== selectedChat.id)
      .filter((c) => {
        const uid = c.otherUserId || c.userId || c.id;
        return uid && !existingLocalIds.has(uid);
      })
      .slice(0, 5)
      .map((c) => ({
        id: c.otherUserId || c.userId || c.id,
        fullName: c.name,
        position: c.otherUserPosition || c.positionName || "User",
        type: "user",
        isAll: false,
      }));

    if (mentionSearch) {
      const q = mentionSearch.toLowerCase();
      const filteredRecent = recentUsers.filter((u) =>
        u.fullName.toLowerCase().includes(q)
      );
      localResults = [...localResults, ...filteredRecent];
      const channelResults = conversationsRef.current
        .filter((c) => c.type === 1 && c.name && c.name.toLowerCase().includes(q))
        .filter((c) => c.id !== selectedChat.id)
        .slice(0, 5)
        .map((c) => ({
          id: c.id,
          fullName: c.name,
          type: "channel",
          isAll: false,
        }));
      localResults = [...localResults, ...channelResults];
    } else {
      localResults = [...localResults, ...recentUsers];
    }

    setMentionItems(localResults);
    setMentionSelectedIndex(0);

    // 2+ simvolda API sorğusu (debounced)
    if (mentionSearch.length >= 2) {
      if (mentionSearchTimerRef.current) clearTimeout(mentionSearchTimerRef.current);
      mentionSearchTimerRef.current = setTimeout(async () => {
        setMentionLoading(true);
        try {
          const users = await apiGet(
            `/api/users/search?q=${encodeURIComponent(mentionSearch)}`
          );
          const existingIds = new Set(localResults.map((r) => r.id).filter(Boolean));
          existingIds.add(user.id);
          const extra = (users || [])
            .filter((u) => !existingIds.has(u.id))
            .map((u) => ({
              id: u.id,
              fullName: u.fullName,
              position: u.position || "User",
              type: "user",
              isAll: false,
            }));
          if (extra.length > 0) {
            setMentionItems((prev) => [...prev, ...extra]);
          }
        } catch { /* silent */ }
        setMentionLoading(false);
      }, 300);
    }

    return () => {
      if (mentionSearchTimerRef.current) clearTimeout(mentionSearchTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mentionOpen, mentionSearch, selectedChat?.id, selectedChat?.type, user?.id]);

  // ─── Mention click-outside useEffect ───────────────────────────────────────
  useEffect(() => {
    if (!mentionOpen) return;
    function handleClickOutside(e) {
      if (
        mentionPanelRef.current &&
        !mentionPanelRef.current.contains(e.target) &&
        inputRef.current &&
        !inputRef.current.contains(e.target)
      ) {
        closeMentionPanel();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [mentionOpen, closeMentionPanel, inputRef]);

  return {
    mentionOpen,
    mentionItems,
    mentionSelectedIndex,
    mentionLoading,
    mentionPanelRef,
    activeMentionsRef,
    closeMentionPanel,
    handleMentionSelect,
    handleMentionKeyDown,
    detectMentionInText,
    prepareMentionsForSend,
    resetMention,
  };
}
