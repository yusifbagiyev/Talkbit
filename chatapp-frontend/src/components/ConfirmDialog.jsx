// ─── ConfirmDialog.jsx — Təsdiqləmə modalı ──────────────────────────────────
// Bütün silmə/ayrılma əməliyyatları üçün universal confirm dialog.
// Props: message, confirmText, onConfirm, onCancel

function ConfirmDialog({ message, confirmText = "DELETE", onConfirm, onCancel }) {
  return (
    <div className="delete-confirm-overlay" onClick={onCancel}>
      <div className="delete-confirm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="delete-confirm-header">
          <span>{message}</span>
          <button className="delete-confirm-close" onClick={onCancel}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="delete-confirm-actions">
          <button className="delete-confirm-btn" onClick={onConfirm}>
            {confirmText}
          </button>
          <button className="delete-cancel-btn" onClick={onCancel}>
            CANCEL
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDialog;
