// ─── useFileUpload.js — Custom Hook: Fayl Seçmə State İdarəsi ──────────────
// Bu hook fayl SEÇMƏ UI state-lərini idarə edir (FilePreviewPanel üçün).
// Upload prosesi useFileUploadManager hook-u ilə idarə olunur.

import { useState } from "react";

export default function useFileUpload() {

  // ─── State-lər ────────────────────────────────────────────────────────────
  const [selectedFiles, setSelectedFiles] = useState([]);       // Seçilmiş fayllar (File[])

  // ─── handleFilesSelected — attach menu-dan fayl seçildikdə ────────────────
  // 0 bytes fayllar filter olunur — boş faylın yüklənməsinə icazə verilmir
  function handleFilesSelected(files) {
    const valid = files.filter((f) => f.size > 0);
    if (valid.length === 0) return;
    setSelectedFiles((prev) => [...prev, ...valid]);
  }

  // ─── handleRemoveFile — preview paneldən faylı sil ─────────────────────────
  function handleRemoveFile(index) {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  }

  // ─── handleReorderFiles — drag-drop ilə faylın sırasını dəyiş ─────────────
  function handleReorderFiles(fromIndex, toIndex) {
    setSelectedFiles((prev) => {
      const arr = [...prev];
      const [moved] = arr.splice(fromIndex, 1);
      arr.splice(toIndex, 0, moved);
      return arr;
    });
  }

  // ─── handleClearFiles — bütün faylları sil (preview paneli bağla) ──────────
  function handleClearFiles() {
    setSelectedFiles([]);
  }

  return {
    selectedFiles,
    setSelectedFiles,
    handleFilesSelected,
    handleRemoveFile,
    handleReorderFiles,
    handleClearFiles,
  };
}
