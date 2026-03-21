// memo   — komponenti cache-lər; props dəyişmədikdə yenidən render etmə
// useState — lokal state (menyu açıq/bağlı, reaction picker, tooltip)
// useRef   — DOM referansları (menyu div-i, reaction div-i)
// useEffect — kənar klik handler, menyu pozisyonu yoxlama
// useLayoutEffect — reaction picker-in flip (yuxarı/aşağı açılma)
import { memo, useState, useMemo, useRef, useEffect, useLayoutEffect } from "react";

import {
  getInitials,
  getAvatarColor,
  formatMessageTime, // "HH:mm" formatı
  formatFileSize, // Byte → "2.4 MB"
  parseMentions, // Mesaj mətnini mention segmentlərinə ayır
} from "../utils/chatUtils";
import { getFileUrl, downloadFile } from "../services/api"; // Backend file URL → tam URL
import FileTypeIcon from "./FileTypeIcon"; // Fayl tipinə görə rəngli icon

import {
  QUICK_REACTION_EMOJIS,
  EXPANDED_EXTRA_EMOJIS,
  emojiToUrl,
  renderTextWithEmojis,
} from "../utils/emojiConstants";
import MessageActionMenu from "./MessageActionMenu"; // "⋮" menyu komponenti
import "./MessageBubble.css";

// ─── URL regex — linkləri tapıb klikləyilən etmək üçün ────────────────────────
const URL_REGEX = /(https?:\/\/[^\s<>"')\]]+)/;

// renderTextWithLinks — mətn içindəki URL-ları <a> elementlərinə çevirir
function renderTextWithLinks(text) {
  if (!text || typeof text !== "string") return text;
  const parts = text.split(URL_REGEX);
  if (parts.length === 1) return text; // Link yoxdur
  return parts.map((part, i) =>
    URL_REGEX.test(part) ? (
      <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="message-link">
        {part}
      </a>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

// renderEmojiContent — mətn içindəki Unicode emojiləri Apple CDN şəkillərinə çevirir
// + URL-ları klikləyilən link-lərə çevirir
// renderTextWithEmojis string/array qaytarır → biz JSX-ə çeviririk
// CDN şəkil yüklənmədikdə (onerror) fallback olaraq Unicode emoji göstərilir
function renderEmojiContent(text) {
  const parts = renderTextWithEmojis(text);
  if (typeof parts === "string") return renderTextWithLinks(parts);
  return parts.map((part, i) =>
    typeof part === "string" ? (
      <span key={i}>{renderTextWithLinks(part)}</span>
    ) : (
      <img
        key={i}
        src={part.url}
        alt={part.emoji}
        className="inline-emoji"
        onError={(e) => {
          // CDN-dən yüklənmədikdə Unicode emoji text ilə əvəz et
          const span = document.createElement("span");
          span.textContent = part.emoji;
          e.target.replaceWith(span);
        }}
      />
    ),
  );
}

// MessageBubble — tək bir mesajın balonu
// memo ilə wrap edilib — Chat.jsx-dəki grouped.map() çox element render edir,
// memo olmadan hər yeni mesajda bütün bubbles yenidən render olacaqdı
//
// Props:
//   msg              — mesaj obyekti (id, content, senderId, status, reactions, ...)
//   isOwn            — bu mesaj cari istifadəçinindirsə true (sağa hizalanır)
//   showAvatar       — bu mesajda avatar göstərilsinmi? (son mesajda göstərilir)
//   chatType         — 0=DM, 1=Channel, 2=DepartmentUser
//   selectMode       — çox mesaj seçmə rejimi aktivdirsə true
//   isSelected       — bu mesaj seçilib? (checkbox checked)
//   onReply/onForward/onPin/onFavorite/onRemoveFavorite/onSelect/onToggleSelect/onScrollToMessage/onDelete/onEdit/onReaction/onLoadReactionDetails
//                    — Chat.jsx-dən gəlir, useCallback ilə stabildir
//   isFavorite       — bu mesaj favori siyahısındadırmı (favoriteIds Set-dən)
function MessageBubble({
  msg,
  isOwn,
  showAvatar,
  chatType,
  selectMode,
  isSelected,
  onReply,
  onForward,
  onPin,
  onFavorite,
  onRemoveFavorite,
  isFavorite,
  onMarkLater,
  readLaterMessageId,
  onSelect,
  onToggleSelect,
  onScrollToMessage,
  onDelete,
  onEdit,
  onReaction,
  onLoadReactionDetails,
  onMentionClick,
  onOpenImageViewer,
  onCancelUpload,
  onRetryUpload,
  isNewMessage,
}) {
  // --- LOKAL STATE ---

  // Şəkil yüklənmə vəziyyəti — shimmer + fade-in üçün
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);

  // Şəkil URL dəyişdikdə state reset — render zamanı (React 19 safe, useState pattern)
  const [prevFileUrl, setPrevFileUrl] = useState(msg.fileUrl);
  if (prevFileUrl !== msg.fileUrl) {
    setPrevFileUrl(msg.fileUrl);
    setImgLoaded(false);
    setImgError(false);
  }

  // menuOpen — "⋯" düyməsinə klik → MessageActionMenu açıq/bağlı
  const [menuOpen, setMenuOpen] = useState(false);

  // reactionOpen — reaction düyməsinə klik → reaction picker açıq/bağlı
  const [reactionOpen, setReactionOpen] = useState(false);

  // reactionExpanded — "⌄" düyməsinə klik → genişləndirilmiş emoji siyahısı
  const [reactionExpanded, setReactionExpanded] = useState(false);

  // reactionTooltipOpen — hansı emoji-nin tooltip-i açıqdır? (null = heç biri)
  const [reactionTooltipOpen, setReactionTooltipOpen] = useState(null);

  // reactionDetailsLoading — API-dən kim react etdi yüklənirkən true
  const [reactionDetailsLoading, setReactionDetailsLoading] = useState(false);

  // pickerHovered — mouse picker-in üzərindədirsə true (butonları gizlətmək üçün)
  const [pickerHovered, setPickerHovered] = useState(false);

  // --- DOM REFERANSLARI ---
  const menuRef = useRef(null); // MessageActionMenu div-i
  const reactionRef = useRef(null); // Reaction picker div-i
  const tooltipRef = useRef(null); // Reaction tooltip div-i
  const pickerTimerRef = useRef(null); // Picker bağlanma gecikmə timer-i
  const pickerOpenTimerRef = useRef(null); // Picker açılma gecikmə timer-i
  const menuBtnRectRef = useRef(null); // More butonunun klik anındakı rect-i
  const badgePressRef = useRef(null); // Reaction badge hover timer-i (tooltip üçün)

  // Komponent unmount olduqda timer-ləri təmizlə (memory leak qarşısını al)
  useEffect(() => {
    return () => {
      clearTimeout(pickerTimerRef.current);
      clearTimeout(pickerOpenTimerRef.current);
      clearTimeout(badgePressRef.current);
    };
  }, []);

  // --- TEK PICKER QAYDASI ---
  // Bir picker açılanda digər bubble-ların picker-ini bağla (custom DOM event ilə)
  // .NET ekvivalenti: EventAggregator / Mediator pattern
  useEffect(() => {
    if (reactionOpen) {
      // Bu picker açıldı → digərlərinə xəbər ver
      document.dispatchEvent(
        new CustomEvent("reaction-picker-open", { detail: msg.id }),
      );
    }
  }, [reactionOpen, msg.id]);

  useEffect(() => {
    function handleOtherPickerOpen(e) {
      // Başqa mesajın picker-i açıldı → özümünkünü bağla
      if (e.detail !== msg.id) {
        clearTimeout(pickerTimerRef.current);
        setReactionOpen(false);
        setReactionExpanded(false);
        setPickerHovered(false);
      }
    }
    document.addEventListener("reaction-picker-open", handleOtherPickerOpen);
    return () =>
      document.removeEventListener(
        "reaction-picker-open",
        handleOtherPickerOpen,
      );
  }, [msg.id]);

  // --- KƏNAR KLİK HANDLER ---
  // menuOpen YA reactionOpen YA reactionTooltipOpen açıqdırsa event listener qeydiyyat et
  // Klik bunların xaricinə düşdükdə hamısını bağla
  useEffect(() => {
    function handleClickOutside(e) {
      const clickedInsideMenu =
        menuRef.current && menuRef.current.contains(e.target);
      const clickedInsideReaction =
        reactionRef.current && reactionRef.current.contains(e.target);
      const clickedInsideTooltip =
        tooltipRef.current && tooltipRef.current.contains(e.target);

      // Tooltip kənara klikləndikdə bağla (reaction badge-ə klik istisnası)
      if (
        reactionTooltipOpen &&
        !clickedInsideTooltip &&
        !e.target.closest(".reaction-badge")
      ) {
        setReactionTooltipOpen(null);
      }

      // Menyu + reaction ikisindən kənara klikləndikdə hamısını bağla
      if (!clickedInsideMenu && !clickedInsideReaction) {
        setMenuOpen(false);
        setReactionOpen(false);
        setReactionExpanded(false);
      } else if (!clickedInsideMenu) {
        setMenuOpen(false);
      } else if (!clickedInsideReaction) {
        setReactionOpen(false);
        setReactionExpanded(false);
      }
    }
    if (menuOpen || reactionOpen || reactionTooltipOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    // Cleanup — listener-i sil (like removeEventListener in .NET Blazor)
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen, reactionOpen, reactionTooltipOpen]);

  // Action menu pozisyası — position: fixed ilə viewport-a nisbətən
  // React: child ref → child layout → PARENT layout sırasıyla işləyir
  // Yəni menuRef.current burada artıq set olunub (rAF lazım deyil)
  useLayoutEffect(() => {
    const el = menuRef.current;
    const btnRect = menuBtnRectRef.current;
    if (!menuOpen || !el || !btnRect) return;

    const elHeight = el.scrollHeight;
    const elWidth = el.offsetWidth;

    // Top: butonun altında, yer yoxdursa yuxarıda
    let top;
    if (btnRect.bottom + elHeight + 4 <= window.innerHeight) {
      top = btnRect.bottom + 4;
    } else {
      top = btnRect.top - elHeight - 4;
      if (top < 0) top = 4;
    }

    // Left: isOwn → sola açılır (sağ kənar butonla üst-üstə)
    let left;
    if (isOwn) {
      left = btnRect.right - elWidth;
    } else {
      left = btnRect.left;
    }
    if (left < 4) left = 4;
    if (left + elWidth > window.innerWidth - 4)
      left = window.innerWidth - elWidth - 4;

    el.style.top = `${top}px`;
    el.style.left = `${left}px`;
  }, [menuOpen, isOwn]);

  // Reaction picker pozisyası — position: fixed ilə viewport-a nisbətən hesablanır
  // overflow: auto container-dən çıxır, heç vaxt arxada qalmır
  // useLayoutEffect — DOM render olduqdan sonra, paint-dən ƏVVƏL işlə (jump yoxdur)
  useLayoutEffect(() => {
    const el = reactionRef.current;
    const wrapEl = el?.parentElement; // .bubble-react-wrap
    if (!el || !wrapEl || !reactionOpen) return;

    const wrapRect = wrapEl.getBoundingClientRect();
    const elHeight = el.scrollHeight;
    const elWidth = el.scrollWidth;

    // Scroll container boundary — messages-area container-in görünən sahəsi
    const scrollContainer = wrapEl.closest(".messages-area");
    const containerRect = scrollContainer
      ? scrollContainer.getBoundingClientRect()
      : { top: 0, bottom: window.innerHeight, left: 0, right: window.innerWidth };

    // Yuxarıda yer: quick picker wrap-ın yuxarısında açılır
    // Aşağıda yer yoxdursa yuxarıya, varsa aşağıya expand olur
    let top;
    const spaceBelow = containerRect.bottom - wrapRect.bottom;

    if (!reactionExpanded) {
      // Quick mode — həmişə yuxarıda açılır
      top = wrapRect.top - elHeight;
      // Yuxarıda yer yoxdursa aşağıya flip et
      if (top < containerRect.top) top = wrapRect.bottom;
    } else {
      // Expanded mode — quick sıra yerində qalır, grid aşağıya böyüyür
      // Quick row yüksəkliyi: ~50px (padding + emoji btn)
      const quickRowHeight = 50;
      const quickTop = wrapRect.top - quickRowHeight;

      if (spaceBelow >= elHeight - quickRowHeight) {
        // Aşağıda yer var → quick row yuxarıda, grid aşağıya
        top = quickTop;
      } else {
        // Aşağıda yer yoxdur → tamamilə yuxarıya
        top = wrapRect.top - elHeight;
        if (top < containerRect.top) top = containerRect.top + 4;
      }
    }

    // Sol/sağ: isOwn → sağa yapışıq (sola açılır), deyilsə sola yapışıq (sağa açılır)
    let left;
    if (isOwn) {
      left = wrapRect.right - elWidth; // sağ kənar üst-üstə, sola açılır
    } else {
      left = wrapRect.left; // sol kənar üst-üstə, sağa açılır
    }

    // Ekrandan kənara çıxmasın
    if (left < 4) left = 4;
    if (left + elWidth > window.innerWidth - 4)
      left = window.innerWidth - elWidth - 4;

    el.style.top = `${top}px`;
    el.style.left = `${left}px`;
  }, [reactionOpen, reactionExpanded, isOwn]);

  // Reaction badges rendering — image-only və normal mesajlar üçün ortaq helper
  const renderReactionBadges = () =>
    msg.reactions.map((r) => (
      <div key={r.emoji} className="reaction-badge-wrapper">
        <button
          className="reaction-badge"
          onClick={(e) => {
            e.stopPropagation();
            if (reactionTooltipOpen === r.emoji) {
              setReactionTooltipOpen(null);
              return;
            }
            onReaction && onReaction(msg, r.emoji);
          }}
          onMouseEnter={() => {
            badgePressRef.current = setTimeout(async () => {
              if (reactionTooltipOpen === r.emoji) return;
              setReactionTooltipOpen(r.emoji);
              // Yalnız userFullNames hələ yüklənməyibsə API call et (dedup)
              if (!r.userFullNames || r.userFullNames.length === 0) {
                setReactionDetailsLoading(true);
                try {
                  await onLoadReactionDetails(msg.id);
                } finally {
                  setReactionDetailsLoading(false);
                }
              }
            }, 500);
          }}
          onMouseLeave={() => clearTimeout(badgePressRef.current)}
        >
          <span className="reaction-badge-emoji">
            <img
              src={emojiToUrl(r.emoji)}
              alt={r.emoji}
              className="twemoji"
              draggable="false"
            />
          </span>
          {r.count > 1 && (
            <span className="reaction-badge-count">{r.count}</span>
          )}
        </button>
        {reactionTooltipOpen === r.emoji && (
          <div className="reaction-tooltip visible" ref={tooltipRef}>
            {reactionDetailsLoading ? (
              <div className="reaction-tooltip-item">
                <span className="reaction-tooltip-name reaction-tooltip-loading">
                  Loading...
                </span>
              </div>
            ) : r.userFullNames && r.userFullNames.length > 0 ? (
              r.userFullNames.map((name, i) => (
                <div key={i} className="reaction-tooltip-item">
                  <div
                    className="reaction-tooltip-avatar"
                    style={{ background: getAvatarColor(name) }}
                  >
                    {getInitials(name)}
                  </div>
                  <span className="reaction-tooltip-name">{name}</span>
                </div>
              ))
            ) : (
              <div className="reaction-tooltip-item">
                <span className="reaction-tooltip-name">
                  {r.count} {r.count === 1 ? "person" : "people"} reacted
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    ));

  // Image-only: şəkil + mətn yoxdur — xüsusi layout (overlay timestamp, kənar reaction)
  const isImageOnly =
    !msg.isDeleted &&
    msg.fileUrl &&
    msg.fileContentType?.startsWith("image/") &&
    !msg.content;

  // Şəkil placeholder ölçüləri — Bitrix24 pattern: container-ə əvvəlcədən düzgün ölçü ver
  // Şəkil yüklənməmişdən əvvəl container düzgün hündürlük tutur → layout shift olmur
  const imgContainerStyle = useMemo(() => {
    if (!msg.fileWidth || !msg.fileHeight) return undefined;
    const maxW = 450;
    const maxH = 400;
    if (!msg.content) {
      // Image-only: explicit width + height (container öz ölçüsünü bilmir)
      const scale = Math.min(maxW / msg.fileWidth, maxH / msg.fileHeight, 1);
      return { width: Math.round(msg.fileWidth * scale), height: Math.round(msg.fileHeight * scale) };
    }
    // Image+text: container width CSS-dən gəlir, aspect-ratio ilə hündürlük avtomatik
    return { aspectRatio: `${msg.fileWidth} / ${msg.fileHeight}`, maxHeight: maxH };
  }, [msg.fileWidth, msg.fileHeight, msg.content]);

  // --- JSX RENDER ---
  return (
    // message-row — mesajın tam sırası (checkbox + avatar + bubble)
    // data-bubble-id={msg.id} — handleScrollToMessage-də querySelector üçün
    // data-unread="true" — IntersectionObserver-ın mark-as-read üçün izlədiyi element
    <div
      className={`message-row ${isOwn ? "own" : ""} ${showAvatar ? "has-avatar" : ""} ${isSelected ? "selected" : ""}${isNewMessage ? " new-message" : ""}`}
      data-bubble-id={msg.id}
      // selectMode aktiv + mesaj silinməyibsə klik → toggle select
      onClick={
        selectMode && !msg.isDeleted && !msg._optimistic ? () => onToggleSelect(msg.id) : undefined
      }
      // Spread operator ilə şərti data-* atributları əlavə et
      // !isOwn + !msg.isRead → IntersectionObserver üçün lazımdır
      {...(!isOwn &&
        !msg.isRead && {
          "data-unread": "true",
          "data-msg-id": msg.id,
          "data-conv-id": chatType === 0 ? msg.conversationId : msg.channelId,
          "data-conv-type": String(chatType), // "0" (string) — dataset always string
        })}
    >
      {/* Seçmə checkbox — selectMode aktiv + silinməmiş mesaj üçün */}
      {selectMode && !msg.isDeleted && (
        <div className={`select-checkbox ${isSelected ? "checked" : ""}`}>
          {isSelected && (
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="3"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </div>
      )}

      {/* Avatar artıq sender-group-da render olunur (CSS sticky) */}

      {/* message-bubble — mesajın vizual balonu */}
      {/* CSS :hover ilə butonlar göstərilir — JS hover state lazım deyil */}
      {/* actions-locked class: menyu/reaction açıq olduqda butonlar görünməyə davam etsin */}
      <div
        className={`message-bubble ${isOwn ? "own" : ""}${menuOpen ? " menu-open" : ""}${reactionOpen ? " reaction-open" : ""}${pickerHovered ? " picker-hovered" : ""}${selectMode ? " select-mode" : ""}${isImageOnly ? " image-only" : ""}`}
        onContextMenu={
          selectMode || msg._optimistic
            ? undefined
            : (e) => {
                e.preventDefault();
                // Sağ klik pozisyasını saxla — menu orada açılacaq
                menuBtnRectRef.current = {
                  top: e.clientY,
                  bottom: e.clientY,
                  left: e.clientX,
                  right: e.clientX,
                };
                setMenuOpen(true);
                setReactionOpen(false);
              }
        }
      >
        {/* Forwarded label — yönləndirilmiş mesaj */}
        {msg.isForwarded && !msg.isDeleted && (
          <div className="forwarded-label">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="15 17 20 12 15 7" />
              <path d="M4 18v-2a4 4 0 0 1 4-4h12" />
            </svg>
            <span>Forwarded message</span>
          </div>
        )}

        {/* Reply reference — bu mesaj başqa mesaja reply edirsə */}
        {msg.replyToMessageId && !msg.isDeleted && (
          <div
            className="reply-reference"
            // Reply-a klik → həmin mesaja scroll et
            onClick={() =>
              onScrollToMessage && onScrollToMessage(msg.replyToMessageId)
            }
          >
            <div className="reply-reference-bar" />
            <div className="reply-reference-body">
              <span className="reply-reference-name">
                {msg.replyToSenderName}
              </span>
              <span className="reply-reference-text">
                {msg.replyToFileId
                  ? msg.replyToFileContentType?.startsWith("image/")
                    ? msg.replyToContent
                      ? `[Image] ${msg.replyToContent}`
                      : "[Image]"
                    : msg.replyToContent
                      ? `File: ${msg.replyToFileName || "File"} — ${msg.replyToContent}`
                      : `File: ${msg.replyToFileName || "File"}`
                  : msg.replyToContent}
              </span>
            </div>
          </div>
        )}

        {/* Mesaj məzmunu */}
        <div className="message-content">
          {msg.isDeleted ? (
            // Silinmiş mesaj — məzmun yerinə standart mesaj
            <span className="deleted-message-text">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
              This message was deleted.
            </span>
          ) : (
            <>
              {/* Fayl/şəkil — mətn-dən ƏVVƏL render olunur */}
              {/* fileUrl: server URL, _uploading: upload davam edir, fileName: upload bitib amma echo gəlməyib */}
              {(msg.fileUrl || msg._uploading || msg.fileName) &&
                (msg.fileContentType?.startsWith("image/") ? (
                  // Şəkil — Bitrix24 style: shimmer placeholder → fade-in
                  <div
                    className={`bubble-file-image${!msg.content ? " image-only" : ""}${imgContainerStyle ? " has-dimensions" : ""}${msg._uploading ? " uploading" : ""}`}
                    style={imgContainerStyle}
                  >
                    {/* Shimmer placeholder — şəkil yüklənənə qədər animasiyalı fon */}
                    {!imgLoaded && !imgError && !msg._uploading && (
                      <div className="img-shimmer" />
                    )}
                    {/* Error state — klikləyərək yenidən yüklə */}
                    {imgError && !msg._uploading && (
                      <div className="img-error" onClick={() => { setImgError(false); setImgLoaded(false); }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="23 4 23 10 17 10" />
                          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                        </svg>
                        <span>Click to retry</span>
                      </div>
                    )}
                    {/* Əsl şəkil — upload zamanı lokal preview, tamamlandıqda server URL */}
                    {!imgError && (
                      <img
                        src={msg._uploading || msg._localPreview ? msg.fileUrl : getFileUrl(msg.fileUrl)}
                        alt={msg.fileName || "Image"}
                        loading="lazy"
                        className={imgLoaded || msg._uploading || msg._localPreview ? "loaded" : ""}
                        onLoad={() => setImgLoaded(true)}
                        onError={() => !msg._uploading && !msg._localPreview && setImgError(true)}
                        onClick={() =>
                          !msg._uploading && onOpenImageViewer && onOpenImageViewer(msg.id)
                        }
                      />
                    )}
                    {/* Upload overlay — Bitrix24 style: cancel/retry + progress */}
                    {msg._uploading && (
                      <div className="upload-overlay">
                        {msg._uploadStatus === "uploading" || msg._uploadStatus === "sending" ? (
                          <>
                            <button
                              className="upload-cancel-btn"
                              onClick={(e) => { e.stopPropagation(); onCancelUpload?.(msg._uploadTempId); }}
                            >
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                              </svg>
                            </button>
                            {msg._uploadStatus === "uploading" && (
                              <span className="upload-progress-text">
                                {formatFileSize(msg._uploadedBytes)} / {formatFileSize(msg._totalBytes)}
                              </span>
                            )}
                            {msg._uploadStatus === "sending" && (
                              <span className="upload-progress-text">Göndərilir...</span>
                            )}
                          </>
                        ) : msg._uploadStatus === "failed" ? (
                          <button
                            className="upload-retry-btn"
                            onClick={(e) => { e.stopPropagation(); onRetryUpload?.(msg._uploadTempId); }}
                          >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="23 4 23 10 17 10" />
                              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                            </svg>
                            <span>Yenidən cəhd et</span>
                          </button>
                        ) : null}
                      </div>
                    )}
                  </div>
                ) : (
                  // Non-image fayl — Bitrix24 style kart
                  <div
                    className={`bubble-file-card${msg._uploading ? " uploading" : ""}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!msg._uploading && msg.fileUrl) downloadFile(msg.fileId, msg.fileName, msg.fileUrl);
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="bubble-file-icon">
                      {/* Fayl tipinə görə rəngli icon + extension badge */}
                      <FileTypeIcon fileName={msg.fileName} size={32} />
                      <span
                        className={`bubble-file-badge ${(msg.fileName?.split(".").pop() || "").toLowerCase()}`}
                      >
                        {(msg.fileName?.split(".").pop() || "").toUpperCase()}
                      </span>
                      {/* Upload overlay — fayl icon üzərində */}
                      {msg._uploading && (
                        <div className="upload-file-icon-overlay">
                          {(msg._uploadStatus === "uploading" || msg._uploadStatus === "sending") ? (
                            <button
                              className="upload-cancel-btn-small"
                              onClick={(e) => { e.stopPropagation(); onCancelUpload?.(msg._uploadTempId); }}
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                              </svg>
                            </button>
                          ) : msg._uploadStatus === "failed" ? (
                            <button
                              className="upload-retry-btn-small"
                              onClick={(e) => { e.stopPropagation(); onRetryUpload?.(msg._uploadTempId); }}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="23 4 23 10 17 10" />
                                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                              </svg>
                            </button>
                          ) : null}
                        </div>
                      )}
                    </div>
                    <div className="bubble-file-info">
                      <span className="bubble-file-name">{msg.fileName}</span>
                      <span className="bubble-file-size">
                        {msg._uploading && msg._uploadStatus === "uploading"
                          ? `${formatFileSize(msg._uploadedBytes)} / ${formatFileSize(msg._totalBytes)}`
                          : msg._uploading && msg._uploadStatus === "failed"
                            ? "Yüklənmə uğursuz"
                            : formatFileSize(msg.fileSizeInBytes)}
                      </span>
                    </div>
                    {!msg._uploading && msg.fileUrl && (
                      <div className="bubble-file-download">
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <circle cx="12" cy="12" r="10" strokeWidth="1.5" />
                          <polyline points="8 12 12 16 16 12" />
                          <line x1="12" y1="8" x2="12" y2="16" />
                        </svg>
                      </div>
                    )}
                  </div>
                ))}

              {/* Mətn — yalnız content varsa render et (fayl-only mesaj üçün boş ola bilər) */}
              {msg.content &&
                (msg.mentions && msg.mentions.length > 0
                  ? parseMentions(msg.content, msg.mentions).map((seg, i) =>
                      seg.type === "mention" ? (
                        <span
                          key={i}
                          className="mention-highlight"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onMentionClick) onMentionClick(seg);
                          }}
                        >
                          {seg.text}
                        </span>
                      ) : (
                        <span key={i}>{renderEmojiContent(seg.text)}</span>
                      ),
                    )
                  : renderEmojiContent(msg.content))}
            </>
          )}
        </div>

        {/* Image-only: reaction badges bubble-ın birbaşa uşağı (şəklin altında görsənəcək) */}
        {isImageOnly && msg.reactions && msg.reactions.length > 0 && (
          <div className="reaction-badges reaction-badges-external">
            {renderReactionBadges()}
          </div>
        )}

        {/* Meta sıra: sol — reactions (normal mesajlarda), sağ — modified + vaxt + ticks */}
        <div className="message-meta">
          {/* Reaction badges — sol tərəf (yalnız normal mesajlarda, image-only-da yuxarıda render olunur) */}
          {!isImageOnly && msg.reactions && msg.reactions.length > 0 && (
            <div className="reaction-badges">
              {renderReactionBadges()}
            </div>
          )}

          {/* "modified" — mesaj redaktə edilmişsə */}
          {msg.isEdited && <span className="message-modified">modified</span>}

          {/* Vaxt — "HH:mm" */}
          <span className="message-time">
            {formatMessageTime(msg.createdAtUtc)}
          </span>

          {/* Status icon — yalnız öz mesajları üçün */}
          {/* status: 0=Pending(saat), 1=Sent(tək tik), 2=Delivered(ikiqat tik), 3=Read(mavi tik) */}
          {isOwn && msg.status === 0 && (
            <svg
              className="read-check"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#9ca3af"
              strokeWidth="2"
            >
              {/* Saat ikonu — mesaj hələ göndərilmir (Pending) */}
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          )}
          {isOwn && msg.status >= 1 && (
            <svg
              className="read-check"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              // status=3 (Read) → mavi, digər → boz
              stroke={msg.status === 3 ? "#46CDF0" : "#9ca3af"}
              strokeWidth="2.5"
            >
              {/* status >= 2 → ikiqat tik (Delivered/Read), 1 → tək tik (Sent) */}
              {msg.status >= 2 ? (
                <>
                  <polyline points="18 6 7 17 2 12" />
                  <polyline points="22 6 11 17 8 14" />
                </>
              ) : (
                <polyline points="20 6 9 17 4 12" />
              )}
            </svg>
          )}
        </div>

        {/* More butonu — həmişə DOM-da, CSS :hover ilə görünür (pending mesajda yox) */}
        {!selectMode && !msg._optimistic && (
          <div className={`bubble-more-wrap ${isOwn ? "own" : ""}`}>
            <button
              className="bubble-action-btn"
              title="More"
              onClick={(e) => {
                menuBtnRectRef.current =
                  e.currentTarget.getBoundingClientRect();
                setMenuOpen(!menuOpen);
                setReactionOpen(false);
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <circle cx="5" cy="12" r="2" />
                <circle cx="12" cy="12" r="2" />
                <circle cx="19" cy="12" r="2" />
              </svg>
            </button>
          </div>
        )}

        {/* Action menu — bubble-more-wrap-dan KƏNARDA (transform containing block problemi) */}
        {/* position: fixed + transform olan ancestor = sınıq pozisya */}
        {menuOpen && (
          <MessageActionMenu
            msg={msg}
            isOwn={isOwn}
            menuRef={menuRef}
            onReply={onReply}
            onEdit={onEdit}
            onForward={onForward}
            onPin={onPin}
            onFavorite={onFavorite}
            onRemoveFavorite={onRemoveFavorite}
            isFavorite={isFavorite}
            onMarkLater={onMarkLater}
            readLaterMessageId={readLaterMessageId}
            onSelect={onSelect}
            onDelete={onDelete}
            onClose={() => setMenuOpen(false)}
          />
        )}

        {/* React butonu + picker — hover ilə açılır, CSS ilə göstərilir (pending mesajda yox) */}
        {!selectMode && !msg.isDeleted && !msg._optimistic && (
          <div
            className={`bubble-react-wrap ${isOwn ? "own" : ""}${reactionOpen ? " picker-open" : ""}`}
            onMouseEnter={() => {
              clearTimeout(pickerTimerRef.current);
              // Dərhal açma — 400ms gözlə
              pickerOpenTimerRef.current = setTimeout(() => {
                setReactionOpen(true);
                setMenuOpen(false);
              }, 400);
            }}
            onMouseLeave={() => {
              clearTimeout(pickerOpenTimerRef.current);
              // Picker-dən çıxanda dərhal bağlama — 1000ms gözlə
              pickerTimerRef.current = setTimeout(() => {
                setReactionOpen(false);
                setReactionExpanded(false);
                setPickerHovered(false);
              }, 1000);
            }}
          >
            <button
              className="bubble-action-btn"
              title="Like"
              onClick={() => {
                onReaction && onReaction(msg, "👍");
              }}
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M2 20h2V10H2v10zm19.8-9.2c-.3-.4-.8-.6-1.3-.6h-5.6l.8-4c.1-.5 0-1-.4-1.4-.3-.3-.8-.5-1.3-.5h-.3c-.4.1-.7.4-.9.8L10.6 10H8v10h8.3c.7 0 1.3-.4 1.5-1l2.7-7c.2-.4.1-.9-.2-1.2z" />
              </svg>
            </button>

            {/* Reaction picker — hover ilə açılır */}
            {/* Quick sıra həmişə görünür, expand olduqda əlavə emojilər altda göstərilir */}
            <div
              className={`reaction-picker ${isOwn ? "own" : ""}`}
              ref={reactionRef}
              onMouseEnter={() => setPickerHovered(true)}
              onMouseLeave={() => setPickerHovered(false)}
            >
              {/* Bütün emojilər — vahid grid + scroll */}
              <div
                className={`reaction-emoji-grid${reactionExpanded ? " expanded" : ""}`}
              >
                {QUICK_REACTION_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    className="reaction-emoji-btn"
                    onClick={() => {
                      onReaction && onReaction(msg, emoji);
                      setReactionOpen(false);
                      setReactionExpanded(false);
                    }}
                  >
                    <img
                      src={emojiToUrl(emoji)}
                      alt={emoji}
                      className="twemoji"
                      draggable="false"
                    />
                  </button>
                ))}
                {reactionExpanded &&
                  EXPANDED_EXTRA_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      className="reaction-emoji-btn"
                      onClick={() => {
                        onReaction && onReaction(msg, emoji);
                        setReactionOpen(false);
                        setReactionExpanded(false);
                      }}
                    >
                      <img
                        src={emojiToUrl(emoji)}
                        alt={emoji}
                        className="twemoji"
                        draggable="false"
                      />
                    </button>
                  ))}
              </div>
              {/* Expand/collapse butonu */}
              {!reactionExpanded && (
                <button
                  className="reaction-expand-btn"
                  onClick={() => setReactionExpanded(true)}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Custom comparator — yalnız data prop-ları müqayisə et, function prop-ları skip et.
// renderFlatItem ref pattern istifadə etdiyi üçün handler-lar hər render-də yeni referansdır,
// amma eyni funksiyadır. Function-ları müqayisəyə daxil etsək memo işləməz.
function areEqual(prev, next) {
  return (
    prev.msg === next.msg &&
    prev.isOwn === next.isOwn &&
    prev.showAvatar === next.showAvatar &&
    prev.chatType === next.chatType &&
    prev.selectMode === next.selectMode &&
    prev.isSelected === next.isSelected &&
    prev.isFavorite === next.isFavorite &&
    prev.readLaterMessageId === next.readLaterMessageId &&
    prev.isNewMessage === next.isNewMessage
  );
}

export default memo(MessageBubble, areEqual);
