import { useState, useRef, useCallback, memo } from "react";
import { getInitials, getAvatarColor } from "../utils/chatUtils";
import { getFileUrl } from "../services/api";
import "./ReadersPanel.css";

const READERS_PAGE_SIZE = 20;

// ReadersPanel — channel mesajını oxuyan istifadəçilərin siyahısı
// Emoji reaction panel pattern-i ilə eyni — modal overlay
// Paginated: 20 nəfər göstərir, scroll ilə daha çox yüklənir
function ReadersPanel({ readByIds, channelMembers, onClose }) {
  const [displayCount, setDisplayCount] = useState(READERS_PAGE_SIZE);
  const listRef = useRef(null);

  // readByIds (Guid[]) → { id, fullName, avatarUrl } array-ına çevir
  const readers = readByIds
    .map((id) => {
      const member = channelMembers[id];
      return member
        ? { id, fullName: member.fullName, avatarUrl: member.avatarUrl }
        : null;
    })
    .filter(Boolean);

  const visibleReaders = readers.slice(0, displayCount);
  const hasMore = displayCount < readers.length;

  // Scroll handler — aşağıya yaxınlaşanda daha çox yüklə
  const handleScroll = useCallback(() => {
    const el = listRef.current;
    if (!el || !hasMore) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 50) {
      setDisplayCount((prev) => prev + READERS_PAGE_SIZE);
    }
  }, [hasMore]);

  return (
    <div className="readers-panel-overlay" onClick={onClose}>
      <div className="readers-panel" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="readers-panel-header">
          <span>Viewed by {readers.length}</span>
          <button className="readers-panel-close" onClick={onClose} aria-label="Close readers panel">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Reader list — scrollable */}
        <div
          className="readers-panel-list"
          ref={listRef}
          onScroll={handleScroll}
        >
          {visibleReaders.map((reader) => (
            <div key={reader.id} className="readers-panel-item">
              <div
                className="readers-panel-avatar"
                style={{ background: reader.avatarUrl ? "transparent" : getAvatarColor(reader.fullName) }}
              >
                {reader.avatarUrl ? (
                  <img src={getFileUrl(reader.avatarUrl)} alt={reader.fullName} className="readers-panel-avatar-img" onError={(e) => { e.target.style.display = "none"; e.target.parentNode.style.background = getAvatarColor(reader.fullName); e.target.parentNode.textContent = getInitials(reader.fullName); }} />
                ) : getInitials(reader.fullName)}
              </div>
              <span className="readers-panel-name">{reader.fullName}</span>
            </div>
          ))}
          {hasMore && (
            <div className="readers-panel-loading">Loading...</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(ReadersPanel);
