// ─── useSidebarPanels.js — Custom Hook: Sidebar Panel State & Məntiqi ────────
// Bu hook Chat.jsx-in sağ tərəfdəki Detail Sidebar panelinin
// state-lərini, ref-lərini, data yükləmə funksiyalarını və memo-larını idarə edir.
// JSX rendering hələlik Chat.jsx-də qalır (Mərhələ 4-də ayrı komponentə çıxarılacaq).

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { apiGet, apiPost, apiDelete } from "../services/api";
import { getChatEndpoint } from "../utils/chatUtils";


// ─── useSidebarPanels ────────────────────────────────────────────────────────
// selectedChat: hansı chat açıqdır
// channelMembers: channel üzvlərinin lookup map-i
// setChannelMembers: channel üzvlərini yeniləmək üçün
export default function useSidebarPanels(selectedChat, channelMembers, setChannelMembers) {

  // ─── Core sidebar state ───────────────────────────────────────────────────
  const [showSidebar, setShowSidebar] = useState(false);
  const [sidebarClosing, setSidebarClosing] = useState(false);
  const [showSidebarMenu, setShowSidebarMenu] = useState(false);
  const [sidebarDataLoading, setSidebarDataLoading] = useState(false);

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
  const [linkMessages, setLinkMessages] = useState([]);
  const [linksLoading, setLinksLoading] = useState(false);

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
  // Preview grid — sidebar-da görünən son 6 fayl (API-dən)
  const [previewFiles, setPreviewFiles] = useState([]);
  // API-based file yükləmə state-ləri
  const [fileMessages, setFileMessages] = useState([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [filesHasMore, setFilesHasMore] = useState(true);

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

  // ─── loadPreviewFiles — sidebar-da son 6 faylı API-dən yüklə ──────────────
  const loadPreviewFiles = useCallback(async (chat) => {
    if (!chat) return;
    const endpoint = getChatEndpoint(chat.id, chat.type, "/messages/files");
    if (!endpoint) return;
    try {
      const data = await apiGet(`${endpoint}?pageSize=6`);
      const mapped = (data || []).map((msg) => ({
        id: msg.id, fileId: msg.fileId, fileName: msg.fileName,
        fileContentType: msg.fileContentType, fileSizeInBytes: msg.fileSizeInBytes,
        fileUrl: msg.fileUrl, createdAtUtc: msg.createdAtUtc,
        senderFullName: msg.senderFullName, senderAvatarUrl: msg.senderAvatarUrl,
      }));
      setPreviewFiles(mapped);
    } catch {
      // Preview yüklənməsə boş qalır
    }
  }, []);

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

  // ─── loadLinkMessages — API-dən link olan mesajları yüklə ────────────────────
  const loadLinkMessages = useCallback(async (chat) => {
    if (!chat) return;
    const endpoint = getChatEndpoint(chat.id, chat.type, "/messages/links");
    if (!endpoint) return;
    try {
      setLinksLoading(true);
      const data = await apiGet(endpoint);
      // Hər mesajdan URL-ləri çıxar
      const urlRegex = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;
      const results = [];
      for (const msg of (data || [])) {
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
      setLinkMessages(results);
    } catch (err) {
      console.error("Failed to load link messages:", err);
      setLinkMessages([]);
    } finally {
      setLinksLoading(false);
    }
  }, []);

  // ─── Sidebar açıldığında: data yoxdursa API-dən yüklə ──────────────────────
  // Cache bərpası handleSelectChat-da olur — burada yalnız boşdursa yüklə
  useEffect(() => {
    if (!showSidebar || !selectedChat) return;
    // Əgər favoriteMessages və previewFiles artıq cache-dən bərpa olunubsa, yenidən yükləmə
    const hasCachedData = favoriteMessages.length > 0 || previewFiles.length > 0;
    if (hasCachedData) {
      setSidebarDataLoading(false);
      // Links cache-dən bərpa olunmayıbsa, yüklə
      if (linkMessages.length === 0) loadLinkMessages(selectedChat);
      return;
    }
    setSidebarDataLoading(true);
    Promise.all([
      loadPreviewFiles(selectedChat),
      loadFavoriteMessages(selectedChat),
      loadLinkMessages(selectedChat),
    ]).finally(() => setSidebarDataLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSidebar, selectedChat?.id]);

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

      // Functional updater ilə snapshot capture — stale closure problemi yox
      let prevSnapshot;
      setFavoriteMessages((prev) => {
        prevSnapshot = prev;
        return prev.filter((m) => m.id !== msg.id);
      });

      try {
        await apiDelete(endpoint);
      } catch (err) {
        console.error("Failed to remove favorite:", err);
        // Revert — capture olunmuş snapshot-u bərpa et
        setFavoriteMessages(prevSnapshot);
      }
    },
    [selectedChat],
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

  // ─── Sidebar açılanda channel members yüklə (cache yoxdursa) ────────────────
  useEffect(() => {
    if (!showSidebar || !selectedChat || selectedChat.type !== 1) return;
    // handleSelectChat artıq yükləyibsə, dublikat sorğu göndərmə
    if (channelMembers[selectedChat.id]) return;
    let cancelled = false;
    (async () => {
      try {
        const members = await apiGet(`/api/channels/${selectedChat.id}/members?take=100`);
        if (cancelled) return;
        setChannelMembers((prev) => ({
          ...prev,
          [selectedChat.id]: members.reduce((map, m) => {
            map[m.userId] = { fullName: m.fullName, avatarUrl: m.avatarUrl, role: m.role };
            return map;
          }, {}),
        }));
      } catch (err) {
        if (!cancelled) console.error("Failed to load channel members for sidebar:", err);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSidebar, selectedChat?.id]);

  // ─── Memoized dəyərlər ────────────────────────────────────────────────────

  // favoriteIds — favori mesajların ID-ləri Set-i (O(1) lookup üçün)
  const favoriteIds = useMemo(
    () => new Set(favoriteMessages.map((m) => m.id)),
    [favoriteMessages],
  );

  // ─── loadFileMessages — API-dən faylları yüklə (pagination ilə) ────────────
  // Race condition qoruması: requestId ilə köhnə sorğuların cavabını ignore et
  const filesRequestIdRef = useRef(0);
  const loadFileMessages = useCallback(async (chat, tab, existingFiles = [], beforeUtc = null) => {
    if (!chat) return;
    const isMedia = tab === "media";
    const endpoint = getChatEndpoint(chat.id, chat.type, "/messages/files");
    if (!endpoint) return;

    // Tab dəyişdikdə köhnə datanı təmizlə (stale data görünməsin)
    if (!beforeUtc) {
      setFileMessages([]);
      setFilesHasMore(true);
    }

    const requestId = ++filesRequestIdRef.current;

    try {
      setFilesLoading(true);
      let url = `${endpoint}?pageSize=30&isMedia=${isMedia}`;
      if (beforeUtc) url += `&before=${encodeURIComponent(beforeUtc)}`;

      const data = await apiGet(url);

      // Köhnə sorğunun cavabını ignore et (tab dəyişilibsə)
      if (requestId !== filesRequestIdRef.current) return;

      const mapped = (data || []).map((msg) => ({
        id: msg.id, fileId: msg.fileId, fileName: msg.fileName,
        fileContentType: msg.fileContentType, fileSizeInBytes: msg.fileSizeInBytes,
        fileUrl: msg.fileUrl, isImage: msg.fileContentType?.startsWith("image/"),
        senderFullName: msg.senderFullName,
        senderAvatarUrl: msg.senderAvatarUrl,
        createdAtUtc: msg.createdAtUtc,
      }));

      // Əvvəlki fayllarla birləşdir (loadMore üçün)
      const merged = beforeUtc ? [...existingFiles, ...mapped] : mapped;
      setFileMessages(merged);
      setFilesHasMore((data || []).length >= 30);
    } catch (err) {
      if (requestId !== filesRequestIdRef.current) return;
      console.error("Failed to load files:", err);
      if (!beforeUtc) setFileMessages([]);
      setFilesHasMore(false);
    } finally {
      if (requestId === filesRequestIdRef.current) setFilesLoading(false);
    }
  }, []);

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
    setLinkMessages([]);
    setShowFilesMedia(false);
    setFilesMediaTab("media");
    setFilesMenuId(null);
    setFilesSearchOpen(false);
    setFilesSearchText("");
    setPreviewFiles([]);
    setFileMessages([]);
    setFilesLoading(false);
    setFilesHasMore(true);
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

  // ─── handleNewFileMessage — yeni fayl mesajı gəldikdə panelləri real-time yenilə
  const handleNewFileMessage = useCallback((msg) => {
    if (!msg?.fileId) return;
    const newFile = {
      id: msg.id, fileId: msg.fileId, fileName: msg.fileName,
      fileContentType: msg.fileContentType, fileSizeInBytes: msg.fileSizeInBytes,
      fileUrl: msg.fileUrl, createdAtUtc: msg.createdAtUtc,
      senderFullName: msg.senderFullName, senderAvatarUrl: msg.senderAvatarUrl,
      isImage: msg.fileContentType?.startsWith("image/"),
    };

    // Preview grid-ə əlavə et (max 6 ədəd, ən yeni əvvəl)
    setPreviewFiles((prev) => {
      if (prev.some((f) => f.id === msg.id)) return prev;
      return [newFile, ...prev].slice(0, 6);
    });

    // Files & Media paneli açıqdırsa, uyğun tab-a əlavə et
    if (showFilesMedia) {
      const isImage = msg.fileContentType?.startsWith("image/");
      const shouldAdd = (filesMediaTab === "media" && isImage) ||
                        (filesMediaTab === "files" && !isImage);
      if (shouldAdd) {
        setFileMessages((prev) => {
          if (prev.some((f) => f.id === msg.id)) return prev;
          return [newFile, ...prev];
        });
      }
    }
  }, [showFilesMedia, filesMediaTab]);

  // ─── closeSidebar — animasiyalı bağlama (200ms slide-out, sonra unmount) ──
  const closeSidebar = useCallback(() => {
    setSidebarClosing(true);
    setTimeout(() => {
      setSidebarClosing(false);
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
    }, 200);
  }, []);

  // ─── Dropdown pozisiyası: sağda yer yoxdursa sola aç ──────────────────────
  useEffect(() => {
    if (!filesMenuId) return;
    const wrap = filesMenuRef.current;
    if (!wrap) return;
    // requestAnimationFrame — dropdown DOM-a mount olana qədər gözlə
    const raf = requestAnimationFrame(() => {
      const dd = wrap.querySelector(".ds-dropdown");
      if (!dd) return;

      const btnRect = wrap.getBoundingClientRect();
      const ddWidth = dd.offsetWidth || 160;
      const ddHeight = dd.offsetHeight || 160;
      const viewportW = window.innerWidth;
      const viewportH = window.innerHeight;

      // Sağda kifayət qədər yer varsa — butonun solundan sağa doğru aç
      // Yoxsa — butonun sağından sola doğru aç
      if (btnRect.left + ddWidth <= viewportW) {
        dd.style.left = btnRect.left + "px";
        dd.style.right = "auto";
      } else {
        dd.style.left = "auto";
        dd.style.right = (viewportW - btnRect.right) + "px";
      }

      // Aşağıda yer yoxdursa — yuxarıya aç
      if (btnRect.bottom + 4 + ddHeight > viewportH) {
        dd.style.top = (btnRect.top - ddHeight - 4) + "px";
      } else {
        dd.style.top = (btnRect.bottom + 4) + "px";
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [filesMenuId]);

  return {
    // Core
    showSidebar, setShowSidebar,
    sidebarClosing,
    showSidebarMenu, setShowSidebarMenu,
    sidebarDataLoading,
    // Favorites
    showFavorites, setShowFavorites,
    favoriteMessages, setFavoriteMessages,
    favoritesLoading, favMenuId, setFavMenuId,
    favSearchOpen, setFavSearchOpen, favSearchText, setFavSearchText,
    // Links
    showAllLinks, setShowAllLinks,
    linksMenuId, setLinksMenuId,
    linksSearchOpen, setLinksSearchOpen, linksSearchText, setLinksSearchText,
    linkMessages, setLinkMessages, linksLoading,
    // Chats with User
    showChatsWithUser, setShowChatsWithUser,
    chatsWithUserData, setChatsWithUserData,
    chatsWithUserSource, setChatsWithUserSource,
    // Files & Media
    showFilesMedia, setShowFilesMedia,
    filesMediaTab, setFilesMediaTab,
    filesMenuId, setFilesMenuId,
    filesSearchOpen, setFilesSearchOpen, filesSearchText, setFilesSearchText,
    previewFiles, setPreviewFiles,
    fileMessages, setFileMessages, filesLoading, filesHasMore,
    // Members
    showMembersPanel, setShowMembersPanel,
    membersPanelDirect, setMembersPanelDirect,
    memberMenuId, setMemberMenuId,
    membersPanelList, membersPanelHasMore, membersPanelLoading,
    // Refs
    sidebarMenuRef, favMenuRef, linksMenuRef, filesMenuRef, memberMenuRef,
    // Functions
    loadFavoriteMessages, handleFavoriteMessage, handleRemoveFavorite,
    handleOpenChatsWithUser, loadMembersPanelPage, loadFileMessages, loadPreviewFiles,
    handleNewFileMessage, loadLinkMessages, closeSidebar, resetSidebarPanels, resetChatsWithUser,
    // Memos
    favoriteIds,
  };
}
