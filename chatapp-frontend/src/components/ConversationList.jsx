// useState — komponent daxili state (like C# reactive property)
// useRef — re-render etmədən dəyər saxlamaq (timer id, DOM referansı)
// useEffect — side effect (API çağrısı, event listener, cleanup)
import { useState, useRef, useEffect, useCallback, useMemo, memo } from "react";

// Utility funksiyaları import et
import { getInitials, getAvatarColor, formatTime } from "../utils/chatUtils";
import { renderTextWithEmojis } from "../utils/emojiConstants";  // Emoji → Apple img çevirici

// API servis — backend-ə HTTP GET request göndərmək üçün
import { apiGet, getFileUrl } from "../services/api";
import { useAuth } from "../context/AuthContext";
import "./ConversationList.css";

// ─── renderPreviewEmojis — preview mətndəki Unicode emojiləri Apple CDN img-ə çevirir ───
function renderPreviewEmojis(text) {
  if (!text || typeof text !== "string") return text;
  const parts = renderTextWithEmojis(text);
  if (typeof parts === "string") return parts;
  return parts.map((part, i) =>
    typeof part === "string" ? (
      <span key={i}>{part}</span>
    ) : (
      <img
        key={i}
        src={part.url}
        alt={part.emoji}
        className="inline-emoji"
        onError={(e) => {
          const span = document.createElement("span");
          span.textContent = part.emoji;
          e.target.replaceWith(span);
        }}
      />
    )
  );
}

// ─── ConversationItem — memo-lanmış conversation item ───────────────────────
// Hər item yalnız öz prop-ları dəyişdikdə yenidən render olur
const ConversationItem = memo(function ConversationItem({
  conv, isSelected, userId, typingUsers, onSelectChat, onContextMenu,
}) {
  const isOwnLastMessage = conv.lastMessageSenderId === userId;

  let previewContent;
  let previewPrefix = null;

  if (conv.draft) {
    previewPrefix = <span className="preview-draft-label">Draft:</span>;
    previewContent = conv.draft;
  } else if (conv.type === 2) {
    previewContent = conv.positionName || "User";
  } else if (!conv.lastMessage) {
    previewContent = "No messages yet";
  } else if (conv.isNotes) {
    previewPrefix = <span className="preview-reply-icon"><svg viewBox="0 0 16 16"><path d="M14 3v4c0 1.1-.9 2-2 2H4m0 0l3-3M4 9l3 3"/></svg></span>;
    previewContent = conv.lastMessage;
  } else if (isOwnLastMessage) {
    previewPrefix = <span className="preview-reply-icon"><svg viewBox="0 0 16 16"><path d="M14 3v4c0 1.1-.9 2-2 2H4m0 0l3-3M4 9l3 3"/></svg></span>;
    previewContent = conv.lastMessage;
  } else if (conv.type === 1 && conv.lastMessageSenderFullName) {
    previewPrefix = (
      <span
        className="preview-sender-avatar"
        style={{ background: conv.lastMessageSenderAvatarUrl ? "transparent" : getAvatarColor(conv.lastMessageSenderFullName) }}
      >
        {conv.lastMessageSenderAvatarUrl ? (
          <img src={getFileUrl(conv.lastMessageSenderAvatarUrl)} alt="" className="preview-sender-avatar-img" onError={(e) => { e.target.style.display = "none"; e.target.parentNode.style.background = getAvatarColor(conv.lastMessageSenderFullName); e.target.parentNode.textContent = getInitials(conv.lastMessageSenderFullName); }} />
        ) : getInitials(conv.lastMessageSenderFullName)}
      </span>
    );
    previewContent = conv.lastMessage;
  } else {
    previewContent = conv.lastMessage;
  }

  return (
    <div
      className={`conversation-item${isSelected ? " selected" : ""}${conv.isPinned ? " pinned" : ""}`}
      onClick={() => onSelectChat(conv)}
      onContextMenu={(e) => onContextMenu(e, conv)}
    >
      <div className="conversation-avatar-wrapper">
        <div
          className="conversation-avatar"
          style={{ background: conv.isNotes ? "#2FC6F6" : conv.avatarUrl ? "transparent" : getAvatarColor(conv.name) }}
        >
          {conv.isNotes ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white" stroke="white" strokeWidth="2">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            </svg>
          ) : conv.avatarUrl ? (
            <img
              src={getFileUrl(conv.avatarUrl)}
              alt={conv.name}
              className="conversation-avatar-img"
              onError={(e) => { e.target.style.display = "none"; e.target.parentNode.style.background = getAvatarColor(conv.name); e.target.parentNode.textContent = getInitials(conv.name); }}
            />
          ) : (
            getInitials(conv.name)
          )}
        </div>
        {typingUsers[conv.id] && (
          <span className="avatar-typing-indicator">
            <span className="typing-dot" />
            <span className="typing-dot" />
            <span className="typing-dot" />
          </span>
        )}
      </div>

      <div className="conversation-info">
        <div className="conversation-top-row">
          <div className="conversation-name-wrapper">
            <span className="conversation-name">{conv.name}</span>
            {conv.isMuted && (
              <span className="conv-mute-icon" title="Muted">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <line x1="23" y1="9" x2="17" y2="15" />
                  <line x1="17" y1="9" x2="23" y2="15" />
                </svg>
              </span>
            )}
          </div>
          <div className="conversation-time-wrapper">
            {isOwnLastMessage && conv.type !== 2 && !conv.isNotes && conv.lastMessage && (
              conv.lastMessageStatus === "Pending" ? (
                <span className="preview-tick pending">
                  <svg viewBox="0 0 16 16">
                    <circle cx="8" cy="8" r="6.5" fill="none" strokeWidth="1.5" />
                    <polyline points="8 4 8 8 11 9.5" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              ) : (
                <span className={`preview-tick ${conv.lastMessageStatus === "Read" ? "read" : ""}`}>
                  <svg viewBox="0 0 16 11">
                    <polyline points="1 5.5 5 9.5 11 1" />
                    {conv.lastMessageStatus === "Read" && (
                      <polyline points="5.5 5.5 9.5 9.5 15 1" />
                    )}
                  </svg>
                </span>
              )
            )}
            <span className="conversation-time">
              {formatTime(conv.lastMessageAtUtc)}
            </span>
          </div>
        </div>

        <div className="conversation-bottom-row">
          <span className="conversation-preview">
            {previewPrefix}
            {typeof previewContent === "string"
              ? renderPreviewEmojis(previewContent)
              : previewContent}
          </span>
          {conv.isPinned && (
            <span className="conv-pin-icon" title="Pinned">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none" style={{ transform: "rotate(45deg)" }}>
                <path d="M16 2a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v1h1.5v5.26a2.5 2.5 0 0 1-1.39 2.24L6.5 11.56A1.5 1.5 0 0 0 5.83 13v1.5h5.67V22a.5.5 0 0 0 1 0v-7.5h5.67V13a1.5 1.5 0 0 0-.67-1.44l-1.61-1.06A2.5 2.5 0 0 1 14.5 8.26V3H16V2Z" />
              </svg>
            </span>
          )}
          {(conv.lastReadLaterMessageId || conv.isMarkedReadLater) && (
            <span className="read-later-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
            </span>
          )}
          {conv.unreadCount > 0 && (
            <span className="unread-badge">{conv.unreadCount}</span>
          )}
        </div>
      </div>
    </div>
  );
});

// ConversationList komponenti — sol panel, söhbət siyahısı
// Props:
//   conversations   — bütün söhbətlər array-i (Chat.jsx state-dən gəlir)
//   selectedChatId  — aktiv seçilmiş chatın id-si (highlight üçün)
//   searchText      — axtarış mətn sahəsinin dəyəri
//   onSearchChange  — axtarış mətn dəyişdikdə çağırılır
//   onSelectChat    — istifadəçi söhbətə klikləyəndə çağırılır
//   isLoading       — söhbətlər yüklənirkən true
//   onSelectSearchUser    — search nəticəsindən user seçildikdə
//   onSelectSearchChannel — search nəticəsindən channel seçildikdə
//   onMarkAllAsRead       — bütün oxunmamış mesajları oxunmuş işarələ
// .NET ekvivalenti: LeftPanel.razor — @foreach söhbət siyahısı
function ConversationList({
  conversations,
  selectedChatId,
  searchText,
  onSearchChange,
  onSelectChat,
  isLoading,
  userId,
  typingUsers,
  onCreateChannel,
  onSelectSearchUser,
  onSelectSearchChannel,
  onMarkAllAsRead,
  onTogglePin,
  onToggleMute,
  onToggleReadLater,
  onHide,
  onLeaveChannel,
  onFindChatsWithUser,
  onViewProfile,
}) {
  // --- Search mode state-ləri ---
  // searchMode — true olduqda conversation siyahısı gizlənir, search nəticələri görünür
  const { hasPermission } = useAuth();
  const [searchMode, setSearchMode] = useState(false);
  // searchResults — backend-dən gələn nəticələr: { users: [], channels: [] }
  const [searchResults, setSearchResults] = useState(null);
  // Debounce timer ref — hər keystroke-da əvvəlki timer-i sıfırlamaq üçün
  const searchTimerRef = useRef(null);
  // AbortController — köhnə search request-ləri cancel etmək üçün (race condition önləmə)
  const searchAbortRef = useRef(null);

  // panelRef — conversation-panel DOM referansı (search mode kənar klik bağlama üçün)
  const panelRef = useRef(null);

  // --- Context menu state ---
  // contextMenu — sağ klik ilə açılan menu: { conv, x, y } və ya null
  const [contextMenu, setContextMenu] = useState(null);
  const contextMenuRef = useRef(null);


  // --- Filter dropdown state ---
  // filterOpen — filter dropdown açıq/bağlı
  const [filterOpen, setFilterOpen] = useState(false);
  // filterRef — dropdown DOM referansı (kənar klik bağlama üçün)
  const filterRef = useRef(null);

  // --- Debounced search effect ---
  // searchText dəyişdikdə 300ms gözlə, sonra API çağır
  // searchMode aktiv olmasa çağırma
  useEffect(() => {
    // Search mode deyilsə heç nə etmə
    if (!searchMode) return;

    // Əvvəlki timer-i ləğv et (debounce)
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }

    // 2 hərfdən az → API çağırma (render zamanı nəticələr gizlədilir)
    if (searchText.length < 2) return;

    // 300ms debounce — istifadəçi yazmağı dayandırdıqdan sonra API çağır
    searchTimerRef.current = setTimeout(async () => {
      // Əvvəlki request-i cancel et — race condition önləmə
      if (searchAbortRef.current) searchAbortRef.current.abort();
      const controller = new AbortController();
      searchAbortRef.current = controller;

      try {
        // Promise.allSettled — biri fail olsa digəri itməsin
        const results = await Promise.allSettled([
          apiGet(`/api/users/search?q=${encodeURIComponent(searchText)}`),
          apiGet(`/api/channels/search?query=${encodeURIComponent(searchText)}`),
        ]);
        // Abort olunubsa nəticəni ignore et (yeni axtarış başlayıb)
        if (controller.signal.aborted) return;
        setSearchResults({
          users: results[0].status === "fulfilled" ? results[0].value || [] : [],
          channels: results[1].status === "fulfilled" ? results[1].value || [] : [],
        });
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error("Search failed:", err);
        setSearchResults({ users: [], channels: [] });
      }
    }, 300);

    // Cleanup — komponent unmount / dependency dəyişdikdə timer + request cancel et
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
      if (searchAbortRef.current) searchAbortRef.current.abort();
    };
  }, [searchText, searchMode]);

  // --- Filter dropdown kənar klik bağlama ---
  useEffect(() => {
    if (!filterOpen) return;
    function handleClickOutside(e) {
      if (filterRef.current && !filterRef.current.contains(e.target)) {
        setFilterOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [filterOpen]);

  // --- Context menu kənar klik bağlama ---
  useEffect(() => {
    if (!contextMenu) return;
    function handleClickOutside(e) {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target)) {
        setContextMenu(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [contextMenu]);

  // handleContextMenu — conversation item üzərində sağ klik
  const handleContextMenu = useCallback((e, conv) => {
    e.preventDefault(); // Brauzer default context menu-nu ləğv et
    setContextMenu({ conv, x: e.clientX, y: e.clientY });
  }, []);

  // Context menu action handler — action çağır, menu bağla
  const handleContextAction = useCallback((action) => {
    setContextMenu((prev) => {
      if (prev?.conv) action(prev.conv);
      return null;
    });
  }, []);

  // exitSearchMode — search mode bağla, input təmizlə
  const exitSearchMode = useCallback(() => {
    setSearchMode(false);
    onSearchChange(""); // Input-u təmizlə
    setSearchResults(null);
  }, [onSearchChange]);

  // --- Search mode kənar klik bağlama ---
  // Conversation paneldən kənarda (məs. chat panel) klik → search bağla
  useEffect(() => {
    if (!searchMode) return;
    function handleClickOutside(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        exitSearchMode();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [searchMode, exitSearchMode]);

  // handleSearchFocus — search input-a fokus olduqda search mode-a keç
  const handleSearchFocus = useCallback(() => {
    setSearchMode(true);
  }, []);

  // handleSearchKeyDown — ESC basıldıqda search mode-dan çıx
  const handleSearchKeyDown = useCallback((e) => {
    if (e.key === "Escape") {
      exitSearchMode();
    }
  }, [exitSearchMode]);

  // handleSelectUser — search nəticəsindən user-ə klik
  const handleSelectUser = useCallback((user) => {
    onSelectSearchUser(user);
    exitSearchMode();
  }, [onSelectSearchUser, exitSearchMode]);

  // handleSelectChannel — search nəticəsindən channel-ə klik
  const handleSelectChannel = useCallback((channel) => {
    onSelectSearchChannel(channel);
    exitSearchMode();
  }, [onSelectSearchChannel, exitSearchMode]);

  // Client-side filter + pin sort — memoized (conversations/searchText dəyişməsə yenidən hesablanmır)
  const sortedConversations = useMemo(() => {
    const filtered = conversations.filter((c) =>
      c.name.toLowerCase().includes(searchText.toLowerCase()),
    );
    return filtered.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return 0;
    });
  }, [conversations, searchText]);

  // --- Search nəticələrinin render funksiyası ---
  // Bütün nəticələr (conversations, users, channels) birləşdirilir, dublikatlar çıxarılır
  function renderSearchResults() {
    // Client-side: mövcud conversations arasında axtarış
    const matchedConversations = searchText.length >= 2
      ? conversations.filter((c) =>
          c.name.toLowerCase().includes(searchText.toLowerCase()),
        )
      : [];

    // searchText 2 hərfdən azdırsa, backend nəticələrini göstərmə
    const effectiveResults = searchText.length >= 2 ? searchResults : null;

    if (!effectiveResults && matchedConversations.length === 0) {
      return (
        <div className="search-no-results">
          Type at least 2 characters to search
        </div>
      );
    }

    const users = effectiveResults?.users || [];
    const channels = effectiveResults?.channels || [];

    // Dublikat çıxarma üçün Set-lər
    const convIds = new Set(conversations.map((c) => c.id));
    const convOtherUserIds = new Set(
      conversations.filter((c) => c.otherUserId).map((c) => c.otherUserId),
    );

    // Backend-dən gələn user-lərdən mövcud conversation-ı olanları çıxar
    const filteredUsers = users.filter((u) => !convOtherUserIds.has(u.id));
    // Backend-dən gələn channel-lardan mövcud conversation-ı olanları çıxar
    const filteredChannels = channels.filter((ch) => !convIds.has(ch.id));

    // Hamısını birləşdir — vahid siyahı, bölmə başlıqları yox
    // Hər element: { key, name, avatarBg, initials, detail, onClick, isNotes }
    const allResults = [];

    // 1. Mövcud conversations (Notes, DM, Channel)
    for (const c of matchedConversations) {
      allResults.push({
        key: `conv-${c.id}`,
        name: c.name,
        avatarBg: c.isNotes ? "#2FC6F6" : getAvatarColor(c.name),
        initials: c.isNotes ? null : getInitials(c.name),
        isNotes: c.isNotes,
        detail: c.isNotes ? "Your personal notes" : c.type === 1 ? "Group chat" : "User",
        onClick: () => { onSelectChat(c); exitSearchMode(); },
      });
    }

    // 2. Backend users (conversation-ı olmayanlar)
    for (const u of filteredUsers) {
      allResults.push({
        key: `user-${u.id}`,
        name: u.fullName,
        avatarBg: getAvatarColor(u.fullName),
        initials: getInitials(u.fullName),
        isNotes: false,
        detail: "User",
        onClick: () => handleSelectUser(u),
      });
    }

    // 3. Backend channels (conversation-ı olmayanlar)
    for (const ch of filteredChannels) {
      allResults.push({
        key: `chan-${ch.id}`,
        name: ch.name,
        avatarBg: getAvatarColor(ch.name),
        initials: getInitials(ch.name),
        isNotes: false,
        detail: "Group chat",
        onClick: () => handleSelectChannel(ch),
      });
    }

    if (allResults.length === 0) {
      return <div className="search-no-results">No results found</div>;
    }

    return (
      <>
        {allResults.map((item) => (
          <div
            key={item.key}
            className="search-result-item"
            onClick={item.onClick}
          >
            <div
              className="search-result-avatar"
              style={{ background: item.avatarBg }}
            >
              {item.isNotes ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="white" stroke="white" strokeWidth="2">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                </svg>
              ) : (
                item.initials
              )}
            </div>
            <div className="search-result-info">
              <div className="search-result-name">{item.name}</div>
              <div className="search-result-detail">{item.detail}</div>
            </div>
          </div>
        ))}
      </>
    );
  }

  return (
    <div className="conversation-panel" ref={panelRef}>
      <div className="conversation-panel-header">
        {/* Filter button — dropdown ilə "Mark all as read" */}
        <div className="filter-dropdown-wrapper" ref={filterRef}>
          <button
            className="header-icon-btn"
            title="Filter"
            onClick={() => setFilterOpen((prev) => !prev)}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="4" y1="6" x2="20" y2="6" />
              <line x1="8" y1="12" x2="16" y2="12" />
              <line x1="11" y1="18" x2="13" y2="18" />
            </svg>
          </button>
          {/* Filter dropdown — "Mark all as read" butonu */}
          {filterOpen && (
            <div className="filter-dropdown">
              <button
                className="filter-dropdown-item"
                onClick={() => {
                  onMarkAllAsRead();
                  setFilterOpen(false);
                  exitSearchMode();
                }}
              >
                Mark all as read
              </button>
            </div>
          )}
        </div>

        <div className="search-wrapper">
          <svg
            className="search-icon"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          {/* Controlled input — value state-dən gəlir */}
          {/* onFocus → search mode başla, onKeyDown → ESC ilə bağla */}
          <input
            type="text"
            placeholder="Find employee or chat"
            className="search-input"
            value={searchText}
            onChange={(e) => onSearchChange(e.target.value)}
            onFocus={handleSearchFocus}
            onKeyDown={handleSearchKeyDown}
          />
          {/* Search mode-da X button göstər — search bağlamaq üçün */}
          {searchMode && (
            <button className="search-clear-btn" onClick={exitSearchMode}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
        {/* Yeni söhbət düyməsi — Channels.Create permission */}
        {hasPermission("Channels.Create") && <button className="header-icon-btn create-btn" title="New group" onClick={onCreateChannel}>
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </button>}
      </div>

      {/* Söhbət siyahısı / Search nəticələri */}
      <div className="conversation-list">
        {/* Search mode aktiv → search nəticələri göstər */}
        {searchMode ? (
          renderSearchResults()
        ) : isLoading ? (
          <div className="conv-skeleton-list">
            {[1,2,3,4,5,6,7,8].map(i => (
              <div key={i} className="conv-skeleton-item">
                <div className="conv-skeleton-avatar" />
                <div className="conv-skeleton-text">
                  <div className="conv-skeleton-bar" style={{ width: `${55 + (i % 3) * 15}%` }} />
                  <div className="conv-skeleton-bar conv-skeleton-bar--short" style={{ width: `${35 + (i % 4) * 10}%` }} />
                </div>
                <div className="conv-skeleton-time" />
              </div>
            ))}
          </div>
        ) : sortedConversations.length === 0 ? (
          // Nəticə yoxdur
          <div className="empty-state">No conversations yet</div>
        ) : (
          sortedConversations.map((c) => (
            <ConversationItem
              key={c.id}
              conv={c}
              isSelected={selectedChatId === c.id}
              userId={userId}
              typingUsers={typingUsers}
              onSelectChat={onSelectChat}
              onContextMenu={handleContextMenu}
            />
          ))
        )}
      </div>

      {/* Context menu — conversation üzərində sağ klik */}
      {contextMenu && (
        <div
          className="conv-context-menu"
          ref={contextMenuRef}
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          {/* Mark to read later, Pin, Mute — yalnız mövcud mesaj olan conversation-larda göstər */}
          {contextMenu.conv.lastMessage && (
            <>
              <button
                className="conv-context-item"
                onClick={() => handleContextAction(onToggleReadLater)}
              >
                {contextMenu.conv.isMarkedReadLater ? "Unmark read later" : "Mark to read later"}
              </button>

              <button
                className="conv-context-item"
                onClick={() => handleContextAction(onTogglePin)}
              >
                {contextMenu.conv.isPinned ? "Unpin" : "Pin"}
              </button>

              {/* Mute — Notes-da göstərmə */}
              {!contextMenu.conv.isNotes && (
                <button
                  className="conv-context-item"
                  onClick={() => handleContextAction(onToggleMute)}
                >
                  {contextMenu.conv.isMuted ? "Unmute" : "Mute"}
                </button>
              )}
            </>
          )}

          {/* DM + DepartmentUser: View profile, Find chats */}
          {(contextMenu.conv.type === 0 || contextMenu.conv.type === 2) && (
            <>
              <button className="conv-context-item" onClick={() => {
                const otherUserId = contextMenu.conv.otherUserId || contextMenu.conv.userId;
                setContextMenu(null);
                if (onViewProfile && otherUserId) onViewProfile(otherUserId);
              }}>
                View profile
              </button>
              <button className="conv-context-item" onClick={() => {
                const otherUserId = contextMenu.conv.otherUserId || contextMenu.conv.userId;
                setContextMenu(null);
                if (onFindChatsWithUser && otherUserId) onFindChatsWithUser(otherUserId);
              }}>
                Find chats with this user
              </button>
            </>
          )}

          {/* Hide/Unhide — DM üçün yalnız lastMessage varsa (conversation mövcuddursa) */}
          {(contextMenu.conv.type === 1 || contextMenu.conv.lastMessage) && (
            <button
              className="conv-context-item"
              onClick={() => handleContextAction(onHide)}
            >
              {contextMenu.conv.isHidden ? "Unhide" : "Hide"}
            </button>
          )}

          {/* Channel-only: Leave */}
          {contextMenu.conv.type === 1 && (
            <button
              className="conv-context-item"
              onClick={() => handleContextAction(onLeaveChannel)}
            >
              Leave
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default memo(ConversationList);
