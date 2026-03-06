import { useEffect } from "react";
import { getInitials, getAvatarColor } from "../utils/chatUtils";

// MentionPanel — @ mention dropdown paneli
// ChatInputArea daxilində render olunur (emoji panel kimi)
// Props:
//   items          — göstəriləcək elementlər: [{ id, fullName, position, type, isAll }]
//   selectedIndex  — keyboard navigation ilə seçilmiş element indeksi
//   onSelect       — element seçildikdə callback
//   isLoading      — API axtarışı gedir
//   panelRef       — click-outside detection üçün ref
function MentionPanel({ items, selectedIndex, onSelect, isLoading, panelRef }) {
  // Keyboard navigation zamanı seçilmiş elementi görünən yerə scroll et
  useEffect(() => {
    const list = panelRef.current?.querySelector(".mention-panel-list");
    if (!list) return;
    const selected = list.children[selectedIndex];
    if (selected) {
      selected.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [selectedIndex, panelRef]);

  return (
    <div className="mention-panel" ref={panelRef}>
      <div className="mention-panel-list">
        {items.map((item, i) => (
          <div
            key={item.isAll ? "all" : item.id}
            className={`mention-item${i === selectedIndex ? " selected" : ""}`}
            onMouseDown={(e) => {
              e.preventDefault(); // textarea focus itkisini əngəllə
              onSelect(item);
            }}
          >
            {item.isAll ? (
              /* All members — xüsusi sıra */
              <>
                <div className="mention-avatar mention-avatar-all">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </div>
                <div className="mention-info">
                  <span className="mention-name">All members</span>
                  <span className="mention-position">All members</span>
                </div>
              </>
            ) : item.type === "channel" ? (
              /* Channel mention */
              <>
                <div className="mention-avatar" style={{ background: getAvatarColor(item.fullName) }}>
                  {getInitials(item.fullName)}
                </div>
                <div className="mention-info">
                  <span className="mention-name">{item.fullName}</span>
                  <span className="mention-position">Group chat</span>
                </div>
              </>
            ) : (
              /* User mention */
              <>
                <div className="mention-avatar" style={{ background: getAvatarColor(item.fullName) }}>
                  {getInitials(item.fullName)}
                </div>
                <div className="mention-info">
                  <span className="mention-name">{item.fullName}</span>
                  {item.position && <span className="mention-position">{item.position}</span>}
                </div>
              </>
            )}
          </div>
        ))}
        {isLoading && (
          <div className="mention-loading">
            Searching
            <div className="mention-loading-dots">
              <span></span><span></span><span></span>
            </div>
          </div>
        )}
        {!isLoading && items.length === 0 && (
          <div className="mention-empty">No results</div>
        )}
      </div>

      {/* Footer — keyboard hint */}
      <div className="mention-panel-footer">
        <span>↑↓</span> to select user or chat
        &nbsp;&nbsp;<span>Enter</span> to select
        &nbsp;&nbsp;<span>Esc</span> to cancel
      </div>
    </div>
  );
}

export default MentionPanel;
