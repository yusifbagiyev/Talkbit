// useState — komponent daxili state (like C# reactive property)
// useRef — re-render etmədən dəyər saxlamaq (timer id, DOM referansı)
// useEffect — side effect (API çağrısı, event listener, cleanup)
import { useState, useRef, useEffect } from "react";

// Utility funksiyaları import et
import { getInitials, getAvatarColor, formatTime } from "../utils/chatUtils";

// API servis — backend-ə HTTP GET request göndərmək üçün
import { apiGet } from "../services/api";

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
}) {
  // --- Search mode state-ləri ---
  // searchMode — true olduqda conversation siyahısı gizlənir, search nəticələri görünür
  const [searchMode, setSearchMode] = useState(false);
  // searchResults — backend-dən gələn nəticələr: { users: [], channels: [] }
  const [searchResults, setSearchResults] = useState(null);
  // Debounce timer ref — hər keystroke-da əvvəlki timer-i sıfırlamaq üçün
  const searchTimerRef = useRef(null);

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

    // 2 hərfdən az → nəticələri sıfırla
    if (searchText.length < 2) {
      setSearchResults(null);
      return;
    }

    // 300ms debounce — istifadəçi yazmağı dayandırdıqdan sonra API çağır
    searchTimerRef.current = setTimeout(async () => {
      try {
        // Hər iki endpoint-i paralel çağır (users + channels)
        const [users, channels] = await Promise.all([
          apiGet(`/api/users/search?q=${encodeURIComponent(searchText)}`),
          apiGet(`/api/channels/search?query=${encodeURIComponent(searchText)}`),
        ]);
        setSearchResults({
          users: users || [],
          channels: channels || [],
        });
      } catch (err) {
        console.error("Search failed:", err);
        setSearchResults({ users: [], channels: [] });
      }
    }, 300);

    // Cleanup — komponent unmount olduqda və ya dependency dəyişdikdə timer-i sil
    return () => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
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
  function handleContextMenu(e, conv) {
    e.preventDefault(); // Brauzer default context menu-nu ləğv et
    setContextMenu({ conv, x: e.clientX, y: e.clientY });
  }

  // Context menu action handler — action çağır, menu bağla
  function handleContextAction(action) {
    const conv = contextMenu?.conv;
    if (!conv) return;
    setContextMenu(null);
    action(conv);
  }

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
  }, [searchMode]);

  // handleSearchFocus — search input-a fokus olduqda search mode-a keç
  function handleSearchFocus() {
    setSearchMode(true);
  }

  // handleSearchKeyDown — ESC basıldıqda search mode-dan çıx
  function handleSearchKeyDown(e) {
    if (e.key === "Escape") {
      exitSearchMode();
    }
  }

  // exitSearchMode — search mode bağla, input təmizlə
  function exitSearchMode() {
    setSearchMode(false);
    onSearchChange(""); // Input-u təmizlə
    setSearchResults(null);
  }

  // handleSelectUser — search nəticəsindən user-ə klik
  function handleSelectUser(user) {
    onSelectSearchUser(user);
    exitSearchMode();
  }

  // handleSelectChannel — search nəticəsindən channel-ə klik
  function handleSelectChannel(channel) {
    onSelectSearchChannel(channel);
    exitSearchMode();
  }

  // Client-side filter — searchMode deyilsə mövcud conversation-ları filtrə et
  const filteredConversations = conversations.filter((c) =>
    c.name.toLowerCase().includes(searchText.toLowerCase()),
  );

  // Pinlənmiş conversations yuxarıda göstərilir
  const sortedConversations = [...filteredConversations].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return 0;
  });

  // --- Search nəticələrinin render funksiyası ---
  // Bütün nəticələr (conversations, users, channels) birləşdirilir, dublikatlar çıxarılır
  function renderSearchResults() {
    // Client-side: mövcud conversations arasında axtarış
    const matchedConversations = searchText.length >= 2
      ? conversations.filter((c) =>
          c.name.toLowerCase().includes(searchText.toLowerCase()),
        )
      : [];

    if (!searchResults && matchedConversations.length === 0) {
      return (
        <div className="search-no-results">
          Type at least 2 characters to search
        </div>
      );
    }

    const users = searchResults?.users || [];
    const channels = searchResults?.channels || [];

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
        {/* Yeni söhbət düyməsi — Bitrix24 stili */}
        <button className="header-icon-btn create-btn" title="New group" onClick={onCreateChannel}>
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
        </button>
      </div>

      {/* Söhbət siyahısı / Search nəticələri */}
      <div className="conversation-list">
        {/* Search mode aktiv → search nəticələri göstər */}
        {searchMode ? (
          renderSearchResults()
        ) : isLoading ? (
          // Yüklənir...
          <div className="loading-state">Loading...</div>
        ) : sortedConversations.length === 0 ? (
          // Nəticə yoxdur
          <div className="empty-state">No conversations yet</div>
        ) : (
          sortedConversations.map((c) => {
            // Öz mesajımdırmı? — tick icon göstərmək üçün
            const isOwnLastMessage = c.lastMessageSenderId === userId;

            // Preview mətni — tiplərə görə fərqlənir
            let previewContent;
            // Preview-un solunda əlavə icon/avatar olacaqmı?
            let previewPrefix = null;

            if (c.draft) {
              // Draft varsa — qırmızı "Draft:" prefix ilə göstər
              previewPrefix = <span className="preview-draft-label">Draft:</span>;
              previewContent = c.draft;
            } else if (c.type === 2) {
              // DepartmentUser → vəzifə adı
              previewContent = c.positionName || "User";
            } else if (!c.lastMessage) {
              previewContent = "No messages yet";
            } else if (c.isNotes) {
              // Notes — ↩ icon ilə
              previewPrefix = <span className="preview-reply-icon"><svg viewBox="0 0 16 16"><path d="M14 3v4c0 1.1-.9 2-2 2H4m0 0l3-3M4 9l3 3"/></svg></span>;
              previewContent = c.lastMessage;
            } else if (isOwnLastMessage) {
              // Öz mesajım (DM/Channel) — ↩ icon + mətn
              previewPrefix = <span className="preview-reply-icon"><svg viewBox="0 0 16 16"><path d="M14 3v4c0 1.1-.9 2-2 2H4m0 0l3-3M4 9l3 3"/></svg></span>;
              previewContent = c.lastMessage;
            } else if (c.type === 1 && c.lastMessageSenderFullName) {
              // Channel + başqasının mesajı → kiçik avatar + mətn
              previewPrefix = (
                <span
                  className="preview-sender-avatar"
                  style={{ background: getAvatarColor(c.lastMessageSenderFullName) }}
                >
                  {getInitials(c.lastMessageSenderFullName)}
                </span>
              );
              previewContent = c.lastMessage;
            } else {
              // DM — qarşı tərəfin mesajı → sadəcə mətn
              previewContent = c.lastMessage;
            }

            return (
              <div
                key={c.id}
                className={`conversation-item${selectedChatId === c.id ? " selected" : ""}${c.isPinned ? " pinned" : ""}`}
                onClick={() => onSelectChat(c)}
                onContextMenu={(e) => handleContextMenu(e, c)}
              >
                {/* Avatar + typing indicator wrapper */}
                <div className="conversation-avatar-wrapper">
                  <div
                    className="conversation-avatar"
                    style={{ background: c.isNotes ? "#2FC6F6" : getAvatarColor(c.name) }}
                  >
                    {c.isNotes ? (
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="white"
                        stroke="white"
                        strokeWidth="2"
                      >
                        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                      </svg>
                    ) : (
                      getInitials(c.name)
                    )}
                  </div>
                  {/* Typing indicator — avatar-ın sağ-aşağı küncündə animasiyalı dots */}
                  {typingUsers[c.id] && (
                    <span className="avatar-typing-indicator">
                      <span className="typing-dot" />
                      <span className="typing-dot" />
                      <span className="typing-dot" />
                    </span>
                  )}
                </div>

                {/* Söhbət məlumatı */}
                <div className="conversation-info">
                  {/* Üst sıra: ad + tick + tarix */}
                  <div className="conversation-top-row">
                    <div className="conversation-name-wrapper">
                      <span className="conversation-name">{c.name}</span>
                      {/* Mute icon — mute olunmuş conversation üçün adın yanında */}
                      {c.isMuted && (
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
                      {/* Tick icon — time-ın solunda, yalnız öz mesajımda (Notes-da yox) */}
                      {isOwnLastMessage && c.type !== 2 && !c.isNotes && c.lastMessage && (
                        <span className={`preview-tick ${c.lastMessageStatus === "Read" ? "read" : ""}`}>
                          <svg viewBox="0 0 16 11">
                            <polyline points="1 5.5 5 9.5 11 1" />
                            {c.lastMessageStatus === "Read" && (
                              <polyline points="5.5 5.5 9.5 9.5 15 1" />
                            )}
                          </svg>
                        </span>
                      )}
                      <span className="conversation-time">
                        {formatTime(c.lastMessageAtUtc)}
                      </span>
                    </div>
                  </div>

                  {/* Alt sıra: preview + unread badge */}
                  <div className="conversation-bottom-row">
                    <span className="conversation-preview">
                      {previewPrefix}
                      {previewContent}
                    </span>
                    {/* Pin icon — pinlənmiş conversation üçün */}
                    {c.isPinned && (
                      <span className="conv-pin-icon" title="Pinned">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none" style={{ transform: "rotate(45deg)" }}>
                          <path d="M16 2a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v1h1.5v5.26a2.5 2.5 0 0 1-1.39 2.24L6.5 11.56A1.5 1.5 0 0 0 5.83 13v1.5h5.67V22a.5.5 0 0 0 1 0v-7.5h5.67V13a1.5 1.5 0 0 0-.67-1.44l-1.61-1.06A2.5 2.5 0 0 1 14.5 8.26V3H16V2Z" />
                        </svg>
                      </span>
                    )}
                    {/* Read later icon — mesaj və ya conversation səviyyəsində mark varsa bookmark göstər */}
                    {(c.lastReadLaterMessageId || c.isMarkedReadLater) && (
                      <span className="read-later-icon">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                        </svg>
                      </span>
                    )}
                    {c.unreadCount > 0 && (
                      <span className="unread-badge">{c.unreadCount}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
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
              <button className="conv-context-item" onClick={() => { setContextMenu(null); }}>
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

          {/* Hide — DM üçün yalnız lastMessage varsa (conversation mövcuddursa) */}
          {(contextMenu.conv.type === 1 || contextMenu.conv.lastMessage) && (
            <button
              className="conv-context-item"
              onClick={() => handleContextAction(onHide)}
            >
              Hide
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

export default ConversationList;
