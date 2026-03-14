import { memo, useState, useEffect, useRef, useCallback } from "react";
import { getFileUrl, downloadFile } from "../services/api";

const ImageViewer = memo(function ImageViewer({ images, currentIndex, onClose, onNavigate }) {
  const [zoom, setZoom] = useState(1);
  const thumbStripRef = useRef(null);
  const currentImage = images[currentIndex];

  // Şəkil dəyişdikdə zoom sıfırla — render zamanı (useState ilə, React 19 safe)
  const [prevIndex, setPrevIndex] = useState(currentIndex);
  if (prevIndex !== currentIndex) {
    setPrevIndex(currentIndex);
    setZoom(1);
  }

  // Keyboard: Escape=bağla, ←/→=naviqasiya
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && currentIndex > 0) onNavigate(currentIndex - 1);
      if (e.key === "ArrowRight" && currentIndex < images.length - 1) onNavigate(currentIndex + 1);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [currentIndex, images.length, onClose, onNavigate]);

  // Aktiv thumbnail-ı görünən sahəyə scroll et
  useEffect(() => {
    if (!thumbStripRef.current) return;
    const activeThumb = thumbStripRef.current.querySelector(".iv-thumb.active");
    if (activeThumb) {
      activeThumb.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  }, [currentIndex]);

  // Mouse wheel zoom
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(z => Math.max(0.25, Math.min(z * delta, 5)));
  }, []);

  // Double-click: 1x ↔ 2x toggle
  const handleDoubleClick = useCallback(() => {
    setZoom(z => z === 1 ? 2 : 1);
  }, []);

  // Download
  const handleDownload = useCallback(() => {
    if (!currentImage?.fileId) return;
    downloadFile(currentImage.fileId, currentImage.fileName || "image", currentImage.fileUrl);
  }, [currentImage]);

  if (!currentImage) return null;

  return (
    <div className="image-viewer-overlay" onClick={onClose}>
      {/* ─── Top bar ─── */}
      <div className="iv-topbar" onClick={e => e.stopPropagation()}>
        <div className="iv-topbar-left">
          <span className="iv-filename">{currentImage.fileName}</span>
        </div>
        <div className="iv-topbar-right">
          <button className="iv-btn" title="Zoom out" onClick={() => setZoom(z => Math.max(z / 1.25, 0.25))}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              <line x1="8" y1="11" x2="14" y2="11"/>
            </svg>
          </button>
          <span className="iv-zoom-label">{Math.round(zoom * 100)}%</span>
          <button className="iv-btn" title="Zoom in" onClick={() => setZoom(z => Math.min(z * 1.25, 5))}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              <line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
            </svg>
          </button>
          <button className="iv-btn" title="Download" onClick={handleDownload}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
          </button>
          <button className="iv-btn iv-close-btn" title="Close" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>

      {/* ─── Main image area ─── */}
      <div className="iv-main" onClick={e => e.stopPropagation()} onWheel={handleWheel}>
        {currentIndex > 0 && (
          <button className="iv-nav iv-nav-left" onClick={() => onNavigate(currentIndex - 1)}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
        )}

        <img
          src={getFileUrl(currentImage.fileUrl)}
          alt={currentImage.fileName}
          className="iv-image"
          style={{ transform: `scale(${zoom})` }}
          onDoubleClick={handleDoubleClick}
          draggable={false}
        />

        {currentIndex < images.length - 1 && (
          <button className="iv-nav iv-nav-right" onClick={() => onNavigate(currentIndex + 1)}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
        )}
      </div>

      {/* ─── Bottom thumbnail strip — max 7: 3 əvvəlki + aktiv + 3 sonrakı ─── */}
      <div className="iv-thumbstrip" onClick={e => e.stopPropagation()} ref={thumbStripRef}>
        {images.map((img, idx) => {
          if (idx < currentIndex - 3 || idx > currentIndex + 3) return null;
          return (
            <div
              key={img.id}
              className={`iv-thumb${idx === currentIndex ? " active" : ""}`}
              onClick={() => onNavigate(idx)}
            >
              <img
                src={getFileUrl(img.fileUrl)}
                alt={img.fileName}
                loading="lazy"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
});

export default ImageViewer;
