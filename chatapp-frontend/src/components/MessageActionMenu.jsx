// memo — komponenti cache-lər, props dəyişmədikdə yenidən render etmə
// .NET ekvivalenti: IEqualityComparer ilə dəyər müqayisəsi
import { memo } from "react";
import { downloadFile } from "../services/api";

// MessageActionMenu komponenti — mesaj üzərindəki "⋮" menyusu
// memo ilə wrap edilib — MessageBubble yenidən render olunsa belə,
// bu komponent yalnız öz props-ları dəyişdikdə yenidən render olunur
//
// Props:
//   msg       — mesaj obyekti (id, content, isPinned, isDeleted)
//   isOwn     — bu mesaj cari istifadəçinindirsə true (Edit/Delete göstər)
//   menuRef   — dropdown DOM referansı (flip-up/flip-down üçün)
//   onReply   — Reply seçildi
//   onEdit    — Edit seçildi (yalnız isOwn)
//   onForward — Forward seçildi
//   onPin     — Pin/Unpin seçildi
//   onFavorite — Add to Favorites seçildi
//   onRemoveFavorite — Remove from Favorites seçildi
//   isFavorite — bu mesaj favori siyahısındadırmı
//   onMarkLater — Mark to read later seçildi
//   onSelect  — Select seçildi (çox mesaj seçmə rejiminə gir)
//   onDelete  — Delete seçildi (yalnız isOwn)
//   onClose   — menyu bağlandı
const MessageActionMenu = memo(function MessageActionMenu({
  msg,
  isOwn,
  menuRef,
  onReply,
  onEdit,
  onForward,
  onPin,
  onFavorite,
  onRemoveFavorite,
  isFavorite,
  onMarkLater,
  readLaterMessageId,
  onSelect,
  onDelete,
  onClose,
}) {
  // handleAction — callback çağır + menyu bağla
  // ...args — variadic parametr: callback-ə ötürüləcək hər hansı arqument
  // .NET: Action<T> delegate + Invoke()
  function handleAction(callback, ...args) {
    callback && callback(...args); // callback null/undefined olmasa çağır
    onClose();                     // Hər seçimdən sonra menyu bağla
  }

  return (
    // isOwn true olduqda "own" class — menyunun sola/sağa açılma istiqaməti dəyişir
    <div className={`action-menu ${isOwn ? "own" : ""}`} ref={menuRef}>

      {/* Reply — həmişə görünür (silinmiş mesajda belə) */}
      <button
        className="action-menu-item"
        onClick={() => handleAction(onReply, msg)}
      >
        <span>Reply</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="9 17 4 12 9 7" />
          <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
        </svg>
      </button>

      {/* Qalan menyu əməliyyatları — yalnız silinməmiş mesajlar üçün */}
      {/* {!msg.isDeleted && <> ... </>} — şərti render bloku */}
      {!msg.isDeleted && (
        <>
          {/* Copy — mesajın mətnini clipboard-a kopyala (yalnız content varsa) */}
          {msg.content && (
            <button
              className="action-menu-item"
              onClick={() => {
                navigator.clipboard.writeText(msg.content);
                onClose();
              }}
            >
              <span>Copy</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            </button>
          )}

          {/* Edit — yalnız isOwn (öz mesajını redaktə et) */}
          {isOwn && (
            <button
              className="action-menu-item"
              onClick={() => handleAction(onEdit, msg)}
            >
              <span>Edit</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
          )}

          {/* Download — fayl/şəkil olan mesajlar üçün (Edit-dən sonra) */}
          {msg.fileId && (
            <button
              className="action-menu-item"
              onClick={() => {
                downloadFile(msg.fileId, msg.fileName, msg.fileUrl);
                onClose();
              }}
            >
              <span>Download</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </button>
          )}

          {/* Forward — mesajı başqa chata yönləndir */}
          <button
            className="action-menu-item"
            onClick={() => handleAction(onForward, msg)}
          >
            <span>Forward</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 17 20 12 15 7" />
              <path d="M4 18v-2a4 4 0 0 1 4-4h12" />
            </svg>
          </button>

          {/* Pin / Unpin — msg.isPinned-a görə dinamik mətn və ikon */}
          <button
            className="action-menu-item"
            onClick={() => handleAction(onPin, msg)}
          >
            <span>{msg.isPinned ? "Unpin" : "Pin"}</span>
            {/* Ternary: isPinned → çarpaz xətlə pin ikonu (unpin), deyilsə normal pin */}
            {msg.isPinned ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 4v6l-2 4v2h10v-2l-2-4V4" />
                <line x1="12" y1="16" x2="12" y2="21" />
                <line x1="8" y1="4" x2="16" y2="4" />
                <line x1="4" y1="21" x2="20" y2="3" strokeWidth="2.5" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 4v6l-2 4v2h10v-2l-2-4V4" />
                <line x1="12" y1="16" x2="12" y2="21" />
                <line x1="8" y1="4" x2="16" y2="4" />
              </svg>
            )}
          </button>

          {/* Add to Favorites / Remove from Favorites — isFavorite-a görə toggle */}
          <button
            className="action-menu-item"
            onClick={() => handleAction(isFavorite ? onRemoveFavorite : onFavorite, msg)}
          >
            <span>{isFavorite ? "Remove from Favorites" : "Add to Favorites"}</span>
            {isFavorite ? (
              // Dolu ulduz — favori olduğunu göstərir
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            ) : (
              // Boş ulduz — favori deyil
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            )}
          </button>

          {/* Mark to read later — yalnız qarşı tərəfin mesajında + bu mesaj artıq mark olunmayıbsa */}
          {!isOwn && msg.id !== readLaterMessageId && (
            <button
              className="action-menu-item"
              onClick={() => handleAction(onMarkLater, msg)}
            >
              <span>Mark to read later</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
            </button>
          )}

          {/* Save to drive — fayl/şəkil olan mesajlar üçün (gələcəkdə implement olunacaq) */}
          {msg.fileId && (
            <button
              className="action-menu-item"
              onClick={() => {
                // TODO: Save to drive funksionallığı gələcəkdə implement olunacaq
                onClose();
              }}
            >
              <span>Save to drive</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" />
                <polyline points="7 3 7 8 15 8" />
              </svg>
            </button>
          )}

          {/* Select — çox mesaj seçmə rejiminə keç (bu mesajı seçilmiş başlat) */}
          {/* onSelect(msg.id) — ID-ni ötürürük, mesaj obyektini yox */}
          <button
            className="action-menu-item"
            onClick={() => handleAction(onSelect, msg.id)}
          >
            <span>Select</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </button>

          {/* Delete — yalnız isOwn, "delete" class ilə qırmızı rəng */}
          {isOwn && (
            <button
              className="action-menu-item delete"
              onClick={() => handleAction(onDelete, msg)}
            >
              <span>Delete</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
          )}
        </>
      )}
    </div>
  );
});

export default MessageActionMenu;
