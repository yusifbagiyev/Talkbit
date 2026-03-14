import { memo } from "react";
import ConfirmDialog from "./ConfirmDialog";

function SelectToolbar({
  selectedCount,
  hasOthersSelected,
  onExit, onDelete, onForward,
  deleteConfirmOpen, setDeleteConfirmOpen,
}) {
  return (
    // Fragment <> </> — toolbar + modal (2 root element)
    <>
      {/* Select toolbar — chatın altında, input yerinə görünür */}
      <div className="select-toolbar">
        <div className="select-toolbar-inner">
          {/* Sol: X düyməsi + seçilmiş mesaj sayı */}
          <div className="select-toolbar-left">
            {/* X — select mode-dan çıx, seçimləri sıfırla */}
            <button className="select-toolbar-close" onClick={onExit}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            {/* selectedCount — Set.size — neçə mesaj seçilib */}
            <span className="select-toolbar-count">
              Messages ({selectedCount})
            </span>
          </div>

          {/* Separator çizgisi */}
          <div className="select-toolbar-divider" />

          {/* Sağ: Delete + Forward düymələri */}
          <div className="select-toolbar-right">
            {/* Delete düyməsi */}
            {/* disabled — heç nə seçilməyibsə YA başqasının mesajı seçilibsə */}
            {/* hasOthersSelected — başqasının mesajını silmək mümkün deyil */}
            <button
              className="select-action-btn select-delete-btn"
              disabled={selectedCount === 0 || hasOthersSelected}
              onClick={() => setDeleteConfirmOpen(true)}
              title={hasOthersSelected ? "You cannot delete someone else's message" : ""}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
              <span>Delete</span>
            </button>

            {/* Forward düyməsi — seçilmiş mesajları başqa chata yönləndir */}
            <button
              className="select-action-btn select-forward-btn"
              disabled={selectedCount === 0}
              onClick={onForward}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 17 20 12 15 7" />
                <path d="M4 18v-2a4 4 0 0 1 4-4h12" />
              </svg>
              <span>Forward</span>
            </button>
          </div>
        </div>
      </div>

      {deleteConfirmOpen && (
        <ConfirmDialog
          message={`Do you want to delete the selected messages (${selectedCount})?`}
          onConfirm={() => { setDeleteConfirmOpen(false); onDelete(); }}
          onCancel={() => setDeleteConfirmOpen(false)}
        />
      )}
    </>
  );
}

export default memo(SelectToolbar);
