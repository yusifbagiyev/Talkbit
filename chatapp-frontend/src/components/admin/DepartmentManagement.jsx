import { useState, useEffect, useCallback, useMemo, useRef, memo } from "react";
import {
  getDepartments, createDepartment, updateDepartment, deleteDepartment,
  assignDepartmentHead, removeDepartmentHead, getUsers, searchUsers,
  uploadDepartmentAvatar, getFileUrl,
} from "../../services/api";
import { getInitials, getAvatarColor } from "../../utils/chatUtils";
import { useAuth } from "../../context/AuthContext";
import "./DepartmentManagement.css";

// ─── DeptDetailPanel ──────────────────────────────────────────────────────────
const DeptDetailPanel = memo(function DeptDetailPanel({
  dept, allDepts, closing, onClose, onDeleted, onEdit, onChangeHead,
}) {
  const [members, setMembers]       = useState(null); // null = loading
  const [deleteConfirm, setDeleteConfirm]   = useState(false);
  const [deleting, setDeleting]     = useState(false);

  useEffect(() => {
    if (!dept) return;
    let active = true;
    getUsers({ departmentId: dept.id, pageSize: 50 })
      .then(d => { if (active) setMembers(d?.items ?? (Array.isArray(d) ? d : [])); })
      .catch(() => { if (active) setMembers([]); });
    return () => { active = false; };
  }, [dept]);

  const subDeptCount = allDepts.filter(d => d.parentDepartmentId === dept.id).length;
  const parentDept   = allDepts.find(d => d.id === dept.parentDepartmentId);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteDepartment(dept.id);
      onDeleted(); // panel bağla + depts siyahısını yenilə
    } catch (err) {
      alert(err.message || "Delete failed.");
      setDeleting(false);
      setDeleteConfirm(false);
    }
  };

  return (
    <>
      <div className="dm-detail-overlay" onClick={onClose} />
      <div className={`dm-detail-panel${closing ? " closing" : ""}`}>
        <div className="dm-detail-header">
          <div>
            <div className="dm-detail-title">{dept.name}</div>
            {parentDept && (
              <div className="dm-detail-parent">↳ {parentDept.name}</div>
            )}
          </div>
          <button className="dm-detail-close" onClick={onClose}>✕</button>
        </div>

        <div className="dm-detail-body">
          {/* Head */}
          <div className="dm-detail-section">
            <p className="dm-detail-section-label">Head</p>
            {dept.headOfDepartmentId ? (
              <div className="dm-detail-head-row">
                <div className="dm-detail-head-avatar"
                  style={{ background: getAvatarColor(dept.headOfDepartmentName ?? "") }}>
                  {getInitials(dept.headOfDepartmentName ?? "")}
                </div>
                <span style={{ flex: 1, fontWeight: 500, fontSize: "13px" }}>
                  {dept.headOfDepartmentName}
                </span>
                <button className="dm-change-head-btn" onClick={() => onChangeHead(dept)}>
                  Change
                </button>
              </div>
            ) : (
              <div className="dm-detail-head-row">
                <span style={{ fontSize: "13px", color: "#9ca3af", flex: 1 }}>No head assigned</span>
                <button className="dm-change-head-btn" onClick={() => onChangeHead(dept)}>
                  Assign
                </button>
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="dm-detail-section">
            <p className="dm-detail-section-label">Stats</p>
            <div className="dm-detail-stats">
              <div className="dm-detail-stat-card">
                <div className="dm-detail-stat-num">{members.length}</div>
                <div className="dm-detail-stat-label">Members</div>
              </div>
              <div className="dm-detail-stat-card">
                <div className="dm-detail-stat-num">{subDeptCount}</div>
                <div className="dm-detail-stat-label">Sub-depts</div>
              </div>
            </div>
          </div>

          {/* Members */}
          {(members === null || members.length > 0) && (
            <div className="dm-detail-section">
              <p className="dm-detail-section-label">Members</p>
              {members === null ? (
                <div style={{ fontSize: "13px", color: "#9ca3af" }}>Loading...</div>
              ) : (
                members.map(m => {
                  const mName = m.fullName ?? `${m.firstName ?? ""} ${m.lastName ?? ""}`.trim();
                  return (
                    <div key={m.id} className="dm-detail-member">
                      <div className="dm-detail-member-avatar"
                        style={{ background: getAvatarColor(mName) }}>
                        {getInitials(mName)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 500, fontSize: "13px" }}>{mName}</div>
                        {m.positionName && (
                          <div style={{ fontSize: "11px", color: "#6b7280" }}>{m.positionName}</div>
                        )}
                      </div>
                      {m.id === dept.headOfDepartmentId && (
                        <span className="dm-head-badge">HEAD</span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        <div className="dm-detail-footer">
          <button className="dm-btn dm-btn-primary" onClick={() => onEdit(dept)}>
            Edit Department
          </button>
          <button className="dm-btn-delete-outline" onClick={() => setDeleteConfirm(true)}>
            Delete
          </button>
        </div>
      </div>

      {/* Delete confirm modal */}
      {deleteConfirm && (
        <>
          <div className="dm-modal-backdrop" onClick={() => !deleting && setDeleteConfirm(false)} />
          <div className="dm-modal">
            <div className="dm-modal-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                <path d="M10 11v6M14 11v6"/>
                <path d="M9 6V4h6v2"/>
              </svg>
            </div>
            <h3 className="dm-modal-title">Delete Department</h3>
            <p className="dm-modal-desc">
              Are you sure you want to delete <strong>{dept.name}</strong>?
              This action cannot be undone.
            </p>
            <div className="dm-modal-actions">
              <button className="dm-btn dm-btn-ghost" onClick={() => setDeleteConfirm(false)} disabled={deleting}>
                Cancel
              </button>
              <button className="dm-btn dm-btn-danger" onClick={handleDelete} disabled={deleting}>
                {deleting ? "Deleting..." : "Yes, Delete"}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
});

// ─── DepartmentManagement ─────────────────────────────────────────────────────
function DepartmentManagement() {
  const { hasPermission } = useAuth();
  const canUploadAvatar = hasPermission("Avatar.Upload");
  const [depts, setDepts]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState("");
  const [collapsed, setCollapsed]   = useState(new Set());
  const [rowDeleteConfirm, setRowDeleteConfirm] = useState(null); // deptId

  // Detail panel
  const [detailDept, setDetailDept] = useState(null);
  const [detailClosing, setDetailClosing] = useState(false);

  // panel: null | 'create' | 'edit' | 'head'
  const [panel, setPanel]           = useState(null);
  const [activeDept, setActiveDept] = useState(null);

  // Create/Edit form
  const [formName, setFormName]         = useState("");
  const [formParentId, setFormParentId] = useState("");
  const [formError, setFormError]       = useState("");
  const [saving, setSaving]             = useState(false);

  // Avatar
  const [formAvatarUrl, setFormAvatarUrl]     = useState(null);
  const [avatarPreview, setAvatarPreview]     = useState(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef                        = useRef(null);

  // Head panel
  const [users, setUsers]                   = useState([]);
  const [usersLoading, setUsersLoading]     = useState(false);
  const [headSearch, setHeadSearch]         = useState("");
  const [selectedHeadId, setSelectedHeadId] = useState(null);
  const [headSaving, setHeadSaving]         = useState(false);
  const headSearchDebounce                  = useRef(null);

  const loadDepts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getDepartments();
      setDepts(data ?? []);
    } catch (e) {
      console.error("Failed to load departments", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadDepts(); }, [loadDepts]);

  // Head panel açılanda və ya headSearch dəyişəndə server-side axtarış
  const fetchHeadUsers = useCallback((q) => {
    setUsersLoading(true);
    const req = q.length >= 2
      ? searchUsers(q)
      : getUsers({ pageSize: 100 });
    req
      .then(d => setUsers(d?.items ?? (Array.isArray(d) ? d : [])))
      .catch(() => setUsers([]))
      .finally(() => setUsersLoading(false));
  }, []);

  // Collapse/expand
  const toggleCollapse = useCallback((id) => {
    setCollapsed(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  }, []);

  // Dept visible-dırmı? (yuxarı ancestor collapsed-dırsa görünmür)
  const isVisible = useCallback((dept) => {
    if (!dept.parentDepartmentId) return true;
    if (collapsed.has(dept.parentDepartmentId)) return false;
    const parent = depts.find(d => d.id === dept.parentDepartmentId);
    return parent ? isVisible(parent) : true;
  }, [depts, collapsed]);

  // Dept-in child-ı varmı?
  const hasChildren = useCallback((deptId) => depts.some(d => d.parentDepartmentId === deptId), [depts]);

  // Dept level-i (kök=0)
  const getLevel = useCallback((dept) => {
    let level = 0;
    let current = dept;
    while (current.parentDepartmentId) {
      level++;
      current = depts.find(d => d.id === current.parentDepartmentId) ?? { parentDepartmentId: null };
    }
    return level;
  }, [depts]);

  // Tree order — depth-first
  const treeOrdered = useMemo(() => {
    const childrenOf = {};
    depts.forEach(d => {
      const pid = d.parentDepartmentId ?? "__root__";
      if (!childrenOf[pid]) childrenOf[pid] = [];
      childrenOf[pid].push(d);
    });
    const result = [];
    function walk(id) {
      (childrenOf[id] ?? []).forEach(d => {
        result.push(d);
        walk(d.id);
      });
    }
    walk("__root__");
    return result;
  }, [depts]);

  const filteredRows = useMemo(() => {
    if (!search.trim()) return treeOrdered.filter(d => isVisible(d));
    const q = search.toLowerCase();
    return depts.filter(d => d.name.toLowerCase().includes(q));
  }, [treeOrdered, depts, search, isVisible]);

  // Detail panel
  const openDetailPanel = useCallback((dept) => {
    setDetailDept(dept);
    setDetailClosing(false);
  }, []);

  const closeDetailPanel = useCallback(() => {
    setDetailClosing(true);
    setTimeout(() => { setDetailDept(null); setDetailClosing(false); }, 200);
  }, []);

  const handleAvatarChange = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarPreview(URL.createObjectURL(file));
    setAvatarUploading(true);
    try {
      const companyId = activeDept?.companyId ?? depts[0]?.companyId;
      const departmentId = activeDept?.id ?? null;
      const result = await uploadDepartmentAvatar(file, companyId, departmentId, activeDept?.avatarUrl);
      setFormAvatarUrl(result.downloadUrl);
    } catch {
      setAvatarPreview(null);
      setFormAvatarUrl(null);
    } finally {
      setAvatarUploading(false);
    }
  }, [activeDept, depts]);

  const openCreatePanel = useCallback(() => {
    setFormName(""); setFormParentId(""); setFormError("");
    setFormAvatarUrl(null); setAvatarPreview(null);
    setActiveDept(null);
    setPanel("create");
  }, []);

  const openEditPanel = useCallback((dept) => {
    setFormName(dept.name);
    setFormParentId(dept.parentDepartmentId ?? "");
    setFormError("");
    setFormAvatarUrl(dept.avatarUrl ?? null);
    setAvatarPreview(dept.avatarUrl ? getFileUrl(dept.avatarUrl) : null);
    setActiveDept(dept);
    setPanel("edit");
    closeDetailPanel();
  }, [closeDetailPanel]);

  // headSearch dəyişdikdə debounce ilə axtarış et — minimum 2 simvol tələb olunur
  useEffect(() => {
    if (panel !== "head") return;
    const q = headSearch.trim();
    if (q.length < 2) { setUsers([]); return; }
    clearTimeout(headSearchDebounce.current);
    headSearchDebounce.current = setTimeout(() => fetchHeadUsers(q), 300);
  }, [headSearch, panel, fetchHeadUsers]);

  const openHeadPanel = useCallback((dept) => {
    setActiveDept(dept);
    setHeadSearch("");
    setSelectedHeadId(null);
    setUsers([]);
    setPanel("head");
    closeDetailPanel();
  }, [closeDetailPanel]);

  const closePanel = useCallback(() => {
    setPanel(null);
    setActiveDept(null);
    setFormError("");
    setFormAvatarUrl(null);
    setAvatarPreview(null);
  }, []);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!formName.trim()) { setFormError("Department name is required."); return; }
    if (panel === "create" && !formAvatarUrl) { setFormError("Department avatar is required."); return; }
    setSaving(true);
    setFormError("");
    try {
      const payload = { name: formName.trim(), parentDepartmentId: formParentId || null, avatarUrl: formAvatarUrl || null };
      if (panel === "create") await createDepartment(payload);
      else await updateDepartment(activeDept.id, payload);
      await loadDepts();
      closePanel();
    } catch (err) {
      setFormError(err?.message ?? "An error occurred.");
    } finally {
      setSaving(false);
    }
  }, [formName, formParentId, formAvatarUrl, panel, activeDept, loadDepts, closePanel]);

  const handleDelete = useCallback(async (dept) => {
    setRowDeleteConfirm(null);
    try {
      await deleteDepartment(dept.id);
      await loadDepts();
    } catch (err) {
      alert(err?.message ?? "Delete failed.");
    }
  }, [loadDepts]);

  const handleAssignHead = useCallback(async () => {
    if (!selectedHeadId) return;
    setHeadSaving(true);
    try {
      await assignDepartmentHead(activeDept.id, selectedHeadId);
      await loadDepts();
      closePanel();
    } catch (err) {
      alert(err?.message ?? "Assign failed.");
    } finally {
      setHeadSaving(false);
    }
  }, [selectedHeadId, activeDept, loadDepts, closePanel]);

  const handleRemoveHead = useCallback(async () => {
    setHeadSaving(true);
    try {
      await removeDepartmentHead(activeDept.id);
      await loadDepts();
      closePanel();
    } catch (err) {
      alert(err?.message ?? "Remove failed.");
    } finally {
      setHeadSaving(false);
    }
  }, [activeDept, loadDepts, closePanel]);

  const parentOptions = useMemo(() => {
    if (panel !== "edit" || !activeDept) return depts;
    const excluded = new Set([activeDept.id]);
    const addDesc = (id) => depts.forEach(d => {
      if (d.parentDepartmentId === id) { excluded.add(d.id); addDesc(d.id); }
    });
    addDesc(activeDept.id);
    return depts.filter(d => !excluded.has(d.id));
  }, [depts, activeDept, panel]);

  const canDelete = useCallback((dept) => !depts.some(d => d.parentDepartmentId === dept.id), [depts]);


  return (
    <div className="dm-root">
      {/* Toolbar */}
      <div className="dm-toolbar">
        <div className="dm-toolbar-left">
          <h2 className="dm-section-title">Departments</h2>
          <span className="dm-count">{depts.length}</span>
        </div>
        <div className="dm-toolbar-right">
          <div className="dm-search-wrap">
            <svg className="dm-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              className="dm-search-input"
              placeholder="Search departments..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button className="dm-btn dm-btn-primary" onClick={openCreatePanel}>+ New Department</button>
        </div>
      </div>

      {/* Tree */}
      <div className="dm-tree-wrap">
        {loading ? (
          [1, 2, 3].map(i => (
            <div key={i} className="dm-skeleton-row">
              <div className="dm-skeleton-bar" style={{ width: "38%" }} />
              <div className="dm-skeleton-bar" style={{ width: "22%" }} />
            </div>
          ))
        ) : filteredRows.length === 0 ? (
          search ? (
            <div className="dm-empty-msg">No departments match your search.</div>
          ) : (
            <div className="dm-empty-state">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="7" width="20" height="14" rx="2"/>
                <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
              </svg>
              <p>No departments yet.</p>
              <button className="dm-btn dm-btn-primary" onClick={openCreatePanel}>
                → Create your first department
              </button>
            </div>
          )
        ) : (
          filteredRows.map(dept => {
            const level  = getLevel(dept);
            const isLeaf = !hasChildren(dept.id);
            const open   = !collapsed.has(dept.id);
            const isRowDeleteConfirm = rowDeleteConfirm === dept.id;

            return (
              <div key={dept.id}
                className={`dm-dept-row${isRowDeleteConfirm ? " dm-dept-row--confirm" : ""}`}
                style={{ paddingLeft: `${level * 24 + 12}px` }}>

                {/* Expand/collapse chevron */}
                {!isLeaf ? (
                  <button className={`dm-chevron${open ? " dm-chevron--open" : ""}`}
                    onClick={() => toggleCollapse(dept.id)}>▶</button>
                ) : (
                  <span className="dm-chevron-spacer" />
                )}

                {isRowDeleteConfirm ? (
                  <div className="dm-row-delete-confirm">
                    <span>Delete <b>{dept.name}</b>?</span>
                    <button className="dm-delete-yes" onClick={() => handleDelete(dept)}>Yes</button>
                    <button className="dm-delete-no" onClick={() => setRowDeleteConfirm(null)}>No</button>
                  </div>
                ) : (
                  <>
                    {/* Avatar */}
                    <div className="dm-dept-avatar">
                      {dept.avatarUrl ? (
                        <img src={getFileUrl(dept.avatarUrl)} alt={dept.name} />
                      ) : (
                        <div className="dm-dept-avatar-initials" style={{ background: getAvatarColor(dept.name) }}>
                          {dept.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    {/* Name — click to open detail panel */}
                    <span className="dm-dept-name" onClick={() => openDetailPanel(dept)}>
                      {dept.name}
                    </span>
                    <span className="dm-dept-head">
                      {dept.headOfDepartmentId
                        ? `Head: ${dept.headOfDepartmentName}`
                        : <span style={{ color: "#d1d5db" }}>No head</span>}
                    </span>
                    <span className="dm-dept-sub-count">
                      {!isLeaf ? `${depts.filter(d => d.parentDepartmentId === dept.id).length} sub-depts` : ""}
                    </span>

                    {/* Hover actions */}
                    <div className="dm-row-actions">
                      <button className="dm-action-btn" title="Edit"
                        onClick={() => openEditPanel(dept)}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </button>
                      <button
                        className="dm-action-btn delete"
                        title={!canDelete(dept) ? "Cannot delete — has sub-departments" : "Delete"}
                        disabled={!canDelete(dept)}
                        onClick={() => canDelete(dept) && setRowDeleteConfirm(dept.id)}>
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
          <div className="dm-form-overlay" onClick={closePanel} />
          <div className="dm-form-panel">
            <div className="dm-form-header">
              <h3 className="dm-form-title">
                {panel === "create" ? "Create Department" : "Edit Department"}
              </h3>
              <button className="dm-form-close" onClick={closePanel} aria-label="Close">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <form className="dm-form-body" onSubmit={handleSubmit}>
              {/* Avatar upload — yalnız Avatar.Upload permission varsa */}
              {canUploadAvatar && (
                <div className="dm-form-field">
                  <label className="dm-form-label">
                    Department Avatar{panel === "create" && <span className="dm-required"> *</span>}
                  </label>
                  <div className="dm-avatar-upload-area" onClick={() => avatarInputRef.current?.click()}>
                    {avatarPreview ? (
                      <img src={avatarPreview} alt="preview" className="dm-avatar-preview" />
                    ) : (
                      <div className="dm-avatar-placeholder">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="3" width="18" height="18" rx="3"/>
                          <circle cx="8.5" cy="8.5" r="1.5"/>
                          <polyline points="21 15 16 10 5 21"/>
                        </svg>
                        <span>{avatarUploading ? "Uploading…" : "Click to upload"}</span>
                      </div>
                    )}
                  </div>
                  <input ref={avatarInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleAvatarChange} />
                </div>
              )}
              <div className="dm-form-field">
                <label className="dm-form-label dm-form-label--required">Department Name *</label>
                <input
                  className="dm-form-input"
                  placeholder="Enter name..."
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  autoFocus
                />
                {formError && <span className="dm-form-error">{formError}</span>}
              </div>
              <div className="dm-form-field">
                <label className="dm-form-label">Parent Department</label>
                <select
                  className="dm-form-select"
                  value={formParentId}
                  onChange={e => setFormParentId(e.target.value)}
                >
                  <option value="">None (top-level)</option>
                  {parentOptions.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
                <span className="dm-form-hint">ⓘ Leave empty for a root department.</span>
              </div>
              <div className="dm-form-actions">
                <button type="button" className="dm-btn dm-btn-ghost" onClick={closePanel} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" className="dm-btn dm-btn-primary" disabled={saving}>
                  {saving ? <span className="dm-spinner" /> : (panel === "create" ? "Create" : "Save Changes")}
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      {/* Assign Head Panel */}
      {panel === "head" && (
        <>
          <div className="dm-form-overlay" onClick={closePanel} />
          <div className="dm-head-panel">
            <div className="dm-form-header">
              <h3 className="dm-form-title">Assign Head — {activeDept?.name}</h3>
              <button className="dm-form-close" onClick={closePanel} aria-label="Close">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div className="dm-form-body">
              {activeDept?.headOfDepartmentId && (
                <>
                  <div className="dm-form-field">
                    <label className="dm-form-label">Current Head</label>
                    <div className="dm-current-head">
                      <div className="dm-head-avatar"
                        style={{ background: getAvatarColor(activeDept.headOfDepartmentName ?? "") }}>
                        {getInitials(activeDept.headOfDepartmentName ?? "")}
                      </div>
                      <span className="dm-head-name">{activeDept.headOfDepartmentName}</span>
                      <button className="dm-btn-ghost-danger" onClick={handleRemoveHead} disabled={headSaving}>
                        {headSaving ? <span className="dm-spinner dm-spinner--dark" /> : "Remove Head"}
                      </button>
                    </div>
                  </div>
                  <hr className="dm-divider" />
                </>
              )}
              <div className="dm-form-field">
                <label className="dm-form-label">Assign New Head</label>
                <div className="dm-search-wrap dm-head-search">
                  <svg className="dm-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                  <input className="dm-search-input" placeholder="Search users..."
                    value={headSearch} onChange={e => setHeadSearch(e.target.value)} />
                </div>
                <div className="dm-user-pick-list">
                  {usersLoading ? (
                    <div className="dm-empty">Loading...</div>
                  ) : headSearch.trim().length < 2 ? (
                    <div className="dm-empty">Type at least 2 characters to search</div>
                  ) : users.length === 0 ? (
                    <div className="dm-empty">No users found.</div>
                  ) : (
                    users.map(u => {
                      const name = u.fullName ?? `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim();
                      return (
                        <div key={u.id}
                          className={`dm-user-pick-row${selectedHeadId === u.id ? " selected" : ""}`}
                          onClick={() => setSelectedHeadId(u.id)}>
                          <div className="dm-user-avatar-sm" style={{ background: getAvatarColor(name) }}>
                            {getInitials(name)}
                          </div>
                          <div className="dm-user-info-sm">
                            <span>{name}</span>
                            {u.positionName && <span className="dm-user-dept">{u.positionName}</span>}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
              <div className="dm-form-actions">
                <button type="button" className="dm-btn dm-btn-ghost" onClick={closePanel}>Cancel</button>
                <button className="dm-btn dm-btn-primary" onClick={handleAssignHead}
                  disabled={!selectedHeadId || headSaving}>
                  {headSaving ? <span className="dm-spinner" /> : "Assign"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Detail panel */}
      {detailDept && (
        <DeptDetailPanel
          dept={detailDept}
          allDepts={depts}
          closing={detailClosing}
          onClose={closeDetailPanel}
          onDeleted={async () => { closeDetailPanel(); await loadDepts(); }}
          onEdit={openEditPanel}
          onChangeHead={openHeadPanel}
        />
      )}
    </div>
  );
}

export default memo(DepartmentManagement);
