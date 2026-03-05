// Utility funksiyaları import et
import { getInitials, getAvatarColor, getLastSeenText } from "../utils/chatUtils";

// ChatHeader komponenti — chat panelinin yuxarı başlığı
// Props:
//   selectedChat      — seçilmiş chat obyekti (ad, tip, otherUserId, ...)
//   onlineUsers       — Set<userId> — online olan istifadəçilər
//   pinnedMessages    — pinlənmiş mesajlar array-i (pin button aktiv/deaktiv üçün)
//   onTogglePinExpand — pin list-i genişləndir/yığ (Chat.jsx-dən gəlir)
//   onOpenAddMember   — "Add Member" düyməsinə klik (yalnız channel üçün)
//   onToggleSidebar   — sağ sidebar panelini aç/bağla
//   onOpenSearch      — search panelini aç
//   searchOpen        — search paneli açıqdır? (active class üçün)
function ChatHeader({ selectedChat, onlineUsers, pinnedMessages, onTogglePinExpand, onOpenAddMember, addMemberOpen, onToggleSidebar, sidebarOpen, onOpenSearch, searchOpen }) {
  return (
    <div className="chat-header">
      {/* Sol tərəf: avatar + ad + status */}
      <div className="chat-header-left">
        {/* Avatar — Notes üçün bookmark icon, digərləri üçün initials */}
        <div
          className="chat-header-avatar"
          style={{ background: selectedChat.isNotes ? "#2FC6F6" : getAvatarColor(selectedChat.name) }}
        >
          {selectedChat.isNotes ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white" stroke="white" strokeWidth="2">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            </svg>
          ) : (
            getInitials(selectedChat.name)
          )}
        </div>

        <div className="chat-header-info">
          {/* Birinci sıra: ad + real-time status (typing / online / last seen) */}
          <div className="chat-header-name-row">
            <span className="chat-header-name">
              {selectedChat.name}
            </span>

            {/* Mute icon — conversation muted olduqda adın yanında göstər */}
            {selectedChat.isMuted && (
              <span className="chat-header-mute-icon" title="Muted">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <line x1="23" y1="9" x2="17" y2="15" />
                  <line x1="17" y1="9" x2="23" y2="15" />
                </svg>
              </span>
            )}

            {/* Status yalnız DM (type=0) üçün: Online / Last Seen */}
            {!selectedChat.isNotes &&
              selectedChat.type === 0 &&
              (onlineUsers.has(selectedChat.otherUserId) ? (
                <span className="status-online">Online</span>
              ) : (
                <span className="status-offline">
                  {getLastSeenText(
                    selectedChat.otherUserLastSeenAtUtc,
                  )}
                </span>
              ))}
          </div>

          {/* İkinci sıra: vəzifə / üzv sayı / "Your personal notes" */}
          <span className="chat-header-status">
            {selectedChat.isNotes
              ? "Your personal notes"
              : selectedChat.type === 0
                // DM — digər istifadəçinin vəzifəsi
                ? selectedChat.otherUserPosition ||
                  selectedChat.otherUserRole ||
                  "User"
                : selectedChat.type === 1
                  // Channel — üzv sayı
                  ? `${selectedChat.memberCount || 0} members`
                  // DepartmentUser (type=2) — vəzifə adı
                  : selectedChat.positionName || "User"}
          </span>
        </div>
      </div>

      {/* Sağ tərəf: action düymələri */}
      <div className="chat-header-actions">
        {/* Add Member — yalnız channel (type=1) üçün göstər */}
        {selectedChat.type === 1 && (
          <button
            className={`header-action-btn${addMemberOpen ? " active" : ""}`}
            title="Add member"
            onClick={onOpenAddMember}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <line x1="19" y1="8" x2="19" y2="14" />
              <line x1="22" y1="11" x2="16" y2="11" />
            </svg>
          </button>
        )}

        {/* Search düyməsi */}
        <button className={`header-action-btn${searchOpen ? " active" : ""}`} title="Search" onClick={onOpenSearch}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </button>

        {/* Sidebar toggle düyməsi — sağ paneli aç/bağla */}
        <button
          className={`header-action-btn${sidebarOpen ? " active" : ""}`}
          title="Details"
          onClick={onToggleSidebar}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <line x1="15" y1="3" x2="15" y2="21" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default ChatHeader;
