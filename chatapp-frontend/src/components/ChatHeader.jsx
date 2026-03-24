import { memo, useState, useRef } from "react";
// Utility funksiyaları import et
import { getInitials, getAvatarColor, getLastSeenText } from "../utils/chatUtils";
import { getFileUrl } from "../services/api";
import "./ChatHeader.css";

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
//   canEdit           — channel admin/owner-i? (inline ad/avatar edit üçün)
//   onSaveChannelName — yeni ad göndər (async)
//   onSaveChannelAvatar — yeni avatar faylı göndər (async)
function ChatHeader({
  selectedChat,
  onlineUsers,
  onOpenAddMember,
  addMemberOpen,
  onToggleSidebar,
  sidebarOpen,
  onOpenSearch,
  searchOpen,
  canEdit,
  onSaveChannelName,
  onSaveChannelAvatar,
}) {
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState("");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef(null);

  // Ad save — boşdursa və ya dəyişməyibsə ləğv et; xəta olduqda edit açıq qalır
  async function handleSaveName() {
    const trimmed = nameValue.trim();
    if (!trimmed || trimmed === selectedChat.name) {
      setEditingName(false);
      return;
    }
    const success = await onSaveChannelName?.(trimmed);
    if (success !== false) setEditingName(false);
  }

  // Avatar fayl seçim → yüklə
  async function handleAvatarFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setAvatarUploading(true);
    try {
      await onSaveChannelAvatar?.(file);
    } finally {
      setAvatarUploading(false);
    }
  }

  const isChannel = selectedChat?.type === 1;
  const canEditChannel = canEdit && isChannel;

  return (
    <div className="chat-header">
      {/* Sol tərəf: avatar + ad + status */}
      <div className="chat-header-left">
        {/* Avatar — channel üçün klik → fayl yüklə (admin/owner), digərləri read-only */}
        <div
          className={`chat-header-avatar${canEditChannel ? " chat-header-avatar-editable" : ""}`}
          style={{ background: selectedChat.isNotes ? "#2FC6F6" : selectedChat.avatarUrl ? "transparent" : getAvatarColor(selectedChat.name) }}
          onClick={canEditChannel ? () => avatarInputRef.current?.click() : undefined}
          title={canEditChannel ? "Change avatar" : undefined}
        >
          {selectedChat.isNotes ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white" stroke="white" strokeWidth="2">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            </svg>
          ) : selectedChat.avatarUrl ? (
            <img
              src={getFileUrl(selectedChat.avatarUrl)}
              alt={selectedChat.name}
              className="chat-header-avatar-img"
              onError={(e) => { e.target.style.display = "none"; e.target.parentNode.style.background = getAvatarColor(selectedChat.name); e.target.parentNode.textContent = getInitials(selectedChat.name); }}
            />
          ) : (
            getInitials(selectedChat.name)
          )}
          {/* Kamera overlay — upload zamanı göstər */}
          {canEditChannel && (
            <div className={`chat-header-avatar-overlay${avatarUploading ? " loading" : ""}`}>
              {avatarUploading ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10" strokeOpacity="0.3" />
                  <path d="M12 2a10 10 0 0 1 10 10" strokeOpacity="1" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              )}
            </div>
          )}
        </div>

        {/* Gizli fayl input — avatar yükləmək üçün */}
        {canEditChannel && (
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={handleAvatarFileChange}
          />
        )}

        <div className="chat-header-info">
          {/* Birinci sıra: ad + edit butonu (hover) + real-time status */}
          <div className={`chat-header-name-row${canEditChannel ? " editable" : ""}`}>
            {editingName ? (
              <span className="chat-header-name-edit-wrap">
                {/* Mirror span — input genişliyini mətn uzunluğuna görə müəyyən edir */}
                <span className="chat-header-name-mirror" aria-hidden="true">
                  {nameValue || "\u00a0"}
                </span>
                <input
                  className="chat-header-name-input"
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveName();
                    if (e.key === "Escape") setEditingName(false);
                  }}
                  onBlur={handleSaveName}
                  onFocus={(e) => e.target.select()}
                  autoFocus
                  maxLength={100}
                />
              </span>
            ) : (
              <span className="chat-header-name">{selectedChat.name}</span>
            )}

            {/* Pencil edit butonu — həmişə DOM-da, CSS hover ilə görünür (layout shift olmur) */}
            {canEditChannel && !editingName && (
              <button
                className="chat-header-edit-btn"
                title="Edit channel name"
                onClick={() => { setNameValue(selectedChat.name); setEditingName(true); }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
            )}

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
                  {getLastSeenText(selectedChat.otherUserLastSeenAtUtc)}
                </span>
              ))}
          </div>

          {/* İkinci sıra: vəzifə / üzv sayı / "Your personal notes" */}
          <span className="chat-header-status">
            {selectedChat.isNotes
              ? "Your personal notes"
              : selectedChat.type === 0
                ? selectedChat.otherUserPosition || selectedChat.otherUserRole || "User"
                : selectedChat.type === 1
                  ? `${selectedChat.memberCount || 0} members`
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

export default memo(ChatHeader);
