// Sabitlər import et
import { TEXT_INPUT_EMOJIS } from "../utils/emojiConstants";    // Emoji panel üçün emojilər
import { MESSAGE_MAX_LENGTH } from "../utils/chatUtils";         // Maksimum mesaj uzunluğu
import MentionPanel from "./MentionPanel";                       // @ mention dropdown paneli

// ChatInputArea komponenti — mesaj yazma sahəsi + emoji panel
// Bu komponent "pure UI" — bütün state Chat.jsx-dədir, buraya prop olaraq gəlir
// .NET ekvivalenti: MessageInputPartial.razor (state yuxarı komponentdədir)
//
// Props:
//   messageText    — textarea-nın dəyəri
//   setMessageText — textarea dəyərini dəyiş
//   replyTo        — reply ediləcək mesaj (null = reply yox)
//   setReplyTo     — reply-ı sıfırla
//   editMessage    — redaktə edilən mesaj (null = edit yox)
//   setEditMessage — edit mode-dan çıx
//   emojiOpen      — emoji panel açıq/bağlı
//   setEmojiOpen   — emoji paneli aç/bağla
//   emojiPanelRef  — emoji panel DOM referansı (kənar klik bağlama üçün)
//   inputRef       — textarea DOM referansı (focus vermək üçün)
//   onSend         — Send button / Enter basıldıqda
//   onKeyDown      — klaviatura hadisəsi (typing siqnalı + Enter)
//   onTyping       — yazarkən typing siqnalı göndər
function ChatInputArea({
  messageText, setMessageText,
  replyTo, setReplyTo,
  editMessage, setEditMessage,
  emojiOpen, setEmojiOpen,
  emojiPanelRef, inputRef,
  onSend, onKeyDown, onTyping,
  // Mention props
  onTextChange, mentionOpen, mentionItems,
  mentionSelectedIndex, mentionLoading, mentionPanelRef, onMentionSelect,
}) {
  return (
    // Fragment <> </> — birden çox root element qaytarmaq üçün
    // .NET: RenderFragment ilə oxşardır
    <>
      <div className="message-input-area">

        {/* Reply Preview — replyTo varsa göstər */}
        {/* {replyTo && (...)} — şərti render */}
        {replyTo && (
          <div className="reply-preview">
            {/* Reply ikonu */}
            <svg
              className="reply-preview-icon"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#00ace3"
              strokeWidth="2"
            >
              <path d="M3 21c0 0 1-6 6-10h4V6l8 8-8 8v-5H9c-3 0-6 4-6 4z" />
            </svg>
            <div className="reply-preview-body">
              {/* Kim yazdı + mesajın qısa məzmunu */}
              <span className="reply-preview-name">
                {replyTo.senderFullName}
              </span>
              <span className="reply-preview-text">
                {replyTo.content}
              </span>
            </div>
            {/* Bağla düyməsi — setReplyTo(null) → reply paneli gizlən */}
            <button
              className="reply-preview-close"
              onClick={() => setReplyTo(null)}
            >
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
        )}

        {/* Edit Preview — editMessage varsa göstər */}
        {editMessage && (
          <div className="edit-preview">
            {/* Edit ikonu */}
            <svg
              className="edit-preview-icon"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#00ace3"
              strokeWidth="2"
            >
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            <div className="edit-preview-body">
              <span className="edit-preview-name">Edit message</span>
              <span className="edit-preview-text">{editMessage.content}</span>
            </div>
            {/* Bağla → edit mode-dan çıx, textarea-nı sıfırla */}
            <button
              className="edit-preview-close"
              onClick={() => {
                setEditMessage(null);   // edit mode-dan çıx
                setMessageText("");     // textarea-nı boşalt
              }}
            >
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
        )}

        {/* Input sahəsi: clip + textarea + emoji + send */}
        <div className="message-input-wrapper">
          {/* Fayl əlavə et düyməsi — TODO: file upload */}
          <button className="input-icon-btn" title="Attach">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
          </button>

          {/* textarea — çox sətirli mesaj yazma sahəsi */}
          {/* ref={inputRef} — Chat.jsx-dən focus vermək üçün */}
          {/* maxLength — backend ilə uyğun limit */}
          {/* rows={1} + auto-height — yazan kimi böyüyür (max 120px) */}
          <textarea
            ref={inputRef}
            className="message-input"
            placeholder="Enter @ to mention a person or chat"
            value={messageText}
            maxLength={MESSAGE_MAX_LENGTH}
            rows={1}
            onChange={(e) => {
              const val = e.target.value;
              const caret = e.target.selectionStart;
              // onTextChange varsa mention detection ilə birlikdə dəyişdir
              if (onTextChange) onTextChange(val, caret);
              else setMessageText(val);
              // Auto-resize: height-i sıfırla, sonra scrollHeight qədər artır (max 120px)
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
            }}
            onKeyDown={onKeyDown} // Enter → send, Shift+Enter → yeni sətir, typing siqnalı
          />

          {/* Emoji düyməsi — paneli aç/bağla */}
          {/* active class — açıq olduqda vurğulanır */}
          <button
            className={`input-icon-btn emoji-btn ${emojiOpen ? "active" : ""}`}
            title="Emoji"
            onClick={() => setEmojiOpen(!emojiOpen)} // Toggle: true↔false
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M8 14s1.5 2 4 2 4-2 4-2" />
              <line x1="9" y1="9" x2="9.01" y2="9" />
              <line x1="15" y1="9" x2="15.01" y2="9" />
            </svg>
          </button>

          {/* Göndər düyməsi — messageText boşdursa deaktiv */}
          {/* disabled={!messageText.trim()} — boş string falsy-dir */}
          <button
            className={`send-btn ${messageText.trim() ? "" : "disabled"}`}
            title="Send"
            onClick={onSend}
            disabled={!messageText.trim()}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Mention dropdown panel — @ yazıldıqda göstər */}
      {mentionOpen && (
        <MentionPanel
          items={mentionItems}
          selectedIndex={mentionSelectedIndex}
          onSelect={onMentionSelect}
          isLoading={mentionLoading}
          panelRef={mentionPanelRef}
        />
      )}

      {/* Emoji picker panel — emojiOpen true olduqda göstər */}
      {emojiOpen && (
        // ref={emojiPanelRef} — Chat.jsx-dəki kənar klik handler-i üçün
        <div className="emoji-panel" ref={emojiPanelRef}>
          <div className="emoji-panel-header">Smileys and people</div>
          <div className="emoji-panel-grid">
            {/* TEXT_INPUT_EMOJIS array-ini map et → hər emoji üçün button */}
            {TEXT_INPUT_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                className="emoji-panel-btn"
                onClick={() => {
                  // Functional update — əvvəlki dəyərə emoji əlavə et
                  // prev + emoji → "Hello" + "😊" = "Hello😊"
                  setMessageText((prev) => prev + emoji);
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

export default ChatInputArea;
