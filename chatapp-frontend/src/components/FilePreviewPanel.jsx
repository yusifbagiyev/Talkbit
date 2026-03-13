// ─── FilePreviewPanel — Fayl seçildikdən sonra göstərilən preview modal ──────
// Bitrix24-dəki "Selected: N" paneli — chat sahəsinin ortasında overlay olaraq açılır.
// Tək şəkil: böyük preview, çoxlu fayl: kiçik siyahı.
// Drag-and-drop ilə faylların sırasını dəyişmək mümkündür.

import { useState, useEffect, useRef, useCallback } from "react";
import { formatFileSize } from "../utils/chatUtils";
import FileTypeIcon from "./FileTypeIcon";

function FilePreviewPanel({
  selectedFiles,
  onRemoveFile,
  onReorderFiles,
  onClearFiles,
  onSendFiles,
  uploadProgress,
  isUploading,
}) {
  const [textValue, setTextValue] = useState("");
  const textRef = useRef(null);

  // Drag reorder state
  const [dragIndex, setDragIndex] = useState(null);
  const [overIndex, setOverIndex] = useState(null);
  const listRef = useRef(null);

  // ─── Object URL-lər — useEffect daxilində yaradılır + cleanup olunur ───
  // URL.createObjectURL side-effect-dir, Strict Mode-da useMemo 2 dəfə run olur
  // amma cleanup olmur → URL-lər revoke olunub qırılır. Ona görə useEffect istifadə edilir.
  const [previews, setPreviews] = useState([]);

  useEffect(() => {
    const newPreviews = selectedFiles.map((file) => ({
      type: file.type.startsWith("image/") ? "image" : "file",
      url: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
    }));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Object URL lifecycle: yaratma + cleanup eyni effect-də olmalıdır
    setPreviews(newPreviews);

    return () => {
      for (const p of newPreviews) {
        if (p.url) URL.revokeObjectURL(p.url);
      }
    };
  }, [selectedFiles]);

  // Tək şəkil olub-olmadığını yoxla
  const isSingleImage =
    selectedFiles.length === 1 && selectedFiles[0].type.startsWith("image/");

  // Göndər
  function handleSend() {
    if (isUploading) return;
    onSendFiles(textValue.trim());
  }

  // Enter ilə göndərmə (Shift+Enter — yeni sətir)
  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // ─── Drag reorder ───
  const handleDragStart = useCallback((e, idx) => {
    e.preventDefault();
    setDragIndex(idx);
    setOverIndex(idx);

    const onMove = (ev) => {
      if (!listRef.current) return;
      const items = listRef.current.querySelectorAll(".file-preview-item");
      for (let i = 0; i < items.length; i++) {
        const rect = items[i].getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        if (ev.clientY < midY) {
          setOverIndex(i);
          return;
        }
      }
      setOverIndex(items.length - 1);
    };

    const onUp = () => {
      setDragIndex((prevDrag) => {
        setOverIndex((prevOver) => {
          if (prevDrag !== null && prevOver !== null && prevDrag !== prevOver && onReorderFiles) {
            onReorderFiles(prevDrag, prevOver);
          }
          return null;
        });
        return null;
      });
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [onReorderFiles]);

  // ─── Textarea resize (Bitrix-style drag handle) ───
  const [textDragging, setTextDragging] = useState(false);

  const handleTextResize = useCallback((e) => {
    e.preventDefault();
    const textarea = textRef.current;
    if (!textarea) return;
    const startY = e.clientY;
    const startH = textarea.offsetHeight;
    setTextDragging(true);

    const onMove = (ev) => {
      const newH = Math.max(36, Math.min(200, startH + (ev.clientY - startY)));
      textarea.style.height = newH + "px";
    };

    const onUp = () => {
      setTextDragging(false);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, []);

  return (
    <div className="file-preview-overlay">
      <div className="file-preview-panel">
        {/* Header: "Selected: N" + bağla butonu */}
        <div className="file-preview-header">
          <span className="file-preview-title">
            Selected: {selectedFiles.length}
          </span>
          <button
            className="file-preview-close"
            onClick={onClearFiles}
            title="Close"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Fayl siyahısı / şəkil preview */}
        <div className="file-preview-body">
          {isSingleImage ? (
            <div className="file-preview-single-image">
              {previews[0]?.url && (
                <img
                  src={previews[0].url}
                  alt={selectedFiles[0].name}
                  className="file-preview-single-img"
                />
              )}
            </div>
          ) : (
            <div className="file-preview-list" ref={listRef}>
              {selectedFiles.map((file, idx) => (
                <div
                  key={`${file.name}-${idx}`}
                  className={
                    "file-preview-item" +
                    (dragIndex === idx ? " dragging" : "") +
                    (overIndex === idx && dragIndex !== null && dragIndex !== idx ? " drag-over" : "")
                  }
                >
                  {/* Drag handle — 6 nöqtə (2x3 grid) */}
                  {!isUploading && (
                    <div
                      className="file-preview-drag-handle"
                      onMouseDown={(e) => handleDragStart(e, idx)}
                      title="Drag to reorder"
                    >
                      <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor">
                        <circle cx="2.5" cy="2" r="1.5" />
                        <circle cx="7.5" cy="2" r="1.5" />
                        <circle cx="2.5" cy="8" r="1.5" />
                        <circle cx="7.5" cy="8" r="1.5" />
                        <circle cx="2.5" cy="14" r="1.5" />
                        <circle cx="7.5" cy="14" r="1.5" />
                      </svg>
                    </div>
                  )}

                  {/* Thumbnail və ya icon */}
                  {previews[idx]?.type === "image" && previews[idx].url ? (
                    <img
                      src={previews[idx].url}
                      alt={file.name}
                      className="file-preview-item-thumb"
                    />
                  ) : (
                    <div className="file-preview-item-icon">
                      <FileTypeIcon fileName={file.name} size={28} />
                    </div>
                  )}

                  {/* Fayl adı + ölçüsü */}
                  <div className="file-preview-item-info">
                    <span className="file-preview-item-name">{file.name}</span>
                    <span className="file-preview-item-size">
                      {formatFileSize(file.size)}
                    </span>
                  </div>

                  {/* Silmə butonu — yalnız hover-da görünür */}
                  {!isUploading && (
                    <button
                      className="file-preview-item-remove"
                      onClick={() => onRemoveFile(idx)}
                      title="Remove"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* "Add text" textarea + send button — message input pattern */}
        <div className="file-preview-input-area">
          <div className="file-preview-input-wrap">
            <textarea
              ref={textRef}
              className="file-preview-text"
              placeholder="Add text"
              value={textValue}
              onChange={(e) => setTextValue(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isUploading}
              rows={1}
            />
            {/* Göndər butonu — textarea-nın sağ alt küncündə (absolute) */}
            <button
              className="file-preview-send"
              onClick={handleSend}
              disabled={isUploading}
              title="Send"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          </div>
          {/* Resize handle — aşağı dartıb uzatma */}
          <div
            className={`file-preview-resize-handle${textDragging ? " dragging" : ""}`}
            onMouseDown={handleTextResize}
          >
            <span />
          </div>
        </div>

        {/* Upload progress bar */}
        {isUploading && (
          <div className="file-upload-progress">
            <div
              className="file-upload-progress-bar"
              style={{ width: `${uploadProgress || 0}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default FilePreviewPanel;
