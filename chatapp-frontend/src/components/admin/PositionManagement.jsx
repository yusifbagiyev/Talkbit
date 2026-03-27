import { useState, useEffect, useCallback, useMemo, memo } from "react";
import { getAllPositions, getDepartments, createPosition, updatePosition, deletePosition } from "../../services/api";
import "./PositionManagement.css";

// ─── PositionManagement ───────────────────────────────────────────────────────
function PositionManagement() {
  const [positions, setPositions]   = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [sort, setSort]             = useState("asc");
  const [rowDeleteConfirm, setRowDeleteConfirm] = useState(null); // posId

  // panel: null | 'create' | 'edit'
  const [panel, setPanel]         = useState(null);
  const [activePos, setActivePos] = useState(null);
  const [formName, setFormName]   = useState("");
  const [formDeptId, setFormDeptId] = useState("");
  const [formDesc, setFormDesc]   = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving]       = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [pos, depts] = await Promise.all([getAllPositions(), getDepartments()]);
      setPositions(pos ?? []);
      setDepartments(depts ?? []);
    } catch (e) {
      console.error("Failed to load positions", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = useMemo(() => {
    let rows = [...positions];
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(p => p.name.toLowerCase().includes(q));
    }
    if (deptFilter === "none") {
      rows = rows.filter(p => !p.departmentId);
    } else if (deptFilter !== "all") {
      rows = rows.filter(p => p.departmentId === deptFilter);
    }
    rows.sort((a, b) => sort === "asc" ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name));
    return rows;
  }, [positions, search, deptFilter, sort]);

  const openCreatePanel = useCallback(() => {
    setFormName(""); setFormDeptId(""); setFormDesc(""); setFormError("");
    setActivePos(null);
    setPanel("create");
  }, []);

  const openEditPanel = useCallback((pos) => {
    setFormName(pos.name);
    setFormDeptId(pos.departmentId ?? "");
    setFormDesc(pos.description ?? "");
    setFormError("");
    setActivePos(pos);
    setPanel("edit");
  }, []);

  const closePanel = useCallback(() => { setPanel(null); setActivePos(null); setFormError(""); }, []);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!formName.trim()) { setFormError("Position name is required."); return; }
    setSaving(true);
    setFormError("");
    try {
      const payload = {
        name: formName.trim(),
        departmentId: formDeptId || null,
        description: formDesc.trim() || null,
      };
      if (panel === "create") await createPosition(payload);
      else await updatePosition(activePos.id, payload);
      await loadData();
      closePanel();
    } catch (err) {
      setFormError(err?.message ?? "An error occurred.");
    } finally {
      setSaving(false);
    }
  }, [formName, formDeptId, formDesc, panel, activePos, loadData, closePanel]);

  const handleDelete = useCallback(async (pos) => {
    setRowDeleteConfirm(null);
    try {
      await deletePosition(pos.id);
      await loadData();
    } catch (err) {
      alert(err?.message ?? "Delete failed.");
    }
  }, [loadData]);

  const toggleSort = useCallback(() => setSort(s => s === "asc" ? "desc" : "asc"), []);
  const isFiltering = search || deptFilter !== "all";

  return (
    <div className="pm-root">
      {/* Header */}
      <div className="pm-toolbar-header">
        <div className="pm-toolbar-left">
          <h2 className="pm-section-title">Positions</h2>
          <span className="pm-count">{positions.length}</span>
        </div>
        <button className="pm-btn pm-btn-primary" onClick={openCreatePanel}>+ New Position</button>
      </div>

      {/* Filter row */}
      <div className="pm-toolbar">
        <div className="pm-search-wrap">
          <svg className="pm-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            className="pm-search-input"
            placeholder="Search positions..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="pm-filter-select"
          value={deptFilter}
          onChange={e => setDeptFilter(e.target.value)}
        >
          <option value="all">All Departments</option>
          <option value="none">No Department</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <button className="pm-sort-btn" onClick={toggleSort} title="Sort by name">
          Name {sort === "asc" ? "↑" : "↓"}
        </button>
      </div>

      {/* List */}
      <div className="pm-list-wrap">
        {/* Header row */}
        <div className="pm-list-header">
          <span style={{ flex: 1 }}>Position</span>
          <span className="pm-list-header-dept">Department</span>
          <span className="pm-list-header-count">Users</span>
          <span style={{ width: "64px" }} />
        </div>

        {loading ? (
          [1, 2, 3].map(i => (
            <div key={i} className="pm-skeleton-row">
              <div className="pm-skeleton-bar" style={{ width: "35%" }} />
              <div className="pm-skeleton-bar" style={{ width: "22%" }} />
            </div>
          ))
        ) : filtered.length === 0 ? (
          isFiltering ? (
            <div className="pm-empty-msg">No positions match your search.</div>
          ) : (
            <div className="pm-empty-state">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="7" width="20" height="14" rx="2"/>
                <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
              </svg>
              <p>No positions yet.</p>
              <button className="pm-btn pm-btn-primary" onClick={openCreatePanel}>
                → Create your first position
              </button>
            </div>
          )
        ) : (
          filtered.map(pos => {
            const isDeleteConfirm = rowDeleteConfirm === pos.id;
            return (
              <div key={pos.id}
                className={`pm-position-row${isDeleteConfirm ? " pm-position-row--confirm" : ""}`}>
                {isDeleteConfirm ? (
                  <div className="pm-row-delete-confirm">
                    <span>Delete <b>{pos.name}</b>?</span>
                    <button className="pm-delete-yes" onClick={() => handleDelete(pos)}>Yes</button>
                    <button className="pm-delete-no" onClick={() => setRowDeleteConfirm(null)}>No</button>
                  </div>
                ) : (
                  <>
                    <span className="pm-pos-name">{pos.name}</span>
                    <span className="pm-pos-dept">
                      {pos.departmentId
                        ? pos.departmentName
                        : <span style={{ color: "#d1d5db" }}>—</span>}
                    </span>
                    <span className="pm-pos-count">
                      {pos.userCount ?? "—"}
                    </span>
                    <div className="pm-row-actions">
                      <button className="pm-action-btn" title="Edit"
                        onClick={() => openEditPanel(pos)}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </button>
                      <button className="pm-action-btn delete" title="Delete"
                        onClick={() => setRowDeleteConfirm(pos.id)}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6"/>
                          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                          <path d="M10 11v6M14 11v6"/>
                          <path d="M9 6V4h6v2"/>
                        </svg>
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Create / Edit Panel */}
      {(panel === "create" || panel === "edit") && (
        <>
          <div className="pm-form-overlay" onClick={closePanel} />
          <div className="pm-form-panel">
            <div className="pm-form-header">
              <h3 className="pm-form-title">
                {panel === "create" ? "Create Position" : "Edit Position"}
              </h3>
              <button className="pm-form-close" onClick={closePanel} aria-label="Close">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <form className="pm-form-body" onSubmit={handleSubmit}>
              <div className="pm-form-field">
                <label className="pm-form-label pm-form-label--required">Position Name *</label>
                <input
                  className="pm-form-input"
                  placeholder="Enter name..."
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  autoFocus
                />
                {formError && <span className="pm-form-error">{formError}</span>}
              </div>
              <div className="pm-form-field">
                <label className="pm-form-label">Department</label>
                <select
                  className="pm-form-select"
                  value={formDeptId}
                  onChange={e => setFormDeptId(e.target.value)}
                >
                  <option value="">No Department (company-wide)</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                <span className="pm-form-hint">ⓘ Leave empty for company-wide positions (CEO, CTO, etc.)</span>
              </div>
              <div className="pm-form-field">
                <label className="pm-form-label">Description</label>
                <textarea
                  className="pm-form-textarea"
                  placeholder="Optional description..."
                  value={formDesc}
                  onChange={e => setFormDesc(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="pm-form-actions">
                <button type="button" className="pm-btn pm-btn-ghost" onClick={closePanel} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" className="pm-btn pm-btn-primary" disabled={saving}>
                  {saving ? <span className="pm-spinner" /> : (panel === "create" ? "Create" : "Save Changes")}
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  );
}

export default memo(PositionManagement);
