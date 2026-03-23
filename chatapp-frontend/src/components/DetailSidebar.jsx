import { memo, useMemo } from "react";
// ─── DetailSidebar.jsx — Bitrix24 stilində sağ detail panel ────────────────
// Chat.jsx-dən çıxarılmış sidebar JSX bloku.
// Panellər: Profile, Favorites, Links, Search, ChatsWithUser, FilesMedia, Members
// sidebar/channel/search hook obyektləri prop olaraq gəlir — state + ref qarışıqdır
/* eslint-disable react-hooks/refs */

import { getInitials, getAvatarColor, getMessagePreview, highlightMatches, formatFileSize, formatSectionDate, formatRelativeDate } from "../utils/chatUtils";
import { downloadFileByUrl, getFileUrl } from "../services/api";
import FileTypeIcon from "./FileTypeIcon";
import "./DetailSidebar.css";

// highlightMatches helper — parts array-dan JSX render edir
const renderHighlight = (text, query) => {
  const parts = highlightMatches(text, query);
  return parts ? parts.map((p, i) => p.highlight ? <mark key={i}>{p.text}</mark> : p.text) : text;
};

function DetailSidebar({
  selectedChat,
  channelMembers,
  conversations,
  user,
  inputRef,
  sidebar,
  channel,
  search,
  messages,
  onTogglePin,
  onToggleMute,
  onToggleHide,
  onEditChannel,
  onSelectChat,
  onScrollToMessage,
  onDeleteMessage,
  onCloseSearch,
  setPendingDeleteConv,
  setPendingLeaveChannel,
  setSelectedChat,
  setMessageText,
}) {
  // Preview grid üçün memoized fayl siyahısı — hər render-də filter+sort çalışmasın
  const previewFiles = useMemo(() => {
    if (!messages?.length) return [];
    return messages
      .filter((m) => m.fileId && !m.isDeleted)
      .sort((a, b) => new Date(b.createdAtUtc) - new Date(a.createdAtUtc))
      .slice(0, 6);
  }, [messages]);

  return (
    <div className={`detail-sidebar${sidebar.sidebarClosing ? " closing" : ""}`}>
      {/* Header — X close + About chat + ... more */}
      <div className="ds-header">
        <button className="ds-close" onClick={() => sidebar.closeSidebar()}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        <span className="ds-header-title">About chat</span>
        <div className="ds-more-wrap" ref={sidebar.sidebarMenuRef}>
          <button
            className="ds-more-btn"
            onClick={() => sidebar.setShowSidebarMenu((v) => !v)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="5" cy="12" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="19" cy="12" r="2" />
            </svg>
          </button>
          {sidebar.showSidebarMenu && (
            <div className="ds-dropdown">
              <button className="ds-dropdown-item" onClick={() => { onTogglePin(selectedChat); sidebar.setShowSidebarMenu(false); }}>
                {selectedChat.isPinned ? "Unpin" : "Pin"}
              </button>

              {selectedChat.isNotes ? (
                <>
                  <button className="ds-dropdown-item" onClick={() => sidebar.setShowSidebarMenu(false)}>View profile</button>
                  <button className="ds-dropdown-item" onClick={() => { onToggleHide(selectedChat); sidebar.setShowSidebarMenu(false); sidebar.setShowSidebar(false); }}>
                    {selectedChat.isHidden ? "Unhide" : "Hide"}
                  </button>
                </>
              ) : selectedChat.type === 0 ? (
                <>
                  <button className="ds-dropdown-item" onClick={() => sidebar.setShowSidebarMenu(false)}>View profile</button>
                  <button className="ds-dropdown-item" onClick={() => { sidebar.setShowSidebarMenu(false); sidebar.handleOpenChatsWithUser(selectedChat.otherUserId, "sidebar"); }}>Find chats with this user</button>
                  <button className="ds-dropdown-item" onClick={() => { onToggleHide(selectedChat); sidebar.setShowSidebarMenu(false); sidebar.setShowSidebar(false); }}>
                    {selectedChat.isHidden ? "Unhide" : "Hide"}
                  </button>
                  <button className="ds-dropdown-item ds-dropdown-danger" onClick={() => { setPendingDeleteConv(selectedChat); sidebar.setShowSidebarMenu(false); }}>Delete</button>
                </>
              ) : selectedChat.type === 2 ? (
                /* DepartmentUser — conversation yaranmayıb: hide/leave yoxdur */
                <>
                  <button className="ds-dropdown-item" onClick={() => sidebar.setShowSidebarMenu(false)}>View profile</button>
                  <button className="ds-dropdown-item" onClick={() => { sidebar.setShowSidebarMenu(false); sidebar.handleOpenChatsWithUser(selectedChat.otherUserId || selectedChat.userId, "sidebar"); }}>Find chats with this user</button>
                  <button className="ds-dropdown-item ds-dropdown-danger" onClick={() => { setPendingDeleteConv(selectedChat); sidebar.setShowSidebarMenu(false); }}>Delete</button>
                </>
              ) : (
                /* Channel (type=1) */
                <>
                  {(channelMembers[selectedChat.id]?.[user.id]?.role >= 2 || channelMembers[selectedChat.id]?.[user.id]?.role === "Admin" || channelMembers[selectedChat.id]?.[user.id]?.role === "Owner") && (
                    <button className="ds-dropdown-item" onClick={() => { channel.setShowAddMember(true); sidebar.setShowSidebarMenu(false); }}>Add members</button>
                  )}
                  {(channelMembers[selectedChat.id]?.[user.id]?.role === 3 || channelMembers[selectedChat.id]?.[user.id]?.role === "Owner") && (
                    <button className="ds-dropdown-item" onClick={onEditChannel}>Edit</button>
                  )}
                  <button className="ds-dropdown-item" onClick={() => { onToggleHide(selectedChat); sidebar.setShowSidebarMenu(false); sidebar.setShowSidebar(false); }}>
                    {selectedChat.isHidden ? "Unhide" : "Hide"}
                  </button>
                  <button className="ds-dropdown-item ds-dropdown-danger" onClick={() => { setPendingLeaveChannel(selectedChat); sidebar.setShowSidebarMenu(false); }}>Leave</button>
                  <button className="ds-dropdown-item ds-dropdown-danger" onClick={() => { setPendingDeleteConv(selectedChat); sidebar.setShowSidebarMenu(false); }}>Delete</button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Scrollable body */}
      <div className="ds-body">
        {/* Profil kartı — vertikal: avatar → ad → position → create group → sound */}
        <div className="ds-card">
          <div className="ds-profile">
            {selectedChat.isNotes ? (
              <div className="ds-avatar ds-avatar-notes">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="white" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                </svg>
              </div>
            ) : (
              <div className="ds-avatar" style={{ background: selectedChat.avatarUrl ? "transparent" : getAvatarColor(selectedChat.name) }}>
                {selectedChat.avatarUrl ? (
                  <img src={getFileUrl(selectedChat.avatarUrl)} alt={selectedChat.name} className="ds-avatar-img" onError={(e) => { e.target.style.display = "none"; e.target.parentNode.style.background = getAvatarColor(selectedChat.name); e.target.parentNode.textContent = getInitials(selectedChat.name); }} />
                ) : getInitials(selectedChat.name)}
              </div>
            )}
            <div className="ds-name">{selectedChat.name}</div>
            {/* Channel — üzv avatarları */}
            {selectedChat.type === 1 ? (
              channelMembers[selectedChat.id] ? (
                <div className="ds-members-preview" role="button" tabIndex={0} onClick={() => { sidebar.setShowMembersPanel(true); sidebar.loadMembersPanelPage(selectedChat.id, 0, true); }}>
                  <div className="ds-members-avatars">
                    {Object.entries(channelMembers[selectedChat.id]).slice(0, 4).map(([uid, m]) => (
                      <div
                        key={uid}
                        className="ds-members-avatar"
                        style={{ background: m.avatarUrl ? "transparent" : getAvatarColor(m.fullName) }}
                        title={m.fullName}
                      >
                        {m.avatarUrl ? (
                          <img src={getFileUrl(m.avatarUrl)} alt={m.fullName} className="ds-members-avatar-img" onError={(e) => { e.target.style.display = "none"; e.target.parentNode.style.background = getAvatarColor(m.fullName); e.target.parentNode.textContent = getInitials(m.fullName); }} />
                        ) : getInitials(m.fullName)}
                      </div>
                    ))}
                    {Object.keys(channelMembers[selectedChat.id]).length > 4 && (
                      <span className="ds-members-more">
                        +{Object.keys(channelMembers[selectedChat.id]).length - 4}
                      </span>
                    )}
                    <button className="ds-members-add-btn" onClick={(e) => { e.stopPropagation(); channel.setShowAddMember(true); }}>+ Add</button>
                  </div>
                </div>
              ) : (
                <div className="ds-role">{selectedChat.memberCount || 0} members</div>
              )
            ) : (
              <div className="ds-role">
                {selectedChat.isNotes
                  ? "Visible to you only"
                  : selectedChat.otherUserPosition || selectedChat.otherUserRole || "User"}
              </div>
            )}
          </div>

          {/* Sound toggle — Notes üçün görünmür */}
          {!selectedChat.isNotes && (
            <div className="ds-toggle-row">
                <svg className="ds-toggle-icon" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="0.5">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07" fill="none" stroke="currentColor" strokeWidth="1.8" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14" fill="none" stroke="currentColor" strokeWidth="1.8" />
                </svg>
                <span className="ds-toggle-label">Sound</span>
                <label className="ds-switch">
                  <input
                    type="checkbox"
                    checked={!selectedChat.isMuted}
                    onChange={() => onToggleMute(selectedChat)}
                  />
                  <span className="ds-switch-track" />
                </label>
              </div>
          )}
        </div>

        {/* Info kartı */}
        <div className="ds-card">
          {/* Chat tipi — User / Group chat */}
          <div className="ds-info-row">
            <svg className="ds-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <span className="ds-info-label">
              {selectedChat.isNotes
                ? "A scratchpad to keep important messages, files and links in one place."
                : selectedChat.type === 1 ? "Group chat" : "User"}
            </span>
          </div>

          {/* Favorite messages */}
          <div
            className="ds-info-row ds-info-clickable"
            role="button"
            tabIndex={0}
            onClick={() => { sidebar.setShowFavorites(true); sidebar.loadFavoriteMessages(selectedChat); }}
          >
            <svg className="ds-icon" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="0.5">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            <span className="ds-info-link">Favorite messages</span>
            <span className="ds-badge">{sidebar.favoriteMessages.length}</span>
          </div>

          {/* All links */}
          <div
            className="ds-info-row ds-info-clickable"
            role="button"
            tabIndex={0}
            onClick={() => sidebar.setShowAllLinks(true)}
          >
            <svg className="ds-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
            <span className="ds-info-link">All links</span>
            <span className="ds-badge">{sidebar.linkMessages.length}</span>
          </div>

          {/* Chats with user — yalnız DM (type=0) üçün */}
          {selectedChat.type === 0 && !selectedChat.isNotes && (
            <div
              className="ds-info-row ds-info-clickable"
              role="button"
              tabIndex={0}
              onClick={() => sidebar.handleOpenChatsWithUser(selectedChat.otherUserId, "sidebar")}
            >
                <svg className="ds-icon" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M15 3H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h1v2l2.6-2H15a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z" />
                  <path d="M19 9v4a2 2 0 0 1-2 2h-1.4L13 17v-2h-3v1a2 2 0 0 0 2 2h4.4L19 20v-2h1a2 2 0 0 0 2-2v-5a2 2 0 0 0-2-2h-1z" />
                </svg>
                <span className="ds-info-link">Chats with user</span>
                <svg className="ds-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </div>
          )}
        </div>

        {/* Files and media — klikləndikdə panel açılır */}
        <div className="ds-card ds-files-card">
          <div className="ds-files-header" onClick={() => { sidebar.setShowFilesMedia(true); sidebar.loadFileMessages(selectedChat, "media"); }}>
            <span className="ds-files-title">Files and media</span>
            <svg className="ds-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </div>
          {/* Thumbnail preview grid — memoized fayl siyahısı */}
          {previewFiles.length > 0 && (
            <div className="ds-files-preview-grid" onClick={() => { sidebar.setShowFilesMedia(true); sidebar.loadFileMessages(selectedChat, "media"); }}>
              {previewFiles.map((f) => {
                const isImage = f.fileContentType?.startsWith("image/");
                return (
                  <div key={f.id} className="ds-files-preview-item" title={f.fileName}>
                    {isImage ? (
                      <img src={getFileUrl(f.fileUrl)} alt={f.fileName} className="ds-files-preview-img" />
                    ) : (
                      <div className="ds-files-preview-file">
                        <FileTypeIcon fileName={f.fileName} size={28} />
                      </div>
                    )}
                    <span className="ds-files-preview-name">{f.fileName}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ═══════ Overlay panellər ═══════ */}

      {/* Favorite messages paneli */}
      {sidebar.showFavorites && (
        <div className="ds-favorites-panel">
          <div className="ds-favorites-header">
            <button className="ds-favorites-back" onClick={() => { sidebar.setShowFavorites(false); sidebar.setFavMenuId(null); sidebar.setFavSearchOpen(false); sidebar.setFavSearchText(""); }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            {/* Search açıqdırsa input göstər, deyilsə title göstər */}
            {sidebar.favSearchOpen ? (
              <input
                className="ds-favorites-search-input"
                type="text"
                placeholder="Search favorites..."
                value={sidebar.favSearchText}
                onChange={(e) => sidebar.setFavSearchText(e.target.value)}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    sidebar.setFavSearchOpen(false);
                    sidebar.setFavSearchText("");
                  }
                }}
              />
            ) : (
              <span className="ds-favorites-title">Favorite messages</span>
            )}
            {/* Search açıqdırsa X (bağla), deyilsə search iconu */}
            {sidebar.favSearchOpen ? (
              <button
                className="ds-favorites-search-btn active"
                title="Close search"
                onClick={() => { sidebar.setFavSearchOpen(false); sidebar.setFavSearchText(""); }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            ) : (
              <button
                className="ds-favorites-search-btn"
                title="Search"
                onClick={() => sidebar.setFavSearchOpen(true)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </button>
            )}
          </div>
          <div className="ds-favorites-list">
            {sidebar.favoritesLoading ? (
              <div className="ds-favorites-empty">Loading...</div>
            ) : (() => {
              // Axtarış mətninə görə filterlə
              const query = sidebar.favSearchText.trim().toLowerCase();
              const filtered = query
                ? sidebar.favoriteMessages.filter((m) => getMessagePreview(m).toLowerCase().includes(query))
                : sidebar.favoriteMessages;

              if (filtered.length === 0) {
                return (
                  <div className="ds-favorites-empty">
                    {query ? "No matching messages" : "No favorite messages"}
                  </div>
                );
              }

              return filtered.map((msg, idx) => {
                const msgDate = formatSectionDate(msg.createdAtUtc);
                const prevDate = idx > 0 ? formatSectionDate(filtered[idx - 1].createdAtUtc) : null;
                const showDate = idx === 0 || msgDate !== prevDate;

                return (
                  <div key={msg.id}>
                    {showDate && (
                      <div className="ds-favorites-date"><span>{msgDate}</span></div>
                    )}
                    <div
                      className="ds-favorites-item"
                      onClick={() => {
                        onScrollToMessage(msg.id);
                        sidebar.setFavMenuId(null);
                      }}
                    >
                      <div
                        className="ds-favorites-avatar"
                        style={{ background: getAvatarColor(msg.senderFullName) }}
                      >
                        {msg.senderAvatarUrl ? (
                          <img src={msg.senderAvatarUrl} alt="" className="ds-favorites-avatar-img" />
                        ) : (
                          getInitials(msg.senderFullName)
                        )}
                      </div>
                      <div className="ds-favorites-body">
                        <span className="ds-favorites-sender">{msg.senderFullName}</span>
                        <span className="ds-favorites-text">
                          {renderHighlight(getMessagePreview(msg), query)}
                        </span>
                      </div>
                      {/* More menu — hover-də görünür */}
                      <div
                        className="ds-favorites-more-wrap"
                        ref={sidebar.favMenuId === msg.id ? sidebar.favMenuRef : null}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          className="ds-favorites-more-btn"
                          onClick={() => sidebar.setFavMenuId(sidebar.favMenuId === msg.id ? null : msg.id)}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <circle cx="5" cy="12" r="2" />
                            <circle cx="12" cy="12" r="2" />
                            <circle cx="19" cy="12" r="2" />
                          </svg>
                        </button>
                        {sidebar.favMenuId === msg.id && (
                          <div className="ds-dropdown">
                            <button
                              className="ds-dropdown-item"
                              onClick={() => {
                                onScrollToMessage(msg.id);
                                sidebar.setFavMenuId(null);
                              }}
                            >
                              View context
                            </button>
                            <button
                              className="ds-dropdown-item ds-dropdown-danger"
                              onClick={() => {
                                sidebar.handleRemoveFavorite(msg);
                                sidebar.setFavMenuId(null);
                              }}
                            >
                              Remove from Favorites
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}

      {/* All links paneli */}
      {sidebar.showAllLinks && (
        <div className="ds-favorites-panel">
          <div className="ds-favorites-header">
            <button className="ds-favorites-back" onClick={() => { sidebar.setShowAllLinks(false); sidebar.setLinksMenuId(null); sidebar.setLinksSearchOpen(false); sidebar.setLinksSearchText(""); }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            {sidebar.linksSearchOpen ? (
              <input
                className="ds-favorites-search-input"
                type="text"
                placeholder="Search links..."
                value={sidebar.linksSearchText}
                onChange={(e) => sidebar.setLinksSearchText(e.target.value)}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    sidebar.setLinksSearchOpen(false);
                    sidebar.setLinksSearchText("");
                  }
                }}
              />
            ) : (
              <span className="ds-favorites-title">All links</span>
            )}
            {/* Search açıqdırsa X (bağla), deyilsə search iconu */}
            {sidebar.linksSearchOpen ? (
              <button
                className="ds-favorites-search-btn active"
                title="Close search"
                onClick={() => { sidebar.setLinksSearchOpen(false); sidebar.setLinksSearchText(""); }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            ) : (
              <button
                className="ds-favorites-search-btn"
                title="Search"
                onClick={() => sidebar.setLinksSearchOpen(true)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </button>
            )}
          </div>
          <div className="ds-favorites-list">
            {(() => {
              const query = sidebar.linksSearchText.trim().toLowerCase();
              const filtered = query
                ? sidebar.linkMessages.filter((l) => l.url.toLowerCase().includes(query) || l.domain.toLowerCase().includes(query))
                : sidebar.linkMessages;

              if (filtered.length === 0) {
                return (
                  <div className="ds-favorites-empty">
                    {query ? "No matching links" : "No links shared"}
                  </div>
                );
              }

              return filtered.map((link, idx) => {
                const msgDate = formatSectionDate(link.createdAtUtc);
                const prevDate = idx > 0 ? formatSectionDate(filtered[idx - 1].createdAtUtc) : null;
                const showDate = idx === 0 || msgDate !== prevDate;

                return (
                  <div key={`${link.id}-${link.url}`}>
                    {showDate && (
                      <div className="ds-favorites-date"><span>{msgDate}</span></div>
                    )}
                    <div
                      className="ds-link-item"
                      onClick={() => onScrollToMessage(link.id)}
                    >
                      {/* Link ikonu */}
                      <div className="ds-link-icon-wrap">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                        </svg>
                      </div>
                      {/* Link məlumatı */}
                      <div className="ds-link-body">
                        <span className="ds-link-domain">{link.domain}</span>
                        <a
                          className="ds-link-url"
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {renderHighlight(link.url, query)}
                        </a>
                        {/* Göndərən */}
                        <div className="ds-link-sender">
                          <div
                            className="ds-link-sender-avatar"
                            style={{ background: getAvatarColor(link.senderFullName) }}
                          >
                            {link.senderAvatarUrl ? (
                              <img src={link.senderAvatarUrl} alt="" className="ds-link-sender-avatar-img" />
                            ) : (
                              getInitials(link.senderFullName)
                            )}
                          </div>
                          <span className="ds-link-sender-name">{link.senderFullName}</span>
                        </div>
                      </div>
                      {/* More menu */}
                      <div
                        className="ds-favorites-more-wrap"
                        ref={sidebar.linksMenuId === `${link.id}-${link.url}` ? sidebar.linksMenuRef : null}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          className="ds-favorites-more-btn"
                          onClick={() => sidebar.setLinksMenuId(sidebar.linksMenuId === `${link.id}-${link.url}` ? null : `${link.id}-${link.url}`)}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <circle cx="5" cy="12" r="2" />
                            <circle cx="12" cy="12" r="2" />
                            <circle cx="19" cy="12" r="2" />
                          </svg>
                        </button>
                        {sidebar.linksMenuId === `${link.id}-${link.url}` && (
                          <div className="ds-dropdown">
                            <button
                              className="ds-dropdown-item"
                              onClick={() => {
                                onScrollToMessage(link.id);
                                sidebar.setLinksMenuId(null);
                              }}
                            >
                              View context
                            </button>
                            <button
                              className="ds-dropdown-item"
                              onClick={() => {
                                navigator.clipboard.writeText(link.url);
                                sidebar.setLinksMenuId(null);
                              }}
                            >
                              Copy link
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}

      {/* Search panel — chat daxili mesaj axtarışı */}
      {search.showSearchPanel && (
        <div className="ds-favorites-panel">
          <div className="ds-favorites-header">
            {/* searchFromSidebar ? back buton : close buton */}
            <button className="ds-favorites-back" onClick={onCloseSearch}>
              {search.searchFromSidebar ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              )}
            </button>

            {/* Search input — həmişə göstərilir */}
            <div className="ds-search-input-wrap">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Find in chat"
                value={search.searchQuery}
                onChange={(e) => search.setSearchQuery(e.target.value)}
                autoFocus
              />
              {search.searchQuery && (
                <button className="ds-search-clear" onClick={() => search.setSearchQuery("")}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Nəticələr */}
          <div
            className="ds-favorites-list"
            onScroll={(e) => {
              const { scrollTop, scrollHeight, clientHeight } = e.target;
              if (scrollHeight - scrollTop - clientHeight < 50 && search.searchHasMore && !search.searchLoading) {
                search.loadMoreSearchResults();
              }
            }}
          >
            {search.searchResultsList.length === 0 && !search.searchLoading ? (
              <div className="ds-search-empty">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginBottom: 12, opacity: 0.5 }}>
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                {search.searchQuery.trim().length >= 2
                  ? "No messages found."
                  : "This view will show found messages."}
              </div>
            ) : (
              (() => {
                const q = search.searchQuery.trim().toLowerCase();
                let lastDate = "";
                return search.searchResultsList.map((r) => {
                  const dateStr = formatSectionDate(r.createdAtUtc);
                  const showDate = dateStr !== lastDate;
                  if (showDate) lastDate = dateStr;
                  return (
                    <div key={r.messageId}>
                      {showDate && (
                        <div className="ds-favorites-date">
                          <span>{dateStr}</span>
                        </div>
                      )}
                      <div
                        className="ds-favorites-item"
                        style={{ cursor: "pointer" }}
                        onClick={() => onScrollToMessage(r.messageId)}
                      >
                        <div className="ds-favorites-avatar" style={{ background: getAvatarColor(r.senderFullName) }}>
                          {r.senderAvatarUrl ? (
                            <img src={r.senderAvatarUrl} alt="" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
                          ) : (
                            getInitials(r.senderFullName)
                          )}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="ds-favorites-sender">{r.senderFullName}</div>
                          <div className="ds-favorites-text">
                            {renderHighlight(r.content, q)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                });
              })()
            )}
            {search.searchLoading && (
              <div className="ds-search-empty" style={{ padding: "20px" }}>Loading...</div>
            )}
          </div>
        </div>
      )}

      {/* Chats with user paneli */}
      {sidebar.showChatsWithUser && (
        <div className="ds-favorites-panel">
          <div className="ds-favorites-header">
            {/* source-a görə back (←) və ya close (X) butonu */}
            {sidebar.chatsWithUserSource === "context" ? (
              <button
                className="ds-favorites-back"
                onClick={() => { sidebar.setShowChatsWithUser(false); sidebar.setChatsWithUserData([]); sidebar.setChatsWithUserSource(null); sidebar.setShowSidebar(false); }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            ) : (
              <button
                className="ds-favorites-back"
                onClick={() => { sidebar.setShowChatsWithUser(false); sidebar.setChatsWithUserData([]); sidebar.setChatsWithUserSource(null); }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
            )}
            <span className="ds-favorites-title">Chats with user</span>
          </div>
          <div className="ds-favorites-list">
            {sidebar.chatsWithUserData.length === 0 ? (
              <div className="ds-favorites-empty">No shared chats</div>
            ) : (
              sidebar.chatsWithUserData.map((ch) => {
                const dateStr = ch.lastMessageAtUtc ? formatRelativeDate(ch.lastMessageAtUtc) : "";

                // Channel tipinə görə mətn (ChannelType: Public=1, Private=2)
                const typeLabel = ch.type === 1 ? "Channel" : "Group chat";

                return (
                  <div
                    key={ch.id}
                    className="ds-shared-chat-item"
                    onClick={() => {
                      // Kanalı conversations-da tap, varsa seç
                      const existing = conversations.find((c) => c.id === ch.id);
                      if (existing) {
                        onSelectChat(existing);
                      } else {
                        // Siyahıda yoxdursa → yeni conversation olaraq əlavə et və seç
                        const newConv = {
                          id: ch.id,
                          name: ch.name,
                          avatarUrl: ch.avatarUrl,
                          type: 1,
                          unreadCount: 0,
                        };
                        onSelectChat(newConv);
                      }
                    }}
                  >
                    {/* Avatar */}
                    <div
                      className="ds-shared-chat-avatar"
                      style={{ background: getAvatarColor(ch.name) }}
                    >
                      {ch.avatarUrl ? (
                        <img src={ch.avatarUrl} alt="" className="ds-shared-chat-avatar-img" />
                      ) : (
                        getInitials(ch.name)
                      )}
                    </div>
                    {/* Məlumat */}
                    <div className="ds-shared-chat-body">
                      <span className="ds-shared-chat-name">{ch.name}</span>
                      <span className="ds-shared-chat-type">{typeLabel}</span>
                    </div>
                    {/* Tarix */}
                    {dateStr && <span className="ds-shared-chat-date">{dateStr}</span>}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Files and media paneli */}
      {sidebar.showFilesMedia && (
        <div className="ds-favorites-panel">
          <div className="ds-favorites-header">
            <button className="ds-favorites-back" onClick={() => { sidebar.setShowFilesMedia(false); sidebar.setFilesMenuId(null); sidebar.setFilesSearchOpen(false); sidebar.setFilesSearchText(""); }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            {sidebar.filesSearchOpen ? (
              <input
                className="ds-favorites-search-input"
                type="text"
                placeholder="Search files..."
                value={sidebar.filesSearchText}
                onChange={(e) => sidebar.setFilesSearchText(e.target.value)}
                autoFocus
                onKeyDown={(e) => { if (e.key === "Escape") { sidebar.setFilesSearchOpen(false); sidebar.setFilesSearchText(""); } }}
              />
            ) : (
              <span className="ds-favorites-title">Files and media</span>
            )}
            {sidebar.filesSearchOpen ? (
              <button className="ds-favorites-search-btn active" title="Close search" onClick={() => { sidebar.setFilesSearchOpen(false); sidebar.setFilesSearchText(""); }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            ) : (
              <button className="ds-favorites-search-btn" title="Search" onClick={() => sidebar.setFilesSearchOpen(true)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </button>
            )}
          </div>

          {/* Tab-lar: Media / Files */}
          <div className="ds-fm-tabs">
            <button
              className={`ds-fm-tab${sidebar.filesMediaTab === "media" ? " active" : ""}`}
              onClick={() => { sidebar.setFilesMediaTab("media"); sidebar.loadFileMessages(selectedChat, "media"); }}
            >
              Media
            </button>
            <button
              className={`ds-fm-tab${sidebar.filesMediaTab === "files" ? " active" : ""}`}
              onClick={() => { sidebar.setFilesMediaTab("files"); sidebar.loadFileMessages(selectedChat, "files"); }}
            >
              Files
            </button>
          </div>

          <div
            className="ds-favorites-list"
            onScroll={(e) => {
              const el = e.target;
              // Aşağıya 100px qaldıqda API-dən daha çox yüklə
              if (el.scrollHeight - el.scrollTop - el.clientHeight < 100
                  && sidebar.filesHasMore && !sidebar.filesLoading) {
                const files = sidebar.fileMessages;
                if (files.length > 0) {
                  const lastDate = files[files.length - 1].createdAtUtc;
                  sidebar.loadFileMessages(selectedChat, sidebar.filesMediaTab, files, lastDate);
                }
              }
            }}
          >
            {(() => {
              const query = sidebar.filesSearchText.trim().toLowerCase();
              const tab = sidebar.filesMediaTab;

              // API artıq tab-a görə filterli data qaytarır, yalnız axtarış filtri lazımdır
              const filtered = query
                ? sidebar.fileMessages.filter((f) => f.fileName?.toLowerCase().includes(query))
                : sidebar.fileMessages;

              if (filtered.length === 0) {
                return (
                  <div className="ds-favorites-empty">
                    {query ? "No matching files" : tab === "media" ? "No media yet" : "No files yet"}
                  </div>
                );
              }


              // Context menu render helper — media və files üçün ortaq
              const renderContextMenu = (f) => sidebar.filesMenuId === f.id && (
                <div className="ds-dropdown">
                  <button className="ds-dropdown-item" onClick={() => { onScrollToMessage(f.id); sidebar.setFilesMenuId(null); }}>
                    View context
                  </button>
                  <button className="ds-dropdown-item" onClick={() => {
                    downloadFileByUrl(f.fileUrl, f.fileName);
                    sidebar.setFilesMenuId(null);
                  }}>
                    Download file
                  </button>
                  <button className="ds-dropdown-item" onClick={() => {
                    downloadFileByUrl(f.fileUrl, f.fileName);
                    sidebar.setFilesMenuId(null);
                  }}>
                    Save to Drive
                  </button>
                  <button className="ds-dropdown-item ds-dropdown-danger" onClick={() => {
                    onDeleteMessage(f);
                    sidebar.setFilesMenuId(null);
                  }}>
                    Delete file
                  </button>
                </div>
              );

              if (tab === "media") {
                // Media tab — şəkilləri grid formatında göstər, date divider ilə
                let lastDate = null;
                const elements = [];
                filtered.forEach((f, idx) => {
                  const msgDate = formatSectionDate(f.createdAtUtc);
                  if (msgDate !== lastDate) {
                    if (elements.length > 0) elements.push(<div key={`grid-end-${idx}`} className="ds-fm-grid-break" />);
                    elements.push(<div key={`date-${idx}`} className="ds-favorites-date"><span>{msgDate}</span></div>);
                    lastDate = msgDate;
                  }
                  elements.push(
                    <div key={f.id} className="ds-fm-media-item">
                      {/* Şəkil + avatar inner container — overflow:hidden ilə clip olunur */}
                      <div className="ds-fm-media-inner" onClick={() => onScrollToMessage(f.id)}>
                        <img
                          src={getFileUrl(f.fileUrl)}
                          alt=""
                          className="ds-fm-media-img"
                          onError={(e) => { e.target.style.display = "none"; }}
                        />
                        {/* Göndərən avatar — şəklin üzərində sol alt */}
                        <div
                          className="ds-fm-media-sender"
                          style={{ background: f.senderAvatarUrl ? "transparent" : getAvatarColor(f.senderFullName) }}
                          title={f.senderFullName}
                        >
                          {f.senderAvatarUrl ? (
                            <img src={getFileUrl(f.senderAvatarUrl)} alt="" className="ds-fm-media-sender-img" />
                          ) : (
                            getInitials(f.senderFullName)
                          )}
                        </div>
                      </div>
                      {/* More butonu — sağ üst, hover-da görünür, dropdown kəsilməsin deyə inner-dən kənarda */}
                      <div
                        className="ds-fm-media-more-wrap"
                        ref={sidebar.filesMenuId === f.id ? sidebar.filesMenuRef : null}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          className="ds-fm-media-more-btn"
                          onClick={(e) => { e.stopPropagation(); sidebar.setFilesMenuId(sidebar.filesMenuId === f.id ? null : f.id); }}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <circle cx="5" cy="12" r="2" />
                            <circle cx="12" cy="12" r="2" />
                            <circle cx="19" cy="12" r="2" />
                          </svg>
                        </button>
                        {renderContextMenu(f)}
                      </div>
                    </div>
                  );
                });
                return (
                  <>
                    <div className="ds-fm-media-grid">{elements}</div>
                    {sidebar.filesLoading && <div className="ds-favorites-empty">Loading...</div>}
                  </>
                );
              }

              // Files tab — Bitrix24 stilində siyahı
              const fileElements = filtered.map((f, idx) => {
                const msgDate = formatSectionDate(f.createdAtUtc);
                const prevDate = idx > 0 ? formatSectionDate(filtered[idx - 1].createdAtUtc) : null;
                const showDate = idx === 0 || msgDate !== prevDate;
                const sizeStr = formatFileSize(f.fileSizeInBytes);

                return (
                  <div key={f.id}>
                    {showDate && <div className="ds-favorites-date"><span>{msgDate}</span></div>}
                    <div className="ds-fm-file-item" onClick={() => onScrollToMessage(f.id)}>
                      {/* Rəngli fayl tip ikonu */}
                      <div className="ds-fm-file-icon-wrap">
                        <FileTypeIcon fileName={f.fileName} size={40} />
                      </div>
                      <div className="ds-fm-file-body">
                        <span className="ds-fm-file-name">
                          {renderHighlight(f.fileName, query)}
                        </span>
                        <span className="ds-fm-file-size">{sizeStr}</span>
                        {/* Sender avatar + ad */}
                        <div className="ds-fm-file-sender">
                          <div
                            className="ds-fm-file-sender-avatar"
                            style={{ background: f.senderAvatarUrl ? "transparent" : getAvatarColor(f.senderFullName) }}
                          >
                            {f.senderAvatarUrl ? (
                              <img src={getFileUrl(f.senderAvatarUrl)} alt="" className="ds-fm-file-sender-avatar-img" />
                            ) : (
                              getInitials(f.senderFullName)
                            )}
                          </div>
                          <span className="ds-fm-file-sender-name">{f.senderFullName}</span>
                        </div>
                      </div>
                      {/* More menu */}
                      <div
                        className="ds-favorites-more-wrap"
                        ref={sidebar.filesMenuId === f.id ? sidebar.filesMenuRef : null}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button className="ds-favorites-more-btn" onClick={() => sidebar.setFilesMenuId(sidebar.filesMenuId === f.id ? null : f.id)}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <circle cx="5" cy="12" r="2" />
                            <circle cx="12" cy="12" r="2" />
                            <circle cx="19" cy="12" r="2" />
                          </svg>
                        </button>
                        {renderContextMenu(f)}
                      </div>
                    </div>
                  </div>
                );
              });
              return (
                <>
                  {fileElements}
                  {sidebar.filesLoading && <div className="ds-favorites-empty">Loading...</div>}
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Members paneli — sidebar-ın üstünə gəlir (favorites kimi) */}
      {sidebar.showMembersPanel && selectedChat?.type === 1 && (
        <div className="ds-favorites-panel">
          <div className="ds-favorites-header">
            {sidebar.membersPanelDirect ? (
              /* Mention-dan açılıb → close (X) düyməsi */
              <button className="ds-favorites-back" onClick={() => { sidebar.setShowMembersPanel(false); sidebar.setMembersPanelDirect(false); sidebar.setMemberMenuId(null); sidebar.setShowSidebar(false); }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            ) : (
              /* Sidebar-dan açılıb → back (←) düyməsi */
              <button className="ds-favorites-back" onClick={() => { sidebar.setShowMembersPanel(false); sidebar.setMemberMenuId(null); }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
            )}
            <span className="ds-favorites-title">
              Members: {selectedChat.memberCount || sidebar.membersPanelList.length}
              <button className="ds-mp-add-btn" onClick={() => { sidebar.setShowMembersPanel(false); sidebar.setMemberMenuId(null); sidebar.setMembersPanelDirect(false); channel.setShowAddMember(true); }}>
                + Add
              </button>
            </span>
          </div>

          {/* Members siyahısı */}
          <div
            className="ds-mp-list"
            onScroll={(e) => {
              const { scrollTop, scrollHeight, clientHeight } = e.target;
              if (scrollHeight - scrollTop - clientHeight < 50 && sidebar.membersPanelHasMore && !sidebar.membersPanelLoading) {
                sidebar.loadMembersPanelPage(selectedChat.id, sidebar.membersPanelList.length);
              }
            }}
          >
            {(() => {
              const myRole = channelMembers[selectedChat.id]?.[user.id]?.role;
              const viewerIsOwner = myRole === 3 || myRole === "Owner";
              const viewerIsAdmin = myRole === 2 || myRole === "Admin";

              return sidebar.membersPanelList.map((m) => {
                const uid = m.userId;
                const isMe = uid === user.id;
                const isOwner = m.role === 3 || m.role === "Owner";
                const isAdmin = m.role === 2 || m.role === "Admin";
                const roleLabel = isOwner ? "Owner" : isAdmin ? "Admin" : "Member";
                return (
                  <div key={uid} className="ds-mp-member" ref={sidebar.memberMenuId === uid ? sidebar.memberMenuRef : null}>
                    <div className="ds-mp-avatar-wrap">
                      <div className="ds-mp-avatar" style={{ background: getAvatarColor(m.fullName) }}>
                        {m.avatarUrl ? (
                          <img src={m.avatarUrl} alt="" className="ds-mp-avatar-img" />
                        ) : (
                          getInitials(m.fullName)
                        )}
                      </div>
                      {isOwner && (
                        <span className="ds-mp-owner-badge" title="Owner">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="#f5a623" stroke="#fff" strokeWidth="1.5">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                          </svg>
                        </span>
                      )}
                      {isAdmin && (
                        <span className="ds-mp-admin-badge" title="Admin">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="#4caf50" stroke="#fff" strokeWidth="1.5">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                          </svg>
                        </span>
                      )}
                    </div>
                    <div className="ds-mp-info">
                      <span className="ds-mp-name">
                        {m.fullName}{isMe && <i>(it&apos;s you)</i>}
                      </span>
                      <span className="ds-mp-role">{roleLabel}</span>
                    </div>
                    <button className="ds-mp-more-btn" onClick={() => sidebar.setMemberMenuId(sidebar.memberMenuId === uid ? null : uid)}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="5" cy="12" r="2" />
                        <circle cx="12" cy="12" r="2" />
                        <circle cx="19" cy="12" r="2" />
                      </svg>
                    </button>
                    {sidebar.memberMenuId === uid && (
                      <div className="ds-dropdown ds-mp-dropdown">
                        {!isMe && (
                          <>
                            <button className="ds-dropdown-item" onClick={() => {
                              setMessageText((prev) => prev + `@${m.fullName} `);
                              sidebar.setShowMembersPanel(false);
                              sidebar.setMembersPanelDirect(false);
                              sidebar.setMemberMenuId(null);
                              sidebar.setShowSidebar(false);
                              setTimeout(() => inputRef.current?.focus(), 0);
                            }}>Mention</button>
                            <button className="ds-dropdown-item" onClick={() => {
                              const dmConv = conversations.find((c) => c.type === 0 && c.otherUserId === uid);
                              if (dmConv) setSelectedChat(dmConv);
                              sidebar.setShowMembersPanel(false);
                              sidebar.setMembersPanelDirect(false);
                              sidebar.setMemberMenuId(null);
                              sidebar.setShowSidebar(false);
                            }}>Send private message</button>
                          </>
                        )}
                        <button className="ds-dropdown-item" onClick={() => sidebar.setMemberMenuId(null)}>View profile</button>

                        {/* Owner: member-i admin et */}
                        {!isMe && viewerIsOwner && !isOwner && !isAdmin && (
                          <button className="ds-dropdown-item" onClick={() => channel.handleMakeAdmin(uid)}>Make Administrator</button>
                        )}
                        {/* Owner: admin-i member et */}
                        {!isMe && viewerIsOwner && isAdmin && (
                          <button className="ds-dropdown-item" onClick={() => channel.handleRemoveAdmin(uid)}>Remove from Administrators</button>
                        )}
                        {/* Owner: hər kəsi (admin/member) çıxara bilər */}
                        {!isMe && viewerIsOwner && !isOwner && (
                          <button className="ds-dropdown-item ds-dropdown-danger" onClick={() => channel.handleRemoveFromChat(uid)}>Remove from chat</button>
                        )}
                        {/* Admin: yalnız member-i çıxara bilər */}
                        {!isMe && viewerIsAdmin && !viewerIsOwner && !isOwner && !isAdmin && (
                          <button className="ds-dropdown-item ds-dropdown-danger" onClick={() => channel.handleRemoveFromChat(uid)}>Remove from chat</button>
                        )}

                        {/* Özü: Leave */}
                        {isMe && (
                          <button className="ds-dropdown-item ds-dropdown-danger" onClick={() => {
                            setPendingLeaveChannel(selectedChat);
                            sidebar.setShowMembersPanel(false);
                            sidebar.setMembersPanelDirect(false);
                            sidebar.setMemberMenuId(null);
                          }}>Leave</button>
                        )}
                      </div>
                    )}
                  </div>
                );
              });
            })()}
          </div>
          {channel.actionError && (
            <div className="ds-am-error">{channel.actionError}</div>
          )}
        </div>
      )}

    </div>
  );
}

export default memo(DetailSidebar);
