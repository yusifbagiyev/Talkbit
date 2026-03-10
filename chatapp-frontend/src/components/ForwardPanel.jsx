import { useState, useEffect, useRef } from "react";
import { apiGet } from "../services/api";
import { getInitials, getAvatarColor } from "../utils/chatUtils";

function ForwardPanel({ conversations, onForward, onClose }) {
  const [searchText, setSearchText] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const searchInputRef = useRef(null);
  const debounceRef = useRef(null);

  // Panel açılanda search input-a focus ver + unmount cleanup
  useEffect(() => {
    searchInputRef.current?.focus();
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // Overlay-ə klik → panel bağlansın
  function handleOverlayClick(e) {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }

  // Escape ilə bağla
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Debounced search
  function handleSearchChange(value) {
    setSearchText(value);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (value.trim().length < 2) {
      setSearchResults(null);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      try {
        const q = encodeURIComponent(value.trim());
        // Conversations + users paralel axtarış
        const [convData, users] = await Promise.all([
          apiGet(`/api/unified-conversations?pageSize=50&search=${q}`),
          apiGet(`/api/users/search?q=${q}`),
        ]);
        const convItems = convData.items || [];
        // Mövcud conversation-ı olan user-ləri çıxar (dublikat olmasın)
        const convOtherUserIds = new Set(convItems.map((c) => c.otherUserId).filter(Boolean));
        const newUsers = (users || [])
          .filter((u) => !convOtherUserIds.has(u.id))
          .map((u) => ({
            id: u.id,
            name: u.fullName,
            type: 0,
            isNewUser: true,
            userId: u.id,
          }));
        setSearchResults([...convItems, ...newUsers]);
      } catch (err) {
        console.error("Forward search failed:", err);
        setSearchResults([]);
      }
    }, 300);
  }

  // Göstəriləcək siyahı: search varsa search nəticələri, yoxdursa recent chats
  const displayList = searchResults !== null ? searchResults : conversations;

  function getSubtitle(item) {
    if (item.isNewUser) return "User";
    if (item.type === 1) return `${item.memberCount || 0} members`;
    if (item.type === 2) return item.positionName || item.departmentName || "User";
    return item.otherUserPosition || item.otherUserRole || "User";
  }

  return (
    <div className="forward-overlay" onClick={handleOverlayClick}>
      <div className="forward-panel">
        <div className="forward-header">
          <h3>Forward message</h3>
          <button className="forward-close-btn" onClick={onClose}>
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

        <div className="forward-search-wrapper">
          <svg
            className="forward-search-icon"
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
          <input
            ref={searchInputRef}
            type="text"
            className="forward-search-input"
            placeholder="Search chats..."
            value={searchText}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
        </div>

        <div className="forward-list">
          {displayList.length === 0 ? (
            <div className="forward-empty">No chats found</div>
          ) : (
            <>
              {searchResults === null && (
                <div className="forward-section-label">Recent chats</div>
              )}
              {displayList.map((item) => (
                <div
                  key={item.id}
                  className="forward-item"
                  onClick={() => onForward(item)}
                >
                  <div
                    className="forward-item-avatar"
                    style={{ background: item.isNotes ? "#2FC6F6" : getAvatarColor(item.name) }}
                  >
                    {item.isNotes ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="white" stroke="white" strokeWidth="2">
                        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                      </svg>
                    ) : (
                      getInitials(item.name)
                    )}
                  </div>
                  <div className="forward-item-info">
                    <span className="forward-item-name">{item.name}</span>
                    <span className="forward-item-subtitle">
                      {getSubtitle(item)}
                    </span>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default ForwardPanel;
