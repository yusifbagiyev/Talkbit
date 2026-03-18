import { useMemo, memo } from "react";

// ChatStatusBar — mesaj input sahəsinin üstündə sabit yer tutan status bar
// İki hissəsi var:
//   1. Typing (sol) — qarşı tərəf yazarkən "is typing" göstərir
//   2. Viewed (sağ) — öz mesajımızın oxunma statusunu göstərir
function ChatStatusBar({
  selectedChat,
  messages,
  userId,
  typingUsers,
  lastReadTimestamp,
  channelMembers,
  onOpenReadersPanel,
}) {
  const lastOwnMessage = useMemo(() => {
    return messages.find((m) => m.senderId === userId && !m.isDeleted);
  }, [messages, userId]);

  const lastMessage = messages.length > 0 ? messages[0] : null;
  const isLastMessageOwn = lastMessage && lastMessage.senderId === userId;

  // ── Typing content (sol tərəf) ──
  const typingContent = useMemo(() => {
    if (!selectedChat || selectedChat.isNotes || selectedChat.type === 2) return null;

    const typingValue = typingUsers[selectedChat.id];
    if (!typingValue) return null;

    const typingText =
      selectedChat.type === 0
        ? "is typing"
        : `${typingValue} is typing`;

    return (
      <>
        <span className="status-bar-typing-dots">
          <span className="typing-dot" />
          <span className="typing-dot" />
          <span className="typing-dot" />
        </span>
        <span className="status-bar-typing">{typingText}</span>
      </>
    );
  }, [selectedChat, typingUsers]);

  // ── Viewed content (sağ tərəf) ──
  const viewedContent = useMemo(() => {
    if (!selectedChat || selectedChat.isNotes || selectedChat.type === 2) return null;
    if (!lastOwnMessage || !isLastMessageOwn) return null;

    // DM — "Viewed: bugün, 15:29"
    if (selectedChat.type === 0) {
      if (lastOwnMessage.status !== 3) return null;

      // SignalR event-dən gələn readTime əsasdır.
      // Yoxdursa (conversation ilk açıldıqda), mesajın readAtUtc (server oxunma vaxtı) fallback olur.
      // createdAtUtc əvəzinə readAtUtc istifadə edirik — dəqiq oxunma vaxtı.
      const readTime = lastReadTimestamp[selectedChat.id]
        || (lastOwnMessage.readAtUtc ? new Date(lastOwnMessage.readAtUtc) : null);
      if (!readTime) return null;

      const now = new Date();
      const isToday = readTime.toDateString() === now.toDateString();
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const isYesterday = readTime.toDateString() === yesterday.toDateString();

      let dateLabel;
      if (isToday) {
        dateLabel = "today";
      } else if (isYesterday) {
        dateLabel = "yesterday";
      } else {
        dateLabel = readTime.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        });
      }

      const timeStr = readTime.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });

      return (
        <>
          <svg className="status-bar-tick" viewBox="0 0 16 11">
            <polyline points="1 5.5 5 9.5 11 1" />
            <polyline points="5.5 5.5 9.5 9.5 15 1" />
          </svg>
          <span className="status-bar-viewed">
            Viewed: {dateLabel}, {timeStr}
          </span>
        </>
      );
    }

    // Channel — "Viewed by X and Y more"
    if (selectedChat.type === 1) {
      const readByIds = lastOwnMessage.readBy || [];
      if (readByIds.length === 0) return null;

      const membersMap = channelMembers[selectedChat.id] || {};
      const readerNames = readByIds
        .map((id) => membersMap[id]?.fullName)
        .filter(Boolean);

      if (readerNames.length === 0) return null;

      const firstName = readerNames[0];
      const moreCount = readerNames.length - 1;

      return (
        <>
          <svg className="status-bar-tick" viewBox="0 0 16 11">
            <polyline points="1 5.5 5 9.5 11 1" />
            <polyline points="5.5 5.5 9.5 9.5 15 1" />
          </svg>
          <span className="status-bar-viewed">
            Viewed by {firstName}
            {moreCount > 0 && (
              <>
                {" and "}
                <button
                  className="status-bar-more-btn"
                  onClick={() =>
                    onOpenReadersPanel({
                      messageId: lastOwnMessage.id,
                      readByIds,
                    })
                  }
                >
                  {moreCount} more
                </button>
              </>
            )}
          </span>
        </>
      );
    }

    return null;
  }, [selectedChat, lastOwnMessage, isLastMessageOwn, lastReadTimestamp, channelMembers, onOpenReadersPanel]);

  // Heç bir content yoxdursa heç nə render etmə (yer tutmasın)
  if (!typingContent && !viewedContent) return null;

  return (
    <div className="chat-status-bar-container">
      {/* Typing — sol tərəf */}
      <div className={`chat-status-bar typing${typingContent ? " has-content" : ""}`}>
        {typingContent}
      </div>
      {/* Viewed — sağ tərəf */}
      <div className={`chat-status-bar viewed${viewedContent ? " has-content" : ""}`}>
        {viewedContent}
      </div>
    </div>
  );
}

export default memo(ChatStatusBar);
