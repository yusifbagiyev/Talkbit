import { memo } from "react";
// Utility funksiyaları import et
import { getInitials, getAvatarColor, getMessagePreview } from "../utils/chatUtils";
import { getFileUrl } from "../services/api";
import "./PinnedBar.css";

// PinnedBar komponenti — chatın üstündə compact pinlənmiş mesaj barı
// Bir dəfədə bir pinlənmiş mesaj göstərir, klikləndikdə həmin mesaja scroll edir
// Props:
//   pinnedMessages  — pinlənmiş mesajlar array-i
//   currentPinIndex — hazırda göstərilən pin-in indeksi
//   onPinClick      — bar-a klik → həmin mesaja scroll et + növbəti pin-ə keç
//   onToggleExpand  — pin ikonu → PinnedExpanded-i aç/bağla
function PinnedBar({
  pinnedMessages,
  currentPinIndex,
  onPinClick,
  onToggleExpand,
}) {
  // Pinlənmiş mesaj yoxdursa heç nə render etmə (early return)
  // null qaytarmaq — komponenti render etməmək deməkdir
  if (!pinnedMessages || pinnedMessages.length === 0) return null;

  // Hazırda göstəriləcək mesaj — currentPinIndex-ə görə
  // Fallback: index mövcud deyilsə ilk pin-i göstər
  const currentMsg = pinnedMessages[currentPinIndex] || pinnedMessages[0];
  const total = pinnedMessages.length; // Cəmi pin sayı

  return (
    // Bar-a klik → onPinClick(messageId) çağırılır
    // Chat.jsx-də: həmin mesaja scroll et + növbəti pin-ə keç
    <div
      className="pinned-bar"
      onClick={() => onPinClick(currentMsg.id)}
    >
      {/* Sol: başlıq + mesaj preview */}
      <div className="pinned-bar-body">
        <span className="pinned-bar-title">Pinned messages</span>
        <span className="pinned-bar-preview">
          {/* Kim yazdı + mesaj məzmununun qısa görünüşü (fayl/şəkil üçün [Image]/[File]) */}
          <strong>{currentMsg.senderFullName}:</strong> {getMessagePreview(currentMsg)}
        </span>
      </div>

      {/* Sağ: "X / N" sayğacı + pin list açma düyməsi */}
      {/* e.stopPropagation() — sağ tərəfə klik bar-ın onClick-ini tetikləməsin */}
      <div
        className="pinned-bar-right"
        onClick={(e) => e.stopPropagation()}
      >
        {/* "1 / 3" formatı — currentPinIndex 0-based, göstərmək üçün +1 */}
        <span className="pinned-bar-count">
          {currentPinIndex + 1} / {total}
        </span>
        {/* Pin list açma düyməsi → PinnedExpanded göstər */}
        <button
          className="pinned-bar-btn"
          title="Show all pinned"
          onClick={onToggleExpand}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <line x1="12" y1="17" x2="12" y2="22" />
            <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// PinnedExpanded komponenti — bütün pinlənmiş mesajların genişləndirilmiş siyahısı
// PinnedBar-dan ayrı komponentdir, named export ilə export olunur
// Props:
//   pinnedMessages   — pinlənmiş mesajlar array-i
//   onToggleExpand   — bağla düyməsi
//   onScrollToMessage — mesaja klik → həmin mesaja scroll et
//   onUnpin          — unpin düyməsi → mesajı pinlərdən çıxar
function PinnedExpanded({
  pinnedMessages,
  onToggleExpand,
  onScrollToMessage,
  onUnpin,
}) {
  return (
    <div className="pinned-expanded">
      {/* Başlıq + bağla düyməsi */}
      <div className="pinned-expanded-header">
        <span>Pinned messages: {pinnedMessages.length}</span>
        <button
          className="pinned-expanded-close"
          onClick={onToggleExpand}
          title="Close"
        >
          <svg
            width="16"
            height="16"
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

      {/* Pinlənmiş mesajlar siyahısı */}
      <div className="pinned-expanded-list">
        {/* .map() — hər pin üçün sətir render et */}
        {pinnedMessages.map((msg) => (
          <div
            key={msg.id}
            className="pinned-expanded-item"
            onClick={() => onScrollToMessage(msg.id)}
          >
            {/* Avatar */}
            <div
              className="pinned-expanded-avatar"
              style={{ background: msg.senderAvatarUrl ? "transparent" : getAvatarColor(msg.senderFullName) }}
            >
              {msg.senderAvatarUrl ? (
                <img src={getFileUrl(msg.senderAvatarUrl)} alt={msg.senderFullName} className="pinned-expanded-avatar-img" onError={(e) => { e.target.style.display = "none"; e.target.parentNode.style.background = getAvatarColor(msg.senderFullName); e.target.parentNode.textContent = getInitials(msg.senderFullName); }} />
              ) : getInitials(msg.senderFullName)}
            </div>

            {/* Mesaj məlumatı */}
            <div className="pinned-expanded-info">
              <span className="pinned-expanded-name">
                {msg.senderFullName}
              </span>
              <span className="pinned-expanded-text">{getMessagePreview(msg)}</span>
            </div>

            {/* Unpin düyməsi */}
            {/* e.stopPropagation() — unpin klik sətirin onClick-ini tetikləməsin */}
            <button
              className="pinned-expanded-unpin"
              title="Unpin"
              onClick={(e) => {
                e.stopPropagation();
                onUnpin(msg);
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <line x1="12" y1="17" x2="12" y2="22" />
                <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
                {/* Çarpaz xətt — unpin ikonu */}
                <line x1="2" y1="2" x2="22" y2="22" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// default export — PinnedBar əsas komponentdir
export default memo(PinnedBar);

// named export — PinnedExpanded əlavə komponentdir
// import PinnedBar, { PinnedExpanded } from "./PinnedBar" ilə istifadə olunur
const MemoizedPinnedExpanded = memo(PinnedExpanded);
export { MemoizedPinnedExpanded as PinnedExpanded };
