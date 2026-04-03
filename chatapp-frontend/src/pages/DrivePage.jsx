// ─── DrivePage — İşçi Drive Səhifəsi ─────────────────────────────────────────
// Bitrix24 style fayl idarəetmə səhifəsi. Qovluqlar, fayllar, trash, quota.
// Bütün sub-komponentlər inline olaraq bu fayldadır.

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  memo,
} from "react";
import {
  getDriveFolders,
  createDriveFolder,
  renameDriveFolder,
  moveDriveFolder,
  deleteDriveFolder,
  getDriveFiles,
  uploadDriveFile,
  renameDriveFile,
  moveDriveFile,
  deleteDriveFile,
  getDriveTrash,
  restoreDriveItem,
  permanentDeleteDriveItem,
  emptyDriveTrash,
  getDriveQuota,
  getFileUrl,
  downloadFile,
} from "../services/api";
import { useToast } from "../context/ToastContext";
import FileTypeIcon from "../components/FileTypeIcon";
import "./DrivePage.css";

// ─── Yardımçı funksiyalar ────────────────────────────────────────────────────

// Fayl ölçüsünü oxunaqlı formata çevir
function formatSize(bytes) {
  if (!bytes || bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

// Tarixi oxunaqlı formata çevir
function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// Şəkil faylı olub-olmadığını yoxla
function isImageFile(fileName) {
  if (!fileName) return false;
  const ext = fileName.split(".").pop().toLowerCase();
  return ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"].includes(ext);
}

// ─── Folder İkonu — dual-tone mavi SVG ───────────────────────────────────────
const FolderIcon = memo(function FolderIcon({ size = 40 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <path d="M4 10C4 8.895 4.895 8 6 8H16L20 12H34C35.105 12 36 12.895 36 14V30C36 31.105 35.105 32 34 32H6C4.895 32 4 31.105 4 30V10Z" fill="#93c5fd" />
      <path d="M4 10C4 8.895 4.895 8 6 8H16L20 12H4V10Z" fill="#60a5fa" />
    </svg>
  );
});

// ─── DriveHeader — Başlıq, + Add, axtarış, Recycle Bin, Quota ───────────────
const DriveHeader = memo(function DriveHeader({
  searchTerm, setSearchTerm, showAddDropdown, setShowAddDropdown,
  onUploadFile, onNewFolder, setShowRecycleBin, showRecycleBin,
  quota,
}) {
  const addRef = useRef(null);
  const fileInputRef = useRef(null);

  // Dropdown kənarına klik — bağla
  useEffect(() => {
    if (!showAddDropdown) return;
    const handler = (e) => {
      if (addRef.current && !addRef.current.contains(e.target)) setShowAddDropdown(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showAddDropdown, setShowAddDropdown]);


  return (
    <div className="drive-header">
      <div className="drive-header-left">
        <h1 className="drive-title">My Drive</h1>
        <div className="drive-add-wrap" ref={addRef}>
          <button className="drive-btn drive-btn-primary" onClick={() => setShowAddDropdown(!showAddDropdown)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            Add
          </button>
          {showAddDropdown && (
            <div className="drive-dropdown">
              <button className="drive-dropdown-item" onClick={() => { fileInputRef.current?.click(); setShowAddDropdown(false); }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                Upload File
              </button>
              <button className="drive-dropdown-item" onClick={() => { onNewFolder(); setShowAddDropdown(false); }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>
                New Folder
              </button>
            </div>
          )}
        </div>
        <div className="drive-search-wrap">
          <svg className="drive-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            className="drive-search-input"
            type="text"
            placeholder="Search files..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button className="drive-search-clear" onClick={() => setSearchTerm("")}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          )}
        </div>
      </div>

      <div className="drive-header-right">

        {/* Storage Quota — inline progress */}
        {quota && (
          <div className="drive-quota-inline">
            <div className="drive-quota-bar-wrap">
              <div
                className={`drive-quota-bar-fill${quota.percentage >= 90 ? " critical" : quota.percentage >= 70 ? " warning" : ""}`}
                style={{ width: `${Math.min(quota.percentage, 100)}%` }}
              />
            </div>
            <span className="drive-quota-text">{quota.usedMb?.toFixed(1) ?? 0} / {quota.limitMb?.toFixed(0) ?? 0} MB</span>
          </div>
        )}

        <button
          className={`drive-btn drive-btn-ghost${showRecycleBin ? " active" : ""}`}
          onClick={() => setShowRecycleBin(!showRecycleBin)}
        >
          Recycle Bin
        </button>
      </div>

      {/* Gizli fayl input — Upload File kliklənəndə açılır */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        style={{ display: "none" }}
        onChange={(e) => {
          if (e.target.files?.length) onUploadFile(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
});

// ─── DriveBreadcrumb — Qovluq naviqasiyası ───────────────────────────────────
const DriveBreadcrumb = memo(function DriveBreadcrumb({
  folderPath, onNavigate, viewMode, setViewMode,
  sortBy, setSortBy, sortOrder, setSortOrder,
  showSortDropdown, setShowSortDropdown,
}) {
  const sortRef = useRef(null);

  useEffect(() => {
    if (!showSortDropdown) return;
    const handler = (e) => {
      if (sortRef.current && !sortRef.current.contains(e.target)) setShowSortDropdown(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showSortDropdown, setShowSortDropdown]);

  const sortOptions = [
    { key: "name", label: "Name" },
    { key: "date", label: "Date" },
    { key: "size", label: "Size" },
  ];

  return (
    <div className="drive-toolbar">
      <div className="drive-breadcrumb">
        <button className="drive-breadcrumb-item" onClick={() => onNavigate(null, [])}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          My Drive
        </button>
        {folderPath.map((f, i) => (
          <span key={f.id} className="drive-breadcrumb-sep-item">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
            <button
              className={`drive-breadcrumb-item${i === folderPath.length - 1 ? " active" : ""}`}
              onClick={() => onNavigate(f.id, folderPath.slice(0, i + 1))}
            >
              {f.name}
            </button>
          </span>
        ))}
      </div>

      <div className="drive-toolbar-right">
        {/* Sort dropdown */}
        <div className="drive-sort-wrap" ref={sortRef}>
          <button className="drive-btn drive-btn-ghost" onClick={() => setShowSortDropdown(!showSortDropdown)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 5h10M11 9h7M11 13h4M3 17l4 4 4-4M7 3v18"/></svg>
            {sortOptions.find((s) => s.key === sortBy)?.label || "Sort"}
            {sortOrder === "asc" ? " ↑" : " ↓"}
          </button>
          {showSortDropdown && (
            <div className="drive-dropdown drive-dropdown-sort">
              {sortOptions.map((opt) => (
                <button
                  key={opt.key}
                  className={`drive-dropdown-item${sortBy === opt.key ? " active" : ""}`}
                  onClick={() => {
                    if (sortBy === opt.key) {
                      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                    } else {
                      setSortBy(opt.key);
                      setSortOrder("asc");
                    }
                    setShowSortDropdown(false);
                  }}
                >
                  {opt.label}
                  {sortBy === opt.key && <span className="drive-sort-arrow">{sortOrder === "asc" ? "↑" : "↓"}</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* View mode toggle */}
        <div className="drive-view-toggle">
          <button
            className={`drive-btn drive-btn-icon${viewMode === "grid-large" ? " active" : ""}`}
            title="Large Grid"
            onClick={() => setViewMode("grid-large")}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
          </button>
          <button
            className={`drive-btn drive-btn-icon${viewMode === "grid-medium" ? " active" : ""}`}
            title="Medium Grid"
            onClick={() => setViewMode("grid-medium")}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="5" height="5"/><rect x="10" y="3" width="5" height="5"/><rect x="17" y="3" width="5" height="5"/><rect x="3" y="10" width="5" height="5"/><rect x="10" y="10" width="5" height="5"/><rect x="17" y="10" width="5" height="5"/><rect x="3" y="17" width="5" height="5"/><rect x="10" y="17" width="5" height="5"/><rect x="17" y="17" width="5" height="5"/></svg>
          </button>
          <button
            className={`drive-btn drive-btn-icon${viewMode === "list" ? " active" : ""}`}
            title="List View"
            onClick={() => setViewMode("list")}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
          </button>
        </div>
      </div>
    </div>
  );
});

// ─── DriveFileCard — Tək fayl/qovluq kartı ──────────────────────────────────
const DriveFileCard = memo(function DriveFileCard({
  item, isFolder, selected, viewMode, hasSelection,
  onSelect, onClick, onContextMenu, onRename, renameItem,
}) {
  const renameRef = useCallback((node) => {
    if (node) node.focus();
  }, []);
  const isRenaming = renameItem?.id === item.id;
  const currentName = item.name || item.originalFileName || "";
  const [renameValue, setRenameValue] = useState(currentName);

  const handleRenameSubmit = () => {
    if (renameValue.trim() && renameValue.trim() !== (item.name || item.originalFileName)) {
      onRename(item, renameValue.trim(), isFolder);
    }
  };

  const name = isFolder ? item.name : item.originalFileName;
  const isImg = !isFolder && isImageFile(name);

  return (
    <div
      className={`drive-card${selected ? " selected" : ""}${viewMode === "grid-medium" ? " medium" : ""}${item._new ? " new-item" : ""}`}
      onClick={(e) => {
        if (isRenaming) return;
        if (e.ctrlKey || e.metaKey || hasSelection) { onSelect(item, isFolder); return; }
        onClick(item, isFolder);
      }}
      onContextMenu={(e) => { e.preventDefault(); onContextMenu(e, item, isFolder); }}
    >
      <div className="drive-card-checkbox" onClick={(e) => { e.stopPropagation(); onSelect(item, isFolder); }}>
        <input type="checkbox" checked={selected} readOnly />
      </div>
      <div className="drive-card-preview">
        {isFolder ? (
          <FolderIcon size={viewMode === "grid-medium" ? 36 : 48} />
        ) : isImg && item.serveUrl ? (
          <img src={getFileUrl(item.serveUrl)} alt={name} className="drive-card-thumb" loading="lazy" />
        ) : (
          <FileTypeIcon fileName={name} size={viewMode === "grid-medium" ? 36 : 48} />
        )}
      </div>
      <div className="drive-card-info">
        {isRenaming ? (
          <input
            ref={renameRef}
            className="drive-rename-input"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={handleRenameSubmit}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRenameSubmit();
              if (e.key === "Escape") onRename(null);
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="drive-card-name" title={name}>{name}</span>
        )}
        <span className="drive-card-meta">
          {isFolder ? `${item.itemCount || 0} items` : formatSize(item.fileSizeInBytes)}
          {!isFolder && item.createdAtUtc && ` · ${formatDate(item.createdAtUtc)}`}
        </span>
      </div>
    </div>
  );
});

// ─── DriveFileGrid — Grid görünüşü ──────────────────────────────────────────
const DriveFileGrid = memo(function DriveFileGrid({
  folders, files, viewMode, selectedItems,
  onSelect, onClick, onContextMenu, onRename, renameItem,
}) {
  const hasSelection = selectedItems.size > 0;
  return (
    <div className={`drive-grid${viewMode === "grid-medium" ? " medium" : ""}`}>
      {folders.map((f) => (
        <DriveFileCard
          key={`folder:${f.id}`}
          item={f}
          isFolder
          selected={selectedItems.has(`folder:${f.id}`)}
          hasSelection={hasSelection}
          viewMode={viewMode}
          onSelect={onSelect}
          onClick={onClick}
          onContextMenu={onContextMenu}
          onRename={onRename}
          renameItem={renameItem}
        />
      ))}
      {files.map((f) => (
        <DriveFileCard
          key={`file:${f.id}`}
          item={f}
          isFolder={false}
          selected={selectedItems.has(`file:${f.id}`)}
          hasSelection={hasSelection}
          viewMode={viewMode}
          onSelect={onSelect}
          onClick={onClick}
          onContextMenu={onContextMenu}
          onRename={onRename}
          renameItem={renameItem}
        />
      ))}
    </div>
  );
});

// ─── DriveFileList — List/Table görünüşü ─────────────────────────────────────
const DriveFileList = memo(function DriveFileList({
  folders, files, selectedItems, onSelect, onClick, onContextMenu, onRename, renameItem,
}) {
  const allItems = useMemo(() => [
    ...folders.map((f) => ({ ...f, _isFolder: true })),
    ...files.map((f) => ({ ...f, _isFolder: false })),
  ], [folders, files]);

  const allSelected = allItems.length > 0 && allItems.every((it) =>
    selectedItems.has(`${it._isFolder ? "folder" : "file"}-${it.id}`)
  );

  return (
    <div className="drive-list">
      <div className="drive-list-header">
        <div className="drive-list-cell drive-list-check">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={() => {
              if (allSelected) {
                // Hamısını seçimdən çıxar
                allItems.forEach((it) => onSelect(it, it._isFolder, true));
              } else {
                // Hamısını seç
                allItems.forEach((it) => {
                  const key = `${it._isFolder ? "folder" : "file"}-${it.id}`;
                  if (!selectedItems.has(key)) onSelect(it, it._isFolder);
                });
              }
            }}
          />
        </div>
        <div className="drive-list-cell drive-list-icon" />
        <div className="drive-list-cell drive-list-name">Name</div>
        <div className="drive-list-cell drive-list-size">Size</div>
        <div className="drive-list-cell drive-list-date">Modified</div>
        <div className="drive-list-cell drive-list-more" />
      </div>
      {allItems.map((it) => {
        const isFolder = it._isFolder;
        const key = `${isFolder ? "folder" : "file"}:${it.id}`;
        const name = isFolder ? it.name : it.originalFileName;
        const selected = selectedItems.has(key);
        const isRenaming = renameItem?.id === it.id;

        return (
          <DriveListRow
            key={key}
            item={it}
            isFolder={isFolder}
            name={name}
            selected={selected}
            isRenaming={isRenaming}
            hasSelection={selectedItems.size > 0}
            onSelect={onSelect}
            onClick={onClick}
            onContextMenu={onContextMenu}
            onRename={onRename}
          />
        );
      })}
    </div>
  );
});

// ─── DriveListRow — List görünüşünün tək sətri ──────────────────────────────
const DriveListRow = memo(function DriveListRow({
  item, isFolder, name, selected, isRenaming, hasSelection,
  onSelect, onClick, onContextMenu, onRename,
}) {
  const renameRef = useCallback((node) => {
    if (node) node.focus();
  }, []);
  const [renameValue, setRenameValue] = useState(name || "");

  const handleRenameSubmit = () => {
    if (renameValue.trim() && renameValue.trim() !== name) {
      onRename(item, renameValue.trim(), isFolder);
    }
  };

  return (
    <div
      className={`drive-list-row${selected ? " selected" : ""}`}
      onClick={(e) => {
        if (isRenaming) return;
        if (e.ctrlKey || e.metaKey || hasSelection) { onSelect(item, isFolder); return; }
        onClick(item, isFolder);
      }}
      onContextMenu={(e) => { e.preventDefault(); onContextMenu(e, item, isFolder); }}
    >
      <div className="drive-list-cell drive-list-check" onClick={(e) => { e.stopPropagation(); onSelect(item, isFolder); }}>
        <input type="checkbox" checked={selected} readOnly />
      </div>
      <div className="drive-list-cell drive-list-icon">
        {isFolder ? <FolderIcon size={24} /> : <FileTypeIcon fileName={name} size={24} />}
      </div>
      <div className="drive-list-cell drive-list-name">
        {isRenaming ? (
          <input
            ref={renameRef}
            className="drive-rename-input"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={handleRenameSubmit}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRenameSubmit();
              if (e.key === "Escape") onRename(null);
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span title={name}>{name}</span>
        )}
      </div>
      <div className="drive-list-cell drive-list-size">
        {isFolder ? `${item.itemCount || 0} items` : formatSize(item.fileSizeInBytes)}
      </div>
      <div className="drive-list-cell drive-list-date">
        {formatDate(item.updatedAtUtc || item.createdAtUtc)}
      </div>
      <div className="drive-list-cell drive-list-more">
        <button
          className="drive-btn drive-btn-icon drive-btn-sm"
          onClick={(e) => { e.stopPropagation(); onContextMenu(e, item, isFolder); }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>
        </button>
      </div>
    </div>
  );
});

// ─── DriveSelectionToolbar — Çox seçim əməliyyatları ─────────────────────────
const DriveSelectionToolbar = memo(function DriveSelectionToolbar({
  count, onDetails, onDownload, onRename, onMove, onDelete, onClearSelection,
}) {
  return (
    <div className="drive-selection-toolbar">
      <span className="drive-selection-count">{count} selected</span>
      <div className="drive-selection-actions">
        {count === 1 && (
          <>
            <button className="drive-btn drive-btn-ghost" onClick={onDetails}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
              Details
            </button>
            <button className="drive-btn drive-btn-ghost" onClick={onRename}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
              Rename
            </button>
          </>
        )}
        <button className="drive-btn drive-btn-ghost" onClick={onDownload}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Download
        </button>
        <button className="drive-btn drive-btn-ghost" onClick={onMove}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          Move
        </button>
        <button className="drive-btn drive-btn-ghost drive-btn-danger" onClick={onDelete}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
          Delete
        </button>
      </div>
      <button className="drive-btn drive-btn-icon" onClick={onClearSelection} title="Clear selection">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
  );
});

// ─── DriveDetailsPanel — Kompakt detallar paneli ─────────────────────────────
const DriveDetailsPanel = memo(function DriveDetailsPanel({ item, isFolder, onClose, onDownload, onDelete }) {
  if (!item) return null;
  const name = isFolder ? item.name : item.originalFileName;
  const isImg = !isFolder && isImageFile(name);

  return (
    <div className="drive-detail-overlay" onClick={onClose}>
      <div className="drive-detail-card" onClick={(e) => e.stopPropagation()}>
        {/* Yuxarı: preview + əsas məlumat */}
        <div className="drive-detail-top">
          <div className="drive-detail-preview">
            {isFolder ? (
              <FolderIcon size={48} />
            ) : isImg && item.serveUrl ? (
              <img src={getFileUrl(item.serveUrl)} alt={name} />
            ) : (
              <FileTypeIcon fileName={name} size={48} />
            )}
          </div>
          <div className="drive-detail-info">
            <span className="drive-detail-name">{name}</span>
            <span className="drive-detail-sub">
              {isFolder
                ? `${item.itemCount || 0} items`
                : `${formatSize(item.fileSizeInBytes)} · ${item.contentType || ""}`}
            </span>
            <span className="drive-detail-date">
              {formatDate(item.createdAtUtc)}
              {item.updatedAtUtc && ` · Modified ${formatDate(item.updatedAtUtc)}`}
            </span>
          </div>
          <button className="drive-detail-close" onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        {/* Aşağı: action butonlar */}
        <div className="drive-detail-actions">
          {!isFolder && (
            <button className="drive-detail-action" onClick={() => onDownload(item)}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Download
            </button>
          )}
          <button className="drive-detail-action danger" onClick={() => onDelete(item, isFolder)}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
});

// ─── DriveContextMenu — Sağ klik menyusu ─────────────────────────────────────
const DriveContextMenu = memo(function DriveContextMenu({
  contextMenu, onClose, onDetails, onDownload, onRename, onMove, onDelete,
}) {
  const menuRef = useRef(null);

  useEffect(() => {
    if (!contextMenu) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) onClose();
    };
    // setTimeout — açan klikin özü tərəfindən bağlanmasının qarşısını alır
    const timerId = setTimeout(() => {
      document.addEventListener("mousedown", handler);
      document.addEventListener("contextmenu", handler);
    }, 0);
    return () => {
      clearTimeout(timerId);
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("contextmenu", handler);
    };
  }, [contextMenu, onClose]);

  if (!contextMenu) return null;
  const { x, y, item, isFolder } = contextMenu;

  return (
    <div ref={menuRef} className="drive-context-menu" style={{ top: y, left: x }} onClick={(e) => e.stopPropagation()}>
      <button className="drive-context-item" onClick={() => { onDetails(item, isFolder); onClose(); }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
        Details
      </button>
      {!isFolder && (
        <button className="drive-context-item" onClick={() => { onDownload(item); onClose(); }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Download
        </button>
      )}
      <button className="drive-context-item" onClick={() => { onRename(item, isFolder); onClose(); }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
        Rename
      </button>
      <button className="drive-context-item" onClick={() => { onMove(item, isFolder); onClose(); }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
        Move
      </button>
      <div className="drive-context-divider" />
      <button className="drive-context-item danger" onClick={() => { onDelete(item, isFolder); onClose(); }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
        Delete
      </button>
    </div>
  );
});

// ─── DriveMoveDialog — Qovluq seçmə dialoquu ────────────────────────────────
const DriveMoveDialog = memo(function DriveMoveDialog({
  moveDialog, onClose, onConfirm, currentFolderId,
}) {
  const [folderTree, setFolderTree] = useState([]);
  const [targetId, setTargetId] = useState(null);
  const [loadingTree, setLoadingTree] = useState(true);
  const [expanded, setExpanded] = useState(new Set());
  const [childrenMap, setChildrenMap] = useState({});

  // Root qovluqları yüklə
  useEffect(() => {
    if (!moveDialog) return;
    let active = true;
    setLoadingTree(true); // eslint-disable-line react-hooks/set-state-in-effect
    getDriveFolders(null)
      .then((data) => { if (active) { setFolderTree(data || []); setTargetId(null); setLoadingTree(false); } })
      .catch(() => { if (active) setLoadingTree(false); });
    return () => { active = false; };
  }, [moveDialog]);

  // Qovluğu genişlət — uşaqları yüklə
  const toggleExpand = useCallback(async (folderId) => {
    if (expanded.has(folderId)) {
      const next = new Set(expanded);
      next.delete(folderId);
      setExpanded(next);
      return;
    }
    if (!childrenMap[folderId]) {
      try {
        const children = await getDriveFolders(folderId);
        setChildrenMap((prev) => ({ ...prev, [folderId]: children || [] }));
      } catch {
        setChildrenMap((prev) => ({ ...prev, [folderId]: [] }));
      }
    }
    setExpanded((prev) => new Set(prev).add(folderId));
  }, [expanded, childrenMap]);

  // Ağac düyümünü render et — rekursiv olduğu üçün adi funksiya
  function renderNode(folder, depth = 0) {
    const isExpanded = expanded.has(folder.id);
    const children = childrenMap[folder.id] || [];
    const isDisabled = folder.id === moveDialog?.item?.id;

    return (
      <div key={folder.id}>
        <div
          className={`drive-move-node${targetId === folder.id ? " selected" : ""}${isDisabled ? " disabled" : ""}`}
          style={{ paddingLeft: 12 + depth * 20 }}
          onClick={() => !isDisabled && setTargetId(folder.id)}
        >
          <button
            className="drive-move-expand"
            onClick={(e) => { e.stopPropagation(); toggleExpand(folder.id); }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
              style={{ transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s cubic-bezier(0.4,0,0.2,1)" }}>
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
          <FolderIcon size={20} />
          <span className="drive-move-name">{folder.name}</span>
        </div>
        {isExpanded && children.map((c) => renderNode(c, depth + 1))}
      </div>
    );
  }

  if (!moveDialog) return null;

  return (
    <div className="drive-move-overlay" onClick={onClose}>
      <div className="drive-move-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="drive-move-header">
          <h3>Move to...</h3>
          <button className="drive-btn drive-btn-icon" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div className="drive-move-tree">
          {/* Root — My Drive */}
          <div
            className={`drive-move-node${targetId === null ? " selected" : ""}`}
            onClick={() => setTargetId(null)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>
            <span className="drive-move-name">My Drive (Root)</span>
          </div>
          {loadingTree ? (
            <div className="drive-move-loading">Loading folders...</div>
          ) : (
            folderTree.map((f) => renderNode(f))
          )}
        </div>

        <div className="drive-move-footer">
          <button className="drive-btn drive-btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="drive-btn drive-btn-primary"
            disabled={targetId === currentFolderId}
            onClick={() => onConfirm(targetId)}
          >
            Move Here
          </button>
        </div>
      </div>
    </div>
  );
});

// ─── DriveQuotaBar — Saxlama kvotası popover ────────────────────────────────
const DriveQuotaBar = memo(function DriveQuotaBar({ quota }) {
  const usedPct = quota.limitBytes > 0
    ? Math.min(100, (quota.usedBytes / quota.limitBytes) * 100)
    : 0;

  return (
    <div className="drive-quota-popover">
      <div className="drive-quota-header">
        <span className="drive-quota-title">Storage</span>
        <span className="drive-quota-usage">{formatSize(quota.usedBytes)} of {formatSize(quota.limitBytes)}</span>
      </div>
      <div className="drive-quota-bar-track">
        <div
          className={`drive-quota-bar-fill${usedPct > 90 ? " critical" : usedPct > 70 ? " warning" : ""}`}
          style={{ width: `${usedPct}%` }}
        />
      </div>
      {quota.breakdown && (
        <div className="drive-quota-breakdown">
          {quota.breakdown.map((b, i) => (
            <div key={i} className="drive-quota-breakdown-row">
              <span className="drive-quota-breakdown-label">{b.label}</span>
              <span className="drive-quota-breakdown-value">{formatSize(b.bytes)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

// ─── DriveRecycleBin — Silinmiş fayllar görünüşü ────────────────────────────
const DriveRecycleBin = memo(function DriveRecycleBin({ onBack }) {
  const { showToast } = useToast();
  const [trashItems, setTrashItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadTrash = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getDriveTrash();
      setTrashItems(data || []);
    } catch {
      showToast("Failed to load recycle bin", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { loadTrash(); }, [loadTrash]);

  const handleRestore = async (item) => {
    try {
      await restoreDriveItem(item.id);
      showToast("Item restored", "success");
      loadTrash();
    } catch {
      showToast("Failed to restore item", "error");
    }
  };

  const handlePermanentDelete = async (item) => {
    try {
      await permanentDeleteDriveItem(item.id);
      showToast("Item permanently deleted", "success");
      loadTrash();
    } catch {
      showToast("Failed to delete permanently", "error");
    }
  };

  const handleEmptyTrash = async () => {
    try {
      await emptyDriveTrash();
      showToast("Recycle bin emptied", "success");
      setTrashItems([]);
    } catch {
      showToast("Failed to empty recycle bin", "error");
    }
  };

  return (
    <div className="drive-recycle-bin">
      <div className="drive-recycle-header">
        <button className="drive-btn drive-btn-ghost" onClick={onBack}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
          Back
        </button>
        <h2 className="drive-recycle-title">Recycle Bin</h2>
        {trashItems.length > 0 && (
          <button className="drive-btn drive-btn-ghost drive-btn-danger" onClick={handleEmptyTrash}>
            Empty Trash
          </button>
        )}
      </div>

      <div className="drive-recycle-info">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
        Files deleted to the Recycle Bin are kept for 30 days
      </div>

      {loading ? (
        <div className="drive-skeleton-list">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="drive-skeleton-row">
              <div className="drive-skeleton drive-skeleton-icon" />
              <div className="drive-skeleton drive-skeleton-text" />
              <div className="drive-skeleton drive-skeleton-text-sm" />
            </div>
          ))}
        </div>
      ) : trashItems.length === 0 ? (
        <div className="drive-empty">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="drive-empty-icon">
            <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
          </svg>
          <p className="drive-empty-text">Recycle bin is empty</p>
        </div>
      ) : (
        <div className="drive-list">
          {trashItems.map((item) => {
            const name = item.name || item.originalFileName || "Unknown";
            const isFolder = item.type === "folder";
            return (
              <div key={item.id} className="drive-list-row">
                <div className="drive-list-cell drive-list-icon">
                  {isFolder ? (
                    <FolderIcon size={24} />
                  ) : item.serveUrl && isImageFile(name) ? (
                    <img src={getFileUrl(item.serveUrl)} alt="" className="drive-trash-thumb" />
                  ) : (
                    <FileTypeIcon fileName={name} size={24} />
                  )}
                </div>
                <div className="drive-list-cell drive-list-name">
                  <span>{name}</span>
                </div>
                <div className="drive-list-cell drive-list-date">{formatDate(item.deletedAtUtc)}</div>
                <div className="drive-list-cell drive-list-actions">
                  <button className="drive-btn drive-btn-ghost drive-btn-sm" onClick={() => handleRestore(item)} title="Restore">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 105.64-12.28L1 10"/></svg>
                    Restore
                  </button>
                  <button className="drive-btn drive-btn-ghost drive-btn-danger drive-btn-sm" onClick={() => handlePermanentDelete(item)} title="Delete permanently">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});

// ─── Skeleton Loading — Yüklənmə zamanı göstərilən placeholder ──────────────
function DriveSkeleton({ viewMode }) {
  if (viewMode === "list") {
    return (
      <div className="drive-skeleton-list">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="drive-skeleton-row">
            <div className="drive-skeleton drive-skeleton-check" />
            <div className="drive-skeleton drive-skeleton-icon" />
            <div className="drive-skeleton drive-skeleton-text" />
            <div className="drive-skeleton drive-skeleton-text-sm" />
            <div className="drive-skeleton drive-skeleton-text-sm" />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className={`drive-grid${viewMode === "grid-medium" ? " medium" : ""}`}>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className={`drive-card skeleton${viewMode === "grid-medium" ? " medium" : ""}`}>
          <div className="drive-skeleton drive-skeleton-preview" />
          <div className="drive-skeleton drive-skeleton-text" />
          <div className="drive-skeleton drive-skeleton-text-sm" />
        </div>
      ))}
    </div>
  );
}

// ─── DrivePage — Ana komponent ───────────────────────────────────────────────
export default function DrivePage() {
  const { showToast } = useToast();

  // ── State ──
  const [currentFolderId, setCurrentFolderId] = useState(null);
  const [folderPath, setFolderPath] = useState([]);
  const [folders, setFolders] = useState([]);
  const [files, setFiles] = useState([]);
  const [viewMode, setViewMode] = useState(() => localStorage.getItem("driveViewMode") || "grid-large");
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [sortBy, setSortBy] = useState(() => localStorage.getItem("driveSortBy") || "date");
  const [sortOrder, setSortOrder] = useState("desc");
  const [searchTerm, setSearchTerm] = useState("");
  const [showRecycleBin, setShowRecycleBin] = useState(false);
  const [detailItem, setDetailItem] = useState(null);
  const [quota, setQuota] = useState(null);
  const [loading, setLoading] = useState(true);
  const [contextMenu, setContextMenu] = useState(null);
  const [moveDialog, setMoveDialog] = useState(null);
  const [renameItem, setRenameItem] = useState(null);
  const [showAddDropdown, setShowAddDropdown] = useState(false);
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  // Upload progress — [{name, progress, status}]
  const [uploads, setUploads] = useState([]);
  const [lightboxUrl, setLightboxUrl] = useState(null);
  const [newFolderDialog, setNewFolderDialog] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderSaving, setNewFolderSaving] = useState(false);

  // Debounced axtarış
  const searchTimerRef = useRef(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [searchTerm]);

  // localStorage-ə saxla
  useEffect(() => { localStorage.setItem("driveViewMode", viewMode); }, [viewMode]);
  useEffect(() => { localStorage.setItem("driveSortBy", sortBy); }, [sortBy]);

  // ── Məlumatları yüklə ──
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [foldersData, filesData] = await Promise.all([
        getDriveFolders(currentFolderId, debouncedSearch || undefined),
        getDriveFiles(currentFolderId, sortBy, sortOrder, debouncedSearch || undefined),
      ]);
      setFolders(foldersData || []);
      setFiles(filesData || []);
    } catch {
      showToast("Failed to load files", "error");
    } finally {
      setLoading(false);
    }
  }, [currentFolderId, sortBy, sortOrder, debouncedSearch, showToast]);

  useEffect(() => { loadData(); }, [loadData]);

  // Kvota yüklə — bir dəfə
  useEffect(() => {
    getDriveQuota()
      .then((data) => setQuota(data))
      .catch(() => {});
  }, []);

  // ── Naviqasiya ──
  const navigateToFolder = useCallback((folderId, newPath) => {
    setCurrentFolderId(folderId);
    setFolderPath(newPath || []);
    setSelectedItems(new Set());
    setSearchTerm("");
  }, []);

  // ── Fayl/qovluq klik handler-ləri ──
  const handleItemClick = useCallback((item, isFolder) => {
    if (isFolder) {
      navigateToFolder(item.id, [...folderPath, { id: item.id, name: item.name }]);
    } else if (isImageFile(item.originalFileName) && item.serveUrl) {
      // Şəkil faylı — lightbox açılır
      setLightboxUrl(getFileUrl(item.serveUrl));
    } else {
      // Digər fayllar — details paneli
      setDetailItem({ item, isFolder: false });
    }
  }, [folderPath, navigateToFolder]);

  const handleSelect = useCallback((item, isFolder, forceRemove = false) => {
    const key = `${isFolder ? "folder" : "file"}:${item.id}`;
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(key) || forceRemove) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  // ── Context menu ──
  const handleContextMenu = useCallback((e, item, isFolder) => {
    // Viewport kənarlarını yoxla
    const x = Math.min(e.clientX, window.innerWidth - 200);
    const y = Math.min(e.clientY, window.innerHeight - 250);
    setContextMenu({ x, y, item, isFolder });
  }, []);

  // ── Fayl yükləmə — progress ilə ──
  const handleUploadFiles = useCallback(async (fileList) => {
    const filesArr = Array.from(fileList);
    if (filesArr.length === 0) return;

    // Hər fayl üçün upload entry yarat
    const entries = filesArr.map((f, i) => ({ id: `up-${Date.now()}-${i}`, name: f.name, progress: 0, status: "uploading" }));
    setUploads((prev) => [...prev, ...entries]);

    let successCount = 0;
    for (let i = 0; i < filesArr.length; i++) {
      const file = filesArr[i];
      const entryId = entries[i].id;
      try {
        const formData = new FormData();
        formData.append("File", file);
        const result = await uploadDriveFile(formData, currentFolderId, (p) => {
          const pct = p.total ? Math.round((p.loaded / p.total) * 100) : 0;
          setUploads((prev) => prev.map((u) => u.id === entryId ? { ...u, progress: pct } : u));
        });
        setUploads((prev) => prev.map((u) => u.id === entryId ? { ...u, progress: 100, status: "done" } : u));
        // Yeni faylı birbaşa state-ə əlavə et — bütün siyahını yenidən yükləmə
        if (result) {
          setFiles((prev) => {
            if (prev.some((f) => f.id === result.fileId)) return prev;
            const newFile = {
              id: result.fileId,
              originalFileName: file.name,
              fileSizeInBytes: file.size,
              contentType: file.type,
              folderId: currentFolderId,
              serveUrl: result.serveUrl || result.downloadUrl,
              createdAtUtc: new Date().toISOString(),
              _new: true, // animasiya üçün flag
            };
            return [newFile, ...prev];
          });
        }
        successCount++;
      } catch {
        setUploads((prev) => prev.map((u) => u.id === entryId ? { ...u, status: "error" } : u));
      }
    }

    // 2 saniyə sonra tamamlanmış upload-ları sil
    setTimeout(() => {
      setUploads((prev) => prev.filter((u) => u.status === "uploading"));
    }, 2500);

    if (successCount > 0) {
      showToast(`${successCount} file(s) uploaded`, "success");
      getDriveQuota().then(setQuota).catch(() => {});
    }
  }, [currentFolderId, showToast]);

  // ── Yeni qovluq dialog açma ──
  const handleNewFolder = useCallback(() => {
    setNewFolderName("");
    setNewFolderDialog(true);
  }, []);

  // ── Yeni qovluq yaratma ──
  const handleCreateFolder = useCallback(async () => {
    if (!newFolderName.trim()) return;
    setNewFolderSaving(true);
    try {
      await createDriveFolder(newFolderName.trim(), currentFolderId);
      showToast("Folder created", "success");
      setNewFolderDialog(false);
      setNewFolderName("");
      loadData();
    } catch {
      showToast("Failed to create folder", "error");
    } finally {
      setNewFolderSaving(false);
    }
  }, [currentFolderId, newFolderName, loadData, showToast]);

  // ── Rename ──
  const handleRename = useCallback(async (item, newName, isFolder) => {
    if (!item) { setRenameItem(null); return; }
    if (!newName) { setRenameItem(null); return; }
    try {
      if (isFolder) {
        await renameDriveFolder(item.id, newName);
      } else {
        await renameDriveFile(item.id, newName);
      }
      showToast("Renamed successfully", "success");
      setRenameItem(null);
      loadData();
    } catch {
      showToast("Failed to rename", "error");
      setRenameItem(null);
    }
  }, [loadData, showToast]);

  // ── Silmə ──
  const handleDelete = useCallback(async (item, isFolder) => {
    try {
      if (isFolder) {
        await deleteDriveFolder(item.id);
      } else {
        await deleteDriveFile(item.id);
      }
      showToast("Moved to recycle bin", "success");
      setDetailItem(null);
      setSelectedItems(new Set());
      loadData();
      getDriveQuota().then(setQuota).catch(() => {});
    } catch {
      showToast("Failed to delete", "error");
    }
  }, [loadData, showToast]);

  // ── Çox seçimdə silmə ──
  const handleBulkDelete = useCallback(async () => {
    const items = Array.from(selectedItems);
    if (!items.length) return;
    try {
      await Promise.all(items.map((key) => {
        const [type, id] = key.split(":");
        return type === "folder" ? deleteDriveFolder(id) : deleteDriveFile(id);
      }));
      showToast(`${items.length} item(s) deleted`, "success");
      setSelectedItems(new Set());
      loadData();
      getDriveQuota().then(setQuota).catch(() => {});
    } catch {
      showToast("Failed to delete items", "error");
    }
  }, [selectedItems, loadData, showToast]);

  // ── Yükləmə (download) ──
  const handleDownload = useCallback(async (item) => {
    try {
      await downloadFile(item.id, item.originalFileName, item.serveUrl);
    } catch {
      showToast("Failed to download file", "error");
    }
  }, [showToast]);

  // ── Çox seçimdə yükləmə ──
  const handleBulkDownload = useCallback(async () => {
    for (const key of selectedItems) {
      const [type, id] = key.split(":");
      if (type === "file") {
        const file = files.find((f) => f.id === id);
        if (file) await handleDownload(file);
      }
    }
  }, [selectedItems, files, handleDownload]);

  // ── Move ──
  const handleMoveConfirm = useCallback(async (targetFolderId) => {
    if (!moveDialog) return;
    const { item, isFolder } = moveDialog;
    try {
      if (isFolder) {
        await moveDriveFolder(item.id, targetFolderId);
      } else {
        await moveDriveFile(item.id, targetFolderId);
      }
      showToast("Moved successfully", "success");
      setMoveDialog(null);
      setSelectedItems(new Set());
      loadData();
    } catch {
      showToast("Failed to move item", "error");
    }
  }, [moveDialog, loadData, showToast]);

  // ── Drag & Drop ──
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    // Yalnız əsas container-dən çıxdıqda
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const droppedFiles = e.dataTransfer?.files;
    if (droppedFiles?.length) handleUploadFiles(droppedFiles);
  }, [handleUploadFiles]);

  // ── Selection toolbar handler-ləri ──
  const getFirstSelectedItem = useCallback(() => {
    const firstKey = Array.from(selectedItems)[0];
    if (!firstKey) return null;
    const [type, id] = firstKey.split(":");
    const isFolder = type === "folder";
    const item = isFolder
      ? folders.find((f) => f.id === id)
      : files.find((f) => f.id === id);
    return item ? { item, isFolder } : null;
  }, [selectedItems, folders, files]);

  const handleSelectionDetails = useCallback(() => {
    const sel = getFirstSelectedItem();
    if (sel) setDetailItem(sel);
  }, [getFirstSelectedItem]);

  const handleSelectionRename = useCallback(() => {
    const sel = getFirstSelectedItem();
    if (sel) setRenameItem(sel.item);
  }, [getFirstSelectedItem]);

  const handleSelectionMove = useCallback(() => {
    const sel = getFirstSelectedItem();
    if (sel) setMoveDialog(sel);
  }, [getFirstSelectedItem]);

  // ── Boş vəziyyət ──
  const isEmpty = !loading && folders.length === 0 && files.length === 0;

  // ── Recycle bin görünüşü ──
  if (showRecycleBin) {
    return (
      <div className="drive-page">
        <DriveRecycleBin onBack={() => { setShowRecycleBin(false); loadData(); }} />
      </div>
    );
  }

  return (
    <div
      className={`drive-page${dragOver ? " drag-over" : ""}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {dragOver && (
        <div className="drive-drag-overlay">
          <div className="drive-drag-content">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--primary-color, #2fc6f6)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <p>Drop files here to upload</p>
          </div>
        </div>
      )}

      {/* Başlıq */}
      <DriveHeader
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        showAddDropdown={showAddDropdown}
        setShowAddDropdown={setShowAddDropdown}
        onUploadFile={handleUploadFiles}
        onNewFolder={handleNewFolder}
        setShowRecycleBin={setShowRecycleBin}
        showRecycleBin={showRecycleBin}
        quota={quota}
      />

      {/* Breadcrumb + toolbar */}
      <DriveBreadcrumb
        folderPath={folderPath}
        onNavigate={navigateToFolder}
        viewMode={viewMode}
        setViewMode={setViewMode}
        sortBy={sortBy}
        setSortBy={setSortBy}
        sortOrder={sortOrder}
        setSortOrder={setSortOrder}
        showSortDropdown={showSortDropdown}
        setShowSortDropdown={setShowSortDropdown}
      />

      {/* Selection toolbar */}
      {selectedItems.size > 0 && (
        <DriveSelectionToolbar
          count={selectedItems.size}
          onDetails={handleSelectionDetails}
          onDownload={handleBulkDownload}
          onRename={handleSelectionRename}
          onMove={handleSelectionMove}
          onDelete={handleBulkDelete}
          onClearSelection={() => setSelectedItems(new Set())}
        />
      )}

      {/* Əsas məzmun */}
      <div className="drive-content">
        {loading ? (
          <DriveSkeleton viewMode={viewMode} />
        ) : isEmpty ? (
          <div className="drive-empty">
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="drive-empty-icon">
              <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
            </svg>
            <p className="drive-empty-text">
              {debouncedSearch ? "No files match your search" : "This folder is empty"}
            </p>
            <p className="drive-empty-hint">
              {debouncedSearch ? "Try a different search term" : "Drop files here or click \"+ Add\" to get started"}
            </p>
          </div>
        ) : viewMode === "list" ? (
          <DriveFileList
            folders={folders}
            files={files}
            selectedItems={selectedItems}
            onSelect={handleSelect}
            onClick={handleItemClick}
            onContextMenu={handleContextMenu}
            onRename={handleRename}
            renameItem={renameItem}
          />
        ) : (
          <DriveFileGrid
            folders={folders}
            files={files}
            viewMode={viewMode}
            selectedItems={selectedItems}
            onSelect={handleSelect}
            onClick={handleItemClick}
            onContextMenu={handleContextMenu}
            onRename={handleRename}
            renameItem={renameItem}
          />
        )}
      </div>

      {/* Context menu */}
      <DriveContextMenu
        contextMenu={contextMenu}
        onClose={() => setContextMenu(null)}
        onDetails={(item, isFolder) => setDetailItem({ item, isFolder })}
        onDownload={handleDownload}
        onRename={(item) => setRenameItem(item)}
        onMove={(item, isFolder) => setMoveDialog({ item, isFolder })}
        onDelete={handleDelete}
      />

      {/* Details panel */}
      {detailItem && (
        <DriveDetailsPanel
          item={detailItem.item}
          isFolder={detailItem.isFolder}
          onClose={() => setDetailItem(null)}
          onDownload={handleDownload}
          onDelete={handleDelete}
        />
      )}

      {/* Move dialog */}
      <DriveMoveDialog
        moveDialog={moveDialog}
        onClose={() => setMoveDialog(null)}
        onConfirm={handleMoveConfirm}
        currentFolderId={currentFolderId}
      />

      {/* Yeni qovluq dialog */}
      {newFolderDialog && (
        <div className="drive-move-overlay" onClick={(e) => { if (e.target === e.currentTarget) setNewFolderDialog(false); }}>
          <div className="drive-newfolder-dialog">
            <div className="drive-newfolder-icon-wrap">
              <FolderIcon size={40} />
            </div>
            <h3 className="drive-newfolder-title">Create New Folder</h3>
            <input
              className="drive-newfolder-input"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && newFolderName.trim() && handleCreateFolder()}
              placeholder="Folder name"
              autoFocus
            />
            <div className="drive-newfolder-actions">
              <button className="drive-newfolder-create" onClick={handleCreateFolder} disabled={!newFolderName.trim() || newFolderSaving}>
                {newFolderSaving ? "CREATING..." : "CREATE"}
              </button>
              <button className="drive-newfolder-cancel" onClick={() => setNewFolderDialog(false)}>CLOSE</button>
            </div>
          </div>
        </div>
      )}

      {/* Upload progress panel — sağ aşağıda */}
      {uploads.length > 0 && (
        <div className="drive-upload-panel">
          <div className="drive-upload-panel-header">
            <span className="drive-upload-panel-title">Uploading {uploads.filter(u => u.status === "uploading").length} file(s)</span>
            <button className="drive-upload-panel-close" onClick={() => setUploads([])}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          {uploads.map((u) => (
            <div key={u.id} className="drive-upload-item">
              <span className="drive-upload-item-name">{u.name}</span>
              <div className="drive-upload-item-bar">
                <div className={`drive-upload-item-fill${u.status === "error" ? " error" : u.status === "done" ? " done" : ""}`} style={{ width: `${u.progress}%` }} />
              </div>
              <span className="drive-upload-item-pct">
                {u.status === "error" ? "Failed" : u.status === "done" ? "Done" : `${u.progress}%`}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox — şəkil faylı böyüdülmüş */}
      {lightboxUrl && (
        <div className="drive-lightbox" onClick={() => setLightboxUrl(null)}>
          <img src={lightboxUrl} alt="" onClick={(e) => e.stopPropagation()} />
          <button className="drive-lightbox-close" onClick={() => setLightboxUrl(null)}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      )}
    </div>
  );
}
