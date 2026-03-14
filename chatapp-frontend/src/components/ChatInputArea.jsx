// Sabitlər import et
import { useRef, useState, useEffect, useCallback, memo } from "react";
import { MESSAGE_MAX_LENGTH, MAX_FILE_SIZE, formatFileSize, isAllowedFileExtension } from "../utils/chatUtils";
import { useToast } from "../context/ToastContext";               // Toast notification sistemi
import { renderTextWithEmojis } from "../utils/emojiConstants";  // Emoji → Apple img çevirici
import MentionPanel from "./MentionPanel";                       // @ mention dropdown paneli
import FilePreviewPanel from "./FilePreviewPanel";               // Fayl preview modal
import EmojiPicker, { EmojiStyle, Theme } from "emoji-picker-react"; // Modern emoji picker

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
  onSend, onKeyDown,
  // Mention props
  onTextChange, mentionOpen, mentionItems,
  mentionSelectedIndex, mentionLoading, mentionPanelRef, onMentionSelect,
  // Resize callback — textarea böyüdükdə mesajları aşağı scroll etmək üçün
  onInputResize,
  // File upload props
  selectedFiles, onFilesSelected, onRemoveFile, onReorderFiles, onClearFiles, onSendFiles,
  uploadProgress, isUploading,
}) {
  const { showToast } = useToast();
  const mirrorRef = useRef(null);
  const fileInputRef = useRef(null);       // Gizli <input type="file"> referansı
  const attachMenuRef = useRef(null);      // Attach dropdown menu referansı (click-outside üçün)
  const attachBtnRef = useRef(null);       // Attach button referansı (click-outside ignore üçün)
  const [dragging, setDragging] = useState(false);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);

  // handleResizeDrag — Bitrix-style drag handle: textarea hündürlüyünü manual dəyişmək
  // mousedown → mousemove ilə hündürlük artır/azalır → mouseup ilə bitir
  const handleResizeDrag = useCallback((e) => {
    e.preventDefault();
    const textarea = inputRef.current;
    if (!textarea) return;
    const startY = e.clientY;
    const startH = textarea.offsetHeight;
    setDragging(true);

    const onMove = (ev) => {
      // Yuxarı dartma = hündürlük artır (startY - ev.clientY > 0)
      const newH = Math.max(34, Math.min(300, startH + (startY - ev.clientY)));
      textarea.style.height = newH + "px";
      if (mirrorRef.current) mirrorRef.current.style.height = newH + "px";
      onInputResize?.();
    };

    const onUp = () => {
      setDragging(false);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [inputRef, onInputResize]);

  // renderMirrorContent — text hissəsini normal göstərir, emoji hissəsini isə:
  // 1. Orijinal emoji simvolunu gizli saxlayır (visibility:hidden) — textarea ilə eyni eni tutur
  // 2. Üzərinə Apple CDN şəklini overlay edir — gözəl emoji görünür
  // Nəticə: text axını textarea ilə 100% eyni → caret pozisiyası düzgündür
  const renderMirrorContent = useCallback((text) => {
    if (!text) return null;
    const parts = renderTextWithEmojis(text);
    if (typeof parts === "string") return parts;
    return parts.map((part, i) =>
      typeof part === "string" ? (
        <span key={i}>{part}</span>
      ) : (
        <span key={i} className="mirror-emoji-wrap">
          <span className="mirror-emoji-char">{part.emoji}</span>
          <img
            src={part.url}
            alt=""
            className="mirror-emoji-img"
            onError={(e) => { e.target.style.display = "none"; }}
          />
        </span>
      )
    );
  }, []);

  // Click-outside — attach menu bağlama
  useEffect(() => {
    if (!attachMenuOpen) return;
    function handleClickOutside(e) {
      if (
        attachMenuRef.current && !attachMenuRef.current.contains(e.target) &&
        attachBtnRef.current && !attachBtnRef.current.contains(e.target)
      ) {
        setAttachMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [attachMenuOpen]);

  // Fayl seçmə handler — gizli input-un onChange-i
  const handleFileChange = useCallback((e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    // Extension + ölçü yoxlaması — icazə verilməyən/böyük faylları filtrələ
    const valid = files.filter((f) => {
      if (!isAllowedFileExtension(f.name)) {
        showToast(`"${f.name}" — bu fayl tipi dəstəklənmir`, "error");
        return false;
      }
      if (f.size > MAX_FILE_SIZE) {
        showToast(`"${f.name}" çox böyükdür (${formatFileSize(f.size)}). Maks: ${formatFileSize(MAX_FILE_SIZE)}`, "warning");
        return false;
      }
      return true;
    });
    if (valid.length > 0) onFilesSelected(valid);

    // Input-u sıfırla — eyni faylı yenidən seçə bilsin
    e.target.value = "";
  }, [onFilesSelected, showToast]);

  return (
    // Fragment <> </> — birden çox root element qaytarmaq üçün
    // .NET: RenderFragment ilə oxşardır
    <>
      <div className="message-input-area">
        {/* Bitrix-style resize handle — hover-da görünür, drag ilə textarea böyüdülür */}
        <div
          className={`input-resize-handle${dragging ? " dragging" : ""}`}
          onMouseDown={handleResizeDrag}
        >
          <span />
        </div>

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
                {replyTo.fileId
                  ? replyTo.fileContentType?.startsWith("image/")
                    ? replyTo.content ? `[Image] ${replyTo.content}` : "[Image]"
                    : replyTo.content ? `File: ${replyTo.fileName || "File"} — ${replyTo.content}` : `File: ${replyTo.fileName || "File"}`
                  : replyTo.content}
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

        {/* Input sahəsi — Bitrix layout: attach sol yuxarı, butonlar sağ aşağı */}
        <div className="message-input-wrapper">
          {/* Attach butonu — sol yuxarı (absolute) */}
          <button
            ref={attachBtnRef}
            className={`input-icon-btn attach-btn${attachMenuOpen ? " active" : ""}`}
            title="Attach"
            onClick={() => setAttachMenuOpen((v) => !v)}
          >
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

          {/* Attach dropdown menu — ds-dropdown pattern */}
          {attachMenuOpen && (
            <div className="ds-dropdown attach-menu" ref={attachMenuRef}>
              <button
                className="ds-dropdown-item"
                onClick={() => {
                  fileInputRef.current?.click();
                  setAttachMenuOpen(false);
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ marginRight: 8, flexShrink: 0 }}>
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
                File on this computer
              </button>
              <button className="ds-dropdown-item" disabled style={{ opacity: 0.4, cursor: "default" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ marginRight: 8, flexShrink: 0 }}>
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                </svg>
                File on Bitrix24
              </button>
            </div>
          )}

          {/* Gizli file input — attach menu-dan trigger olunur */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            style={{ display: "none" }}
            onChange={handleFileChange}
          />

          {/* textarea + mirror konteyner — tam eni tutur */}
          <div className="message-input-container">
            {/* Mirror — textarea ilə eyni text axını, lakin Apple emoji overlay */}
            <div className="message-input-mirror" ref={mirrorRef}>
              {renderMirrorContent(messageText)}
            </div>

            {/* textarea — transparent text + visible caret */}
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
                if (onTextChange) onTextChange(val, caret);
                else setMessageText(val);
                // Auto-resize — yalnız hündürlük dəyişdikdə scroll et
                const prevH = e.target.offsetHeight;
                e.target.style.height = "auto";
                const h = Math.min(e.target.scrollHeight, 300);
                e.target.style.height = h + "px";
                if (mirrorRef.current) mirrorRef.current.style.height = h + "px";
                // Yalnız textarea hündürlüyü dəyişdikdə mesajları aşağı scroll et
                if (h !== prevH) onInputResize?.();
              }}
              onScroll={(e) => {
                if (mirrorRef.current) mirrorRef.current.scrollTop = e.target.scrollTop;
              }}
              onKeyDown={onKeyDown}
            />
          </div>

          {/* Sağ aşağı butonlar qrupu (absolute) */}
          <div className="input-actions-group">
            {/* Emoji düyməsi */}
            <button
              className={`input-icon-btn emoji-btn ${emojiOpen ? "active" : ""}`}
              title="Emoji"
              onClick={() => setEmojiOpen(!emojiOpen)}
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M8 14c.5 1.5 2 3 4 3s3.5-1.5 4-3" />
                <circle cx="9" cy="9.5" r="1.2" fill="currentColor" stroke="none" />
                <circle cx="15" cy="9.5" r="1.2" fill="currentColor" stroke="none" />
              </svg>
            </button>

            {/* Göndər düyməsi */}
            <button
              className={`send-btn ${messageText.trim() || (selectedFiles && selectedFiles.length > 0) || editMessage ? "" : "disabled"}`}
              title="Send"
              onClick={onSend}
              disabled={!messageText.trim() && !(selectedFiles && selectedFiles.length > 0) && !editMessage}
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
      </div>

      {/* Emoji picker panel — Apple stilində modern emojilər */}
      {emojiOpen && (
        <div className="emoji-panel" ref={emojiPanelRef}>
          <EmojiPicker
            emojiStyle={EmojiStyle.APPLE}
            theme={Theme.LIGHT}
            width="100%"
            height="100%"
            searchPlaceHolder="Search emoji..."
            skinTonesDisabled
            previewConfig={{ showPreview: false }}
            lazyLoadEmojis
            onEmojiClick={(emojiData) => {
              setMessageText((prev) => prev + emojiData.emoji);
              inputRef.current?.focus();
            }}
          />
        </div>
      )}

      {/* Fayl preview panel — fayllar seçildikdə modal overlay */}
      {selectedFiles && selectedFiles.length > 0 && (
        <FilePreviewPanel
          selectedFiles={selectedFiles}
          onRemoveFile={onRemoveFile}
          onReorderFiles={onReorderFiles}
          onClearFiles={onClearFiles}
          onSendFiles={onSendFiles}
          uploadProgress={uploadProgress}
          isUploading={isUploading}
        />
      )}
    </>
  );
}

export default memo(ChatInputArea);
