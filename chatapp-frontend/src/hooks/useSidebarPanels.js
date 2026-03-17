// ─── useSidebarPanels.js — Custom Hook: Sidebar Panel State & Məntiqi ────────
// Bu hook Chat.jsx-in sağ tərəfdəki Detail Sidebar panelinin
// state-lərini, ref-lərini, data yükləmə funksiyalarını və memo-larını idarə edir.
// JSX rendering hələlik Chat.jsx-də qalır (Mərhələ 4-də ayrı komponentə çıxarılacaq).

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { apiGet, apiPost, apiDelete } from "../services/api";
import { getChatEndpoint } from "../utils/chatUtils";

// ─── useSidebarPanels ────────────────────────────────────────────────────────
// selectedChat: hansı chat açıqdır
// messages: mesajlar (linkMessages, fileMessages memo üçün)
// channelMembers: channel üzvlərinin lookup map-i
// setChannelMembers: channel üzvlərini yeniləmək üçün
export default function useSidebarPanels(selectedChat, messages, channelMembers, setChannelMembers) {

  // ─── Core sidebar state ───────────────────────────────────────────────────
  const [showSidebar, setShowSidebar] = useState(false);
  const [showSidebarMenu, setShowSidebarMenu] = useState(false);

  // ─── Favorites panel ──────────────────────────────────────────────────────
  const [showFavorites, setShowFavorites] = useState(false);
  const [favoriteMessages, setFavoriteMessages] = useState([]);
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const [favMenuId, setFavMenuId] = useState(null);
  const [favSearchOpen, setFavSearchOpen] = useState(false);
  const [favSearchText, setFavSearchText] = useState("");

  // ─── All Links panel ──────────────────────────────────────────────────────
  const [showAllLinks, setShowAllLinks] = useState(false);
  const [linksMenuId, setLinksMenuId] = useState(null);
  const [linksSearchOpen, setLinksSearchOpen] = useState(false);
  const [linksSearchText, setLinksSearchText] = useState("");

  // ─── Chats with User panel ────────────────────────────────────────────────
  const [showChatsWithUser, setShowChatsWithUser] = useState(false);
  const [chatsWithUserData, setChatsWithUserData] = useState([]);
  const [chatsWithUserSource, setChatsWithUserSource] = useState(null);

  // ─── Files & Media panel ──────────────────────────────────────────────────
  const [showFilesMedia, setShowFilesMedia] = useState(false);
  const [filesMediaTab, setFilesMediaTab] = useState("media");
  const [filesMenuId, setFilesMenuId] = useState(null);
  const [filesSearchOpen, setFilesSearchOpen] = useState(false);
  const [filesSearchText, setFilesSearchText] = useState("");

  // ─── Members panel ────────────────────────────────────────────────────────
  const [showMembersPanel, setShowMembersPanel] = useState(false);
  const [membersPanelDirect, setMembersPanelDirect] = useState(false);
  const [memberMenuId, setMemberMenuId] = useState(null);
  const [membersPanelList, setMembersPanelList] = useState([]);
  const [membersPanelHasMore, setMembersPanelHasMore] = useState(true);
  const [membersPanelLoading, setMembersPanelLoading] = useState(false);

  // ─── Ref-lər (click-outside üçün) ─────────────────────────────────────────
  const sidebarMenuRef = useRef(null);
  const favMenuRef = useRef(null);
  const linksMenuRef = useRef(null);
  const filesMenuRef = useRef(null);
  const memberMenuRef = useRef(null);

  // ─── loadFavoriteMessages ──────────────────────────────────────────────────
  const loadFavoriteMessages = useCallback(async (chat) => {
    try {
      setFavoritesLoading(true);
      const endpoint = getChatEndpoint(chat.id, chat.type, "/messages/favorites");
      if (!endpoint) return;
      const data = await apiGet(endpoint);
      const sorted = (data || []).sort(
        (a, b) => new Date(b.favoritedAtUtc) - new Date(a.favoritedAtUtc),
      );
      setFavoriteMessages(sorted);
    } catch (err) {
      console.error("Failed to load favorite messages:", err);
      setFavoriteMessages([]);
    } finally {
      setFavoritesLoading(false);
    }
  }, []);

  // ─── handleFavoriteMessage — mesajı favorilərə əlavə et (Optimistic UI) ────
  const handleFavoriteMessage = useCallback(
    async (msg) => {
      if (!selectedChat) return;
      const endpoint = getChatEndpoint(
        selectedChat.id,
        selectedChat.type,
        `/messages/${msg.id}/favorite`,
      );
      if (!endpoint) return;

      // Optimistic — dərhal əlavə et
      const optimisticFav = { ...msg, favoritedAtUtc: new Date().toISOString() };
      setFavoriteMessages((prev) => [optimisticFav, ...prev]);

      try {
        await apiPost(endpoint);
      } catch (err) {
        console.error("Failed to add favorite:", err);
        // Revert — sil
        setFavoriteMessages((prev) => prev.filter((m) => m.id !== msg.id));
      }
    },
    [selectedChat],
  );

  // ─── handleRemoveFavorite — mesajı favorilərdən çıxar (Optimistic UI) ─────
  const handleRemoveFavorite = useCallback(
    async (msg) => {
      if (!selectedChat) return;
      const endpoint = getChatEndpoint(
        selectedChat.id,
        selectedChat.type,
        `/messages/${msg.id}/favorite`,
      );
      if (!endpoint) return;

      // Əvvəlki state-i saxla (revert üçün)
      const prevFavorites = [...(favoriteMessages || [])];
      // Optimistic — dərhal sil
      setFavoriteMessages((prev) => prev.filter((m) => m.id !== msg.id));

      try {
        await apiDelete(endpoint);
      } catch (err) {
        console.error("Failed to remove favorite:", err);
        // Revert — geri əlavə et
        setFavoriteMessages(prevFavorites);
      }
    },
    [selectedChat, favoriteMessages],
  );

  // ─── handleOpenChatsWithUser ───────────────────────────────────────────────
  const handleOpenChatsWithUser = useCallback(async (otherUserId, source = "sidebar") => {
    if (!otherUserId) return;
    setChatsWithUserSource(source);
    setShowChatsWithUser(true);
    try {
      const data = await apiGet(`/api/channels/shared/${otherUserId}`);
      setChatsWithUserData(data || []);
    } catch {
      setChatsWithUserData([]);
    }
  }, []);

  // ─── loadMembersPanelPage — Members paneli paginated yükləmə ───────────────
  const membersPanelLoadingRef = useRef(false);
  const loadMembersPanelPage = useCallback(async (channelId, skip = 0, reset = false) => {
    if (membersPanelLoadingRef.current) return;
    membersPanelLoadingRef.current = true;
    setMembersPanelLoading(true);
    try {
      const members = await apiGet(`/api/channels/${channelId}/members?skip=${skip}&take=30`);
      if (reset) {
        setMembersPanelList(members);
      } else {
        setMembersPanelList((prev) => [...prev, ...members]);
      }
      setMembersPanelHasMore(members.length === 30);
    } catch (err) {
      console.error("Failed to load members page:", err);
    } finally {
      membersPanelLoadingRef.current = false;
      setMembersPanelLoading(false);
    }
  }, []);

  // ─── Sidebar açılanda channel members yüklə ───────────────────────────────
  useEffect(() => {
    if (!showSidebar || !selectedChat || selectedChat.type !== 1) return;
    (async () => {
      try {
        const members = await apiGet(`/api/channels/${selectedChat.id}/members?take=100`);
        setChannelMembers((prev) => ({
          ...prev,
          [selectedChat.id]: members.reduce((map, m) => {
            map[m.userId] = { fullName: m.fullName, avatarUrl: m.avatarUrl, role: m.role };
            return map;
          }, {}),
        }));
      } catch (err) {
        console.error("Failed to load channel members for sidebar:", err);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSidebar, selectedChat?.id]);

  // ─── Memoized dəyərlər ────────────────────────────────────────────────────

  // favoriteIds — favori mesajların ID-ləri Set-i (O(1) lookup üçün)
  const favoriteIds = useMemo(
    () => new Set(favoriteMessages.map((m) => m.id)),
    [favoriteMessages],
  );

  // linkMessages — mesajlardan URL-ləri çıxarır
  const linkMessages = useMemo(() => {
    const urlRegex = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;
    const results = [];
    for (const msg of messages) {
      if (!msg.content) continue;
      const urls = msg.content.match(urlRegex);
      if (!urls) continue;
      for (const url of urls) {
        let domain = "";
        try { domain = new URL(url).hostname; } catch { domain = url; }
        results.push({
          id: msg.id, url, domain,
          senderFullName: msg.senderFullName,
          senderAvatarUrl: msg.senderAvatarUrl,
          createdAtUtc: msg.createdAtUtc,
        });
      }
    }
    return results.sort((a, b) => new Date(b.createdAtUtc) - new Date(a.createdAtUtc));
  }, [messages]);

  // fileMessages — mesajlardan fayl olan mesajları çıxarır
  const fileMessages = useMemo(() => {
    const results = [];
    for (const msg of messages) {
      if (!msg.fileId || msg.isDeleted) continue;
      const isImage = msg.fileContentType?.startsWith("image/");
      results.push({
        id: msg.id, fileId: msg.fileId, fileName: msg.fileName,
        fileContentType: msg.fileContentType, fileSizeInBytes: msg.fileSizeInBytes,
        fileUrl: msg.fileUrl, isImage,
        senderFullName: msg.senderFullName,
        senderAvatarUrl: msg.senderAvatarUrl,
        createdAtUtc: msg.createdAtUtc,
      });
    }
    return results.sort((a, b) => new Date(b.createdAtUtc) - new Date(a.createdAtUtc));
  }, [messages]);

  // ─── resetSidebarPanels — handleSelectChat-da çağırılır ────────────────────
  const resetSidebarPanels = useCallback(() => {
    setShowFavorites(false);
    setFavoriteMessages([]);
    setFavMenuId(null);
    setFavSearchOpen(false);
    setFavSearchText("");
    setShowAllLinks(false);
    setLinksMenuId(null);
    setLinksSearchOpen(false);
    setLinksSearchText("");
    setShowFilesMedia(false);
    setFilesMediaTab("media");
    setFilesMenuId(null);
    setFilesSearchOpen(false);
    setFilesSearchText("");
    setShowMembersPanel(false);
    setMembersPanelDirect(false);
    setMemberMenuId(null);
  }, []);

  // ─── resetChatsWithUser — source-a görə bağlama ────────────────────────────
  const chatsWithUserSourceRef = useRef(chatsWithUserSource);
  chatsWithUserSourceRef.current = chatsWithUserSource;
  const resetChatsWithUser = useCallback(() => {
    if (chatsWithUserSourceRef.current === "sidebar") {
      setShowChatsWithUser(false);
      setChatsWithUserData([]);
      setChatsWithUserSource(null);
    }
  }, []);

  // ─── closeSidebar — tam bağlama (X düyməsi) ───────────────────────────────
  const closeSidebar = useCallback(() => {
    setShowSidebar(false);
    setShowFavorites(false);
    setFavSearchOpen(false);
    setFavSearchText("");
    setShowAllLinks(false);
    setLinksSearchOpen(false);
    setLinksSearchText("");
    setShowChatsWithUser(false);
    setChatsWithUserData([]);
    setChatsWithUserSource(null);
    setShowFilesMedia(false);
    setFilesSearchOpen(false);
    setFilesSearchText("");
    setShowMembersPanel(false);
    setMembersPanelDirect(false);
    setMemberMenuId(null);
  }, []);

  return {
    // Core
    showSidebar, setShowSidebar,
    showSidebarMenu, setShowSidebarMenu,
    // Favorites
    showFavorites, setShowFavorites,
    favoriteMessages, setFavoriteMessages,
    favoritesLoading, favMenuId, setFavMenuId,
    favSearchOpen, setFavSearchOpen, favSearchText, setFavSearchText,
    // Links
    showAllLinks, setShowAllLinks,
    linksMenuId, setLinksMenuId,
    linksSearchOpen, setLinksSearchOpen, linksSearchText, setLinksSearchText,
    // Chats with User
    showChatsWithUser, setShowChatsWithUser,
    chatsWithUserData, setChatsWithUserData,
    chatsWithUserSource, setChatsWithUserSource,
    // Files & Media
    showFilesMedia, setShowFilesMedia,
    filesMediaTab, setFilesMediaTab,
    filesMenuId, setFilesMenuId,
    filesSearchOpen, setFilesSearchOpen, filesSearchText, setFilesSearchText,
    // Members
    showMembersPanel, setShowMembersPanel,
    membersPanelDirect, setMembersPanelDirect,
    memberMenuId, setMemberMenuId,
    membersPanelList, membersPanelHasMore, membersPanelLoading,
    // Refs
    sidebarMenuRef, favMenuRef, linksMenuRef, filesMenuRef, memberMenuRef,
    // Functions
    loadFavoriteMessages, handleFavoriteMessage, handleRemoveFavorite,
    handleOpenChatsWithUser, loadMembersPanelPage,
    closeSidebar, resetSidebarPanels, resetChatsWithUser,
    // Memos
    favoriteIds, linkMessages, fileMessages,
  };
}
