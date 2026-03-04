// memo   — komponenti cache-lər; props dəyişmədikdə yenidən render etmə
// useState — lokal state (menyu açıq/bağlı, reaction picker, tooltip)
// useRef   — DOM referansları (menyu div-i, reaction div-i)
// useEffect — kənar klik handler, menyu pozisyonu yoxlama
// useLayoutEffect — reaction picker-in flip (yuxarı/aşağı açılma)
import { memo, useState, useRef, useEffect, useLayoutEffect } from "react";

import {
  getInitials,
  getAvatarColor,
  formatMessageTime,    // "HH:mm" formatı
} from "../utils/chatUtils";

import { QUICK_REACTION_EMOJIS, EXPANDED_EXTRA_EMOJIS, emojiToUrl } from "../utils/emojiConstants";
import MessageActionMenu from "./MessageActionMenu"; // "⋮" menyu komponenti

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
const MessageBubble = memo(function MessageBubble({
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
}) {
  // --- LOKAL STATE ---

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
  const menuRef = useRef(null);     // MessageActionMenu div-i
  const reactionRef = useRef(null); // Reaction picker div-i
  const tooltipRef = useRef(null);  // Reaction tooltip div-i
  const pickerTimerRef = useRef(null);     // Picker bağlanma gecikmə timer-i
  const pickerOpenTimerRef = useRef(null); // Picker açılma gecikmə timer-i
  const menuBtnRectRef = useRef(null);    // More butonunun klik anındakı rect-i
  const badgePressRef = useRef(null);     // Reaction badge hover timer-i (tooltip üçün)

  // Komponent unmount olduqda timer-ləri təmizlə (memory leak qarşısını al)
  useEffect(() => {
    return () => {
      clearTimeout(pickerTimerRef.current);
      clearTimeout(pickerOpenTimerRef.current);
    };
  }, []);

  // --- TEK PICKER QAYDASI ---
  // Bir picker açılanda digər bubble-ların picker-ini bağla (custom DOM event ilə)
  // .NET ekvivalenti: EventAggregator / Mediator pattern
  useEffect(() => {
    if (reactionOpen) {
      // Bu picker açıldı → digərlərinə xəbər ver
      document.dispatchEvent(new CustomEvent("reaction-picker-open", { detail: msg.id }));
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
    return () => document.removeEventListener("reaction-picker-open", handleOtherPickerOpen);
  }, [msg.id]);

  // --- KƏNAR KLİK HANDLER ---
  // menuOpen YA reactionOpen YA reactionTooltipOpen açıqdırsa event listener qeydiyyat et
  // Klik bunların xaricinə düşdükdə hamısını bağla
  useEffect(() => {
    function handleClickOutside(e) {
      const clickedInsideMenu = menuRef.current && menuRef.current.contains(e.target);
      const clickedInsideReaction = reactionRef.current && reactionRef.current.contains(e.target);
      const clickedInsideTooltip = tooltipRef.current && tooltipRef.current.contains(e.target);

      // Tooltip kənara klikləndikdə bağla (reaction badge-ə klik istisnası)
      if (reactionTooltipOpen && !clickedInsideTooltip && !e.target.closest(".reaction-badge")) {
        setReactionTooltipOpen(null);
      }

      // Menyu + reaction ikisindən kənara klikləndikdə hamısını bağla
      if (!clickedInsideMenu && !clickedInsideReaction) {
        setMenuOpen(false);
        setReactionOpen(false);
        setReactionExpanded(false);
        setShowActions(false);
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
    if (left + elWidth > window.innerWidth - 4) left = window.innerWidth - elWidth - 4;

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

    // Yuxarıda yer: quick picker wrap-ın yuxarısında açılır
    // Aşağıda yer yoxdursa yuxarıya, varsa aşağıya expand olur
    let top;
    const spaceAbove = wrapRect.top;
    const spaceBelow = window.innerHeight - wrapRect.bottom;

    if (!reactionExpanded) {
      // Quick mode — həmişə yuxarıda açılır
      top = wrapRect.top - elHeight;
      // Yuxarıda yer yoxdursa aşağıya flip et
      if (top < 0) top = wrapRect.bottom;
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
        if (top < 0) top = 4; // ekranın yuxarı kənarından 4px
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
    if (left + elWidth > window.innerWidth - 4) left = window.innerWidth - elWidth - 4;

    el.style.top = `${top}px`;
    el.style.left = `${left}px`;
  }, [reactionOpen, reactionExpanded, isOwn]);

  // --- JSX RENDER ---
  return (
    // message-row — mesajın tam sırası (checkbox + avatar + bubble)
    // data-bubble-id={msg.id} — handleScrollToMessage-də querySelector üçün
    // data-unread="true" — IntersectionObserver-ın mark-as-read üçün izlədiyi element
    <div
      className={`message-row ${isOwn ? "own" : ""} ${showAvatar ? "has-avatar" : ""} ${isSelected ? "selected" : ""}`}
      data-bubble-id={msg.id}
      // selectMode aktiv + mesaj silinməyibsə klik → toggle select
      onClick={selectMode && !msg.isDeleted ? () => onToggleSelect(msg.id) : undefined}
      // Spread operator ilə şərti data-* atributları əlavə et
      // !isOwn + !msg.isRead → IntersectionObserver üçün lazımdır
      {...(!isOwn &&
        !msg.isRead && {
          "data-unread": "true",
          "data-msg-id": msg.id,
          "data-conv-id":
            chatType === 0 ? msg.conversationId : msg.channelId,
          "data-conv-type": String(chatType), // "0" (string) — dataset always string
        })}
    >
      {/* Seçmə checkbox — selectMode aktiv + silinməmiş mesaj üçün */}
      {selectMode && !msg.isDeleted && (
        <div className={`select-checkbox ${isSelected ? "checked" : ""}`}>
          {isSelected && (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </div>
      )}

      {/* Avatar slot — yalnız başqasının mesajında (isOwn=false) */}
      {!isOwn && (
        <div className="message-avatar-slot">
          {/* showAvatar — bu sətir qrupun son mesajıdırsa true */}
          {showAvatar && (
            <div
              className="message-avatar"
              style={{
                background: getAvatarColor(msg.senderFullName),
              }}
            >
              {getInitials(msg.senderFullName)}
            </div>
          )}
        </div>
      )}

      {/* message-bubble — mesajın vizual balonu */}
      {/* CSS :hover ilə butonlar göstərilir — JS hover state lazım deyil */}
      {/* actions-locked class: menyu/reaction açıq olduqda butonlar görünməyə davam etsin */}
      <div
        className={`message-bubble ${isOwn ? "own" : ""}${menuOpen ? " menu-open" : ""}${reactionOpen ? " reaction-open" : ""}${pickerHovered ? " picker-hovered" : ""}${selectMode ? " select-mode" : ""}`}
        onContextMenu={selectMode ? undefined : (e) => {
          e.preventDefault();
          // Sağ klik pozisyasını saxla — menu orada açılacaq
          menuBtnRectRef.current = { top: e.clientY, bottom: e.clientY, left: e.clientX, right: e.clientX };
          setMenuOpen(true);
          setReactionOpen(false);
        }}
      >
        {/* Forwarded label — yönləndirilmiş mesaj */}
        {msg.isForwarded && !msg.isDeleted && (
          <div className="forwarded-label">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
            onClick={() => onScrollToMessage && onScrollToMessage(msg.replyToMessageId)}
          >
            <div className="reply-reference-bar" />
            <div className="reply-reference-body">
              <span className="reply-reference-name">
                {msg.replyToSenderName}
              </span>
              <span className="reply-reference-text">
                {msg.replyToContent}
              </span>
            </div>
          </div>
        )}

        {/* Mesaj məzmunu */}
        <div className="message-content">
          {msg.isDeleted ? (
            // Silinmiş mesaj — məzmun yerinə standart mesaj
            <span className="deleted-message-text">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
              This message was deleted.
            </span>
          ) : (
            msg.content // Normal mesaj məzmunu
          )}
        </div>

        {/* Meta sıra: reactions + "modified" + vaxt + read ticks */}
        <div className="message-meta">
          {/* Reaction badges — bu mesaja olan reaksiyalar */}
          {msg.reactions && msg.reactions.length > 0 && (
            <div className="reaction-badges">
              {/* Hər emoji üçün badge düyməsi */}
              {msg.reactions.map((r) => (
                <div key={r.emoji} className="reaction-badge-wrapper">
                  <button
                    className="reaction-badge"
                    onClick={(e) => {
                      e.stopPropagation();
                      // Tooltip açıqdırsa bağla
                      if (reactionTooltipOpen === r.emoji) {
                        setReactionTooltipOpen(null);
                        return;
                      }
                      // Klik → reaksiyanı toggle et (əlavə et / sil)
                      onReaction && onReaction(msg, r.emoji);
                    }}
                    onMouseEnter={() => {
                      // 500ms üzərində dayanarsa → tooltip aç
                      badgePressRef.current = setTimeout(async () => {
                        if (reactionTooltipOpen === r.emoji) return;
                        setReactionTooltipOpen(r.emoji);
                        if (!r.userFullNames || r.userFullNames.length === 0) {
                          setReactionDetailsLoading(true);
                          await onLoadReactionDetails(msg.id);
                          setReactionDetailsLoading(false);
                        }
                      }, 500);
                    }}
                    onMouseLeave={() => {
                      clearTimeout(badgePressRef.current);
                    }}
                  >
                    <span className="reaction-badge-emoji">
                      <img src={emojiToUrl(r.emoji)} alt={r.emoji} className="twemoji" draggable="false" />
                    </span>
                    {/* count > 1 olduqda sayı göstər */}
                    {r.count > 1 && <span className="reaction-badge-count">{r.count}</span>}
                  </button>

                  {/* Reaction tooltip — kim react etdi? */}
                  {reactionTooltipOpen === r.emoji && (
                    <div className="reaction-tooltip visible" ref={tooltipRef}>
                      {reactionDetailsLoading ? (
                        <div className="reaction-tooltip-item">
                          <span className="reaction-tooltip-name reaction-tooltip-loading">Loading...</span>
                        </div>
                      ) : r.userFullNames && r.userFullNames.length > 0 ? (
                        // Hər react edən istifadəçi üçün avatar + ad
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
                        // Fallback — ad yoxdursa say göstər
                        <div className="reaction-tooltip-item">
                          <span className="reaction-tooltip-name">
                            {r.count} {r.count === 1 ? "person" : "people"} reacted
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* "modified" — mesaj redaktə edilmişsə */}
          {msg.isEdited && <span className="message-modified">modified</span>}

          {/* Vaxt — "HH:mm" */}
          <span className="message-time">
            {formatMessageTime(msg.createdAtUtc)}
          </span>

          {/* Read ticks — yalnız öz mesajları üçün, status >= 1 */}
          {/* status: 1=Sent(tək tik), 2=Delivered(ikiqat tik), 3=Read(mavi tik) */}
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

        {/* More butonu — həmişə DOM-da, CSS :hover ilə görünür */}
        {!selectMode && (
          <div className={`bubble-more-wrap ${isOwn ? "own" : ""}`}>
            <button
              className="bubble-action-btn"
              title="More"
              onClick={(e) => {
                menuBtnRectRef.current = e.currentTarget.getBoundingClientRect();
                setMenuOpen(!menuOpen);
                setReactionOpen(false);
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
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

        {/* React butonu + picker — hover ilə açılır, CSS ilə göstərilir */}
        {!selectMode && !msg.isDeleted && (
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
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
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
              {/* Quick sıra — həmişə görünür + expand/collapse butonu */}
              <div className="reaction-quick-row">
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
                    <img src={emojiToUrl(emoji)} alt={emoji} className="twemoji" draggable="false" />
                  </button>
                ))}
                {!reactionExpanded && (
                  <button
                    className="reaction-expand-btn"
                    onClick={() => setReactionExpanded(true)}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Expanded grid — quick sıranın altında, aşağıya doğru böyüyür */}
              {reactionExpanded && (
                <div className="reaction-expanded-grid">
                  {EXPANDED_EXTRA_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      className="reaction-emoji-btn"
                      onClick={() => {
                        onReaction && onReaction(msg, emoji);
                        setReactionOpen(false);
                        setReactionExpanded(false);
                      }}
                    >
                      <img src={emojiToUrl(emoji)} alt={emoji} className="twemoji" draggable="false" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

export default MessageBubble;
