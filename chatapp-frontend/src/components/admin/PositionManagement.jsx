import { useState, useEffect, useCallback, useMemo, memo } from "react";
import { getAllPositions, getDepartments, createPosition, updatePosition, deletePosition } from "../../services/api";
import { getAvatarColor } from "../../utils/chatUtils";
import "./PositionManagement.css";

// ─── PositionManagement — Departmentə görə hierarxik görünüş ─────────────────
function PositionManagement() {
  const [positions, setPositions]     = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState("");
  const [collapsed, setCollapsed]     = useState(new Set());
  const [rowDeleteConfirm, setRowDeleteConfirm] = useState(null);

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

  // Departmentə görə qruplanmış pozisiyalar
  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const map = new Map();

    departments.forEach(d => map.set(d.id, { ...d, positions: [] }));

    positions.forEach(p => {
      if (q && !p.name.toLowerCase().includes(q) && !p.departmentName?.toLowerCase().includes(q)) return;
      if (p.departmentId && map.has(p.departmentId)) {
        map.get(p.departmentId).positions.push(p);
      }
    });

    for (const dept of map.values()) {
      dept.positions.sort((a, b) => a.name.localeCompare(b.name));
    }

    return [...map.values()]
      .filter(d => q ? d.positions.length > 0 : true)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [positions, departments, search]);

  // Statistika
  const deptsWithPos = grouped.filter(d => d.positions.length > 0).length;
  const totalUsers = positions.reduce((sum, p) => sum + (p.userCount ?? 0), 0);

  const toggleCollapse = useCallback((id) => {
    setCollapsed(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  }, []);

  const expandAll = useCallback(() => setCollapsed(new Set()), []);
  const collapseAll = useCallback(() => {
    setCollapsed(new Set(departments.map(d => d.id)));
  }, [departments]);

  const openCreatePanel = useCallback((deptId) => {
    setFormName(""); setFormDeptId(deptId ?? ""); setFormDesc(""); setFormError("");
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
    if (!formDeptId) { setFormError("Department is required."); return; }
    setSaving(true);
    setFormError("");
    try {
      const payload = { name: formName.trim(), departmentId: formDeptId || null, description: formDesc.trim() || null };
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

  return (
    <div className="pm-root">
      {/* Header */}
      <div className="pm-header">
        <div className="pm-header-left">
          <h2 className="pm-title">Positions</h2>
          <span className="pm-badge">{positions.length}</span>
          <div className="pm-expand-controls">
            <button className="pm-expand-btn" onClick={expandAll} title="Expand all">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
            <button className="pm-expand-btn" onClick={collapseAll} title="Collapse all">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="18 15 12 9 6 15"/>
              </svg>
            </button>
          </div>
        </div>
        <div className="pm-header-right">
          <div className="pm-search-wrap">
            <svg className="pm-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input className="pm-search-input" placeholder="Search positions..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button className="pm-btn pm-btn-primary" onClick={() => openCreatePanel("")}>+ New Position</button>
        </div>
      </div>

      {/* Stats */}
      <div className="pm-stats">
        <div className="pm-stat-item">
          <span className="pm-stat-num">{positions.length}</span>
          <span className="pm-stat-label">Total</span>
        </div>
        <div className="pm-stat-divider" />
        <div className="pm-stat-item">
          <span className="pm-stat-num">{deptsWithPos}</span>
          <span className="pm-stat-label">Departments</span>
        </div>
        <div className="pm-stat-divider" />
        <div className="pm-stat-item">
          <span className="pm-stat-num">{totalUsers}</span>
          <span className="pm-stat-label">Assigned Users</span>
        </div>
      </div>

      {/* Hierarxik siyahı */}
      <div className="pm-tree">
        {loading ? (
          [1, 2, 3].map(i => (
            <div key={i} className="pm-skeleton-group">
              <div className="pm-skeleton-bar" style={{ width: "180px", height: "14px" }} />
              <div className="pm-skeleton-bar" style={{ width: "140px", height: "12px", marginLeft: "28px" }} />
              <div className="pm-skeleton-bar" style={{ width: "160px", height: "12px", marginLeft: "28px" }} />
            </div>
          ))
        ) : grouped.length === 0 ? (
          search ? (
            <div className="pm-empty-msg">No positions match your search.</div>
          ) : (
            <div className="pm-empty-state">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="7" width="20" height="14" rx="2"/>
                <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
                <line x1="12" y1="12" x2="12" y2="16"/>
                <line x1="10" y1="14" x2="14" y2="14"/>
              </svg>
              <p className="pm-empty-title">No positions yet</p>
              <p className="pm-empty-desc">Create positions and assign them to departments.</p>
              <button className="pm-btn pm-btn-primary" onClick={() => openCreatePanel("")}>
                Create your first position
              </button>
            </div>
          )
        ) : grouped.map(dept => {
          const isOpen = !collapsed.has(dept.id);
          const posCount = dept.positions.length;
          return (
            <div key={dept.id} className={`pm-dept-group${isOpen ? " pm-dept-group--open" : ""}`}>
              {/* Department başlığı */}
              <div className="pm-dept-header" onClick={() => toggleCollapse(dept.id)}>
                <span className={`pm-chevron${isOpen ? " pm-chevron--open" : ""}`}>▶</span>
                <div className="pm-dept-icon" style={{ background: getAvatarColor(dept.name) }}>
                  {dept.name.charAt(0).toUpperCase()}
                </div>
                <span className="pm-dept-name">{dept.name}</span>
                <span className="pm-dept-count">
                  {posCount} {posCount === 1 ? "position" : "positions"}
                </span>
                {/* Department üçün sürətli əlavə düyməsi */}
                <button className="pm-dept-add-btn" title="Add position" onClick={(e) => { e.stopPropagation(); openCreatePanel(dept.id); }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                </button>
              </div>

              {/* Pozisiya siyahısı */}
              {isOpen && (
                <div className="pm-pos-list">
                  {posCount === 0 ? (
                    <div className="pm-no-positions">
                      <span>No positions in this department</span>
                    </div>
                  ) : dept.positions.map((pos, idx) => {
                    const isLast = idx === posCount - 1;
                    const isDeleteConfirm = rowDeleteConfirm === pos.id;
                    return (
                      <div key={pos.id} className={`pm-pos-row${isDeleteConfirm ? " pm-pos-row--confirm" : ""}${isLast ? " pm-pos-row--last" : ""}`}>
                        {/* Tree konnektoru */}
                        <div className="pm-tree-line">
                          <div className={`pm-tree-vert${isLast ? " pm-tree-vert--last" : ""}`} />
                          <div className="pm-tree-horiz" />
                        </div>

                        {isDeleteConfirm ? (
                          <div className="pm-row-delete-confirm">
                            <span>Delete <b>{pos.name}</b>?</span>
                            <button className="pm-delete-yes" onClick={() => handleDelete(pos)}>Yes</button>
                            <button className="pm-delete-no" onClick={() => setRowDeleteConfirm(null)}>No</button>
                          </div>
                        ) : (
                          <>
                            <div className="pm-pos-dot" />
                            <span className="pm-pos-name">{pos.name}</span>
                            {pos.description && (
                              <span className="pm-pos-desc" title={pos.description}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
                                </svg>
                              </span>
                            )}
                            <span className="pm-pos-users">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                                <circle cx="9" cy="7" r="4"/>
                              </svg>
                              {pos.userCount ?? 0}
                            </span>
                            <div className="pm-row-actions">
                              <button className="pm-action-btn" title="Edit" onClick={() => openEditPanel(pos)}>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                </svg>
                              </button>
                              <button className="pm-action-btn delete" title="Delete" onClick={() => setRowDeleteConfirm(pos.id)}>
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
                  })}
                </div>
              )}
            </div>
          );
        })}
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
                <input className="pm-form-input" placeholder="Enter name..." value={formName} onChange={e => setFormName(e.target.value)} autoFocus />
                {formError && <span className="pm-form-error">{formError}</span>}
              </div>
              <div className="pm-form-field">
                <label className="pm-form-label pm-form-label--required">Department *</label>
                <select className="pm-form-select" value={formDeptId} onChange={e => setFormDeptId(e.target.value)}>
                  <option value="">Select a department...</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div className="pm-form-field">
                <label className="pm-form-label">Description</label>
                <textarea className="pm-form-textarea" placeholder="Optional description..." value={formDesc} onChange={e => setFormDesc(e.target.value)} rows={3} />
              </div>
              <div className="pm-form-actions">
                <button type="button" className="pm-btn pm-btn-ghost" onClick={closePanel} disabled={saving}>Cancel</button>
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
