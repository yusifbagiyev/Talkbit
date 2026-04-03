// ─── useChannelManagement.js — Custom Hook: Channel Yaratma/Redaktə + Üzv İdarəsi ─
// Bu hook channel paneli və add member paneli ilə bağlı state-ləri,
// üzv idarəsi funksiyalarını və debounced search effektini idarə edir.
// handleOpenCreateChannel, handleEditChannel, handleChannelCreated, handleChannelUpdated
// Chat.jsx-də qalır — çoxlu cross-cutting dependency var.

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { apiGet, apiPost, apiPut, apiDelete } from "../services/api";

// ─── useChannelManagement ────────────────────────────────────────────────────
// selectedChat: hansı chat açıqdır
// conversations: bütün söhbət siyahısı (addMemberUsers memo üçün)
// channelMembers: channel üzvlərinin lookup map-i
// setChannelMembers: channel üzvlərini yeniləmək üçün
// showMembersPanel: members paneli açıqdırsa refreshChannelMembers paneli də yeniləyir
// loadMembersPanelPage: useSidebarPanels-dən gələn paginated yükləmə funksiyası
export default function useChannelManagement(
  selectedChat,
  conversations,
  channelMembers,
  setChannelMembers,
  showMembersPanel,
  loadMembersPanelPage,
) {
  // ─── Channel yaratma/redaktə state-ləri ────────────────────────────────────
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [editChannelData, setEditChannelData] = useState(null);

  // ─── Add member state-ləri ─────────────────────────────────────────────────
  const [showAddMember, setShowAddMember] = useState(false);
  const [addMemberSearch, setAddMemberSearch] = useState("");
  const [addMemberSearchActive, setAddMemberSearchActive] = useState(false);
  const [addMemberSelected, setAddMemberSelected] = useState(new Set());
  const [addMemberInviting, setAddMemberInviting] = useState(false);
  const [addMemberSearchResults, setAddMemberSearchResults] = useState([]);
  const [addMemberShowHistory, setAddMemberShowHistory] = useState(true);
  // Seçilən user-lərin məlumatları — search təmizlənsə belə chip-lərdə ad/avatar görünsün
  const [addMemberSelectedInfo, setAddMemberSelectedInfo] = useState(new Map());

  // ─── Error feedback state — istifadəçiyə xəta göstərmək üçün ─────────────
  const [inviteError, setInviteError] = useState(null);
  const [actionError, setActionError] = useState(null);

  // ─── Ref ───────────────────────────────────────────────────────────────────
  const addMemberRef = useRef(null);
  const selectedChatRef = useRef(selectedChat);
  selectedChatRef.current = selectedChat;
  const showMembersPanelRef = useRef(showMembersPanel);
  showMembersPanelRef.current = showMembersPanel;

  // ─── refreshChannelMembers ─────────────────────────────────────────────────
  // Channel members cache-ini yenilə + members paneli açıqdırsa onu da yenilə
  const refreshChannelMembers = useCallback(
    async (channelId) => {
      try {
        const members = await apiGet(
          `/api/channels/${channelId}/members?take=100`,
        );
        setChannelMembers((prev) => ({
          ...prev,
          [channelId]: members.reduce(
            (map, m) => ({ ...map, [m.userId]: m }),
            {},
          ),
        }));
        if (showMembersPanelRef.current) {
          loadMembersPanelPage(channelId, 0, true);
        }
      } catch {
        /* ignore */
      }
    },
    [setChannelMembers, loadMembersPanelPage],
  );

  // ─── handleMakeAdmin ───────────────────────────────────────────────────────
  const handleMakeAdmin = useCallback(
    async (targetUserId) => {
      const chat = selectedChatRef.current;
      if (!chat) return;
      setActionError(null);
      try {
        await apiPut(`/api/channels/${chat.id}/members/${targetUserId}/role`, {
          newRole: 2,
        });
        await refreshChannelMembers(chat.id);
      } catch {
        setActionError("Admin etmək mümkün olmadı");
      }
    },
    [refreshChannelMembers],
  );

  // ─── handleRemoveAdmin ─────────────────────────────────────────────────────
  const handleRemoveAdmin = useCallback(
    async (targetUserId) => {
      const chat = selectedChatRef.current;
      if (!chat) return;
      setActionError(null);
      try {
        await apiPut(`/api/channels/${chat.id}/members/${targetUserId}/role`, {
          newRole: 1,
        });
        await refreshChannelMembers(chat.id);
      } catch {
        setActionError("Admin statusunu silmək mümkün olmadı");
      }
    },
    [refreshChannelMembers],
  );

  // ─── handleRemoveFromChat ──────────────────────────────────────────────────
  const handleRemoveFromChat = useCallback(
    async (targetUserId) => {
      const chat = selectedChatRef.current;
      if (!chat) return;
      setActionError(null);
      try {
        await apiDelete(`/api/channels/${chat.id}/members/${targetUserId}`);
        await refreshChannelMembers(chat.id);
      } catch {
        setActionError("Üzvü silmək mümkün olmadı");
      }
    },
    [refreshChannelMembers],
  );

  // ─── handleInviteMembers ───────────────────────────────────────────────────
  // Promise.all ilə paralel invite — 10 user üçün 10 ardıcıl request əvəzinə 1 batch
  const handleInviteMembers = useCallback(async () => {
    const chat = selectedChatRef.current;
    if (addMemberSelected.size === 0 || !chat) return;
    setAddMemberInviting(true);
    try {
      const results = await Promise.allSettled(
        [...addMemberSelected].map((userId) =>
          apiPost(`/api/channels/${chat.id}/members`, {
            userId,
            showChatHistory: addMemberShowHistory,
          }),
        ),
      );

      const failed = results.filter((r) => r.status === "rejected");
      if (failed.length > 0) {
        setInviteError(`${failed.length} üzvü dəvət etmək mümkün olmadı`);
      }

      await refreshChannelMembers(chat.id);
      setShowAddMember(false);
      setAddMemberSearch("");
      setAddMemberSearchActive(false);
      setAddMemberSelected(new Set());
      setAddMemberShowHistory(true);
    } catch {
      setInviteError("Üzvləri dəvət edərkən xəta baş verdi");
    } finally {
      setAddMemberInviting(false);
    }
  }, [addMemberSelected, addMemberShowHistory, refreshChannelMembers]);

  // ─── Add member panel açılanda channel members yenilə ─────────────────────
  useEffect(() => {
    if (!showAddMember || !selectedChat || selectedChat.type !== 1) return;
    let cancelled = false;
    (async () => {
      try {
        const members = await apiGet(
          `/api/channels/${selectedChat.id}/members?take=100`,
        );
        if (cancelled) return;
        setChannelMembers((prev) => ({
          ...prev,
          [selectedChat.id]: members.reduce(
            (map, m) => ({ ...map, [m.userId]: m }),
            {},
          ),
        }));
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAddMember]);

  // ─── Add member debounced backend search ───────────────────────────────────
  useEffect(() => {
    const query = addMemberSearch.trim();
    if (query.length < 2) {
      setAddMemberSearchResults([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const data = await apiGet(
          `/api/users/search?q=${encodeURIComponent(query)}`,
        );
        if (cancelled) return;
        setAddMemberSearchResults(data || []);
      } catch {
        if (!cancelled) setAddMemberSearchResults([]);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [addMemberSearch]);

  // ─── addMemberUsers memo ───────────────────────────────────────────────────
  // DM conversations-dan istifadəçiləri göstər, üzv olanları isMember ilə işarələ
  const addMemberUsers = useMemo(() => {
    if (!showAddMember || !selectedChat) return [];
    const existingIds = channelMembers[selectedChat.id]
      ? new Set(Object.keys(channelMembers[selectedChat.id]))
      : new Set();
    return conversations
      .filter((c) => c.type === 0 && !c.isNotes && c.otherUserId)
      .map((c) => ({
        id: c.otherUserId,
        fullName: c.name,
        avatarUrl: c.avatarUrl,
        position: c.otherUserPosition || "User",
        isMember: existingIds.has(c.otherUserId),
      }));
  }, [showAddMember, selectedChat, conversations, channelMembers]);

  // ─── resetChannelState — handleSelectChat-da çağırılır ─────────────────────
  const resetChannelState = useCallback(() => {
    setShowAddMember(false);
    setAddMemberSearch("");
    setAddMemberSearchActive(false);
    setAddMemberSelected(new Set());
    setAddMemberSelectedInfo(new Map());
    setInviteError(null);
    setActionError(null);
  }, []);

  return {
    // Channel create/edit
    showCreateChannel,
    setShowCreateChannel,
    editChannelData,
    setEditChannelData,
    // Add member
    showAddMember,
    setShowAddMember,
    addMemberSearch,
    setAddMemberSearch,
    addMemberSearchActive,
    setAddMemberSearchActive,
    addMemberSelected,
    setAddMemberSelected,
    addMemberInviting,
    addMemberShowHistory,
    setAddMemberShowHistory,
    addMemberSearchResults,
    addMemberUsers,
    addMemberSelectedInfo,
    setAddMemberSelectedInfo,
    addMemberRef,
    // Error feedback
    inviteError,
    setInviteError,
    actionError,
    setActionError,
    // Functions
    refreshChannelMembers,
    handleMakeAdmin,
    handleRemoveAdmin,
    handleRemoveFromChat,
    handleInviteMembers,
    resetChannelState,
  };
}
