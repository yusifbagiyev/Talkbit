import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  getOrganizationHierarchy, getFileUrl,
  activateUser, deactivateUser, deleteUser,
  createUser, createDepartment, getDepartments, getPositionsByDepartment,
  assignDepartmentHead, removeDepartmentHead, deleteDepartment, updateDepartment, getUsers, searchUsers,
  uploadDepartmentAvatar,
} from "../../services/api";
import { getInitials, getAvatarColor } from "../../utils/chatUtils";
import { useToast } from "../../context/ToastContext";
import "./HierarchyView.css";
import "./DepartmentManagement.css";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function Highlight({ text, query }) {
  if (!query || !text) return text;
  const i = text.toLowerCase().indexOf(query.toLowerCase());
  if (i === -1) return text;
  return (
    <>
      {text.slice(0, i)}
      <mark className="hi-highlight">{text.slice(i, i + query.length)}</mark>
      {text.slice(i + query.length)}
    </>
  );
}

function filterTree(nodes, query) {
  return nodes.reduce((acc, node) => {
    const match = node.name?.toLowerCase().includes(query);
    if (match) {
      // Node özü uyğundursa — bütün children-i olduğu kimi saxla
      acc.push(node);
    } else {
      // Node uyğun deyilsə — uşaqları rekursiv filter et
      const filteredChildren = node.children?.length ? filterTree(node.children, query) : [];
      if (filteredChildren.length > 0)
        acc.push({ ...node, children: filteredChildren });
    }
    return acc;
  }, []);
}

const calcIndent = (level) => (level - 1) * 24 + 16;

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function HierarchySkeleton() {
  return (
    <div className="hi-skeleton">
      {[1, 2].map(i => (
        <div key={i} className="hi-skeleton-company">
          <div className="hi-skeleton-bar" style={{ width: "220px" }} />
          {[1, 2, 3].map(j => (
            <div key={j} className="hi-skeleton-bar"
              style={{ width: `${180 - j * 20}px`, marginLeft: `${j * 12}px` }} />
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── UserDetailPanel ──────────────────────────────────────────────────────────
function UserDetailPanel({ user, companyName, deptName, closing, onClose, onOpenUser }) {
  // Supervisors data hierarchy node-dan gəlir (getUserById-dan deyil)
  const supervisors = user.supervisors ?? [];

  return (
    <>
      <div className="hi-panel-backdrop" onClick={onClose} />
      <div className={`hi-user-detail-panel${closing ? " closing" : ""}`}>
        <div className="hi-detail-hero">
          <button className="hi-detail-hero-close" onClick={onClose}>✕</button>
          <div className={`hi-detail-avatar-wrap${user.isActive ? " active" : ""}`}>
            <div className="hi-detail-avatar"
              style={{ background: user.avatarUrl ? "transparent" : getAvatarColor(user.name) }}>
              {user.avatarUrl
                ? <img src={getFileUrl(user.avatarUrl)} alt="" />
                : getInitials(user.name)}
            </div>
          </div>
          <div className="hi-detail-name">{user.name}</div>
          {user.positionName && <div className="hi-detail-position">{user.positionName}</div>}
          <span className={`hi-detail-role-badge ${(user.role ?? "User").toLowerCase()}`}>
            {user.role ?? "User"}
          </span>
        </div>

        <div className="hi-detail-body">
          {user.email && (
            <div className="hi-detail-section">
              <p className="hi-detail-section-label">Contact</p>
              <div className="hi-detail-info-row">
                <svg className="hi-detail-info-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                  <polyline points="22,6 12,13 2,6"/>
                </svg>
                {user.email}
              </div>
            </div>
          )}

          {(companyName || deptName) && (
            <div className="hi-detail-section">
              <p className="hi-detail-section-label">Organization</p>
              {companyName && (
                <div className="hi-detail-info-row">
                  <svg className="hi-detail-info-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                    <polyline points="9 22 9 12 15 12 15 22"/>
                  </svg>
                  {companyName}
                </div>
              )}
              {deptName && (
                <div className="hi-detail-info-row">
                  <svg className="hi-detail-info-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
                    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                  </svg>
                  {deptName}
                </div>
              )}
            </div>
          )}

          {supervisors.length > 0 && (
            <div className="hi-detail-section">
              <p className="hi-detail-section-label">Supervisors</p>
              {supervisors.map((s, idx) => {
                const name = s.fullName ?? s.name ?? "";
                return (
                  <div key={s.id ?? idx} className="hi-detail-supervisor">
                    <div className="hi-avatar" style={{ background: getAvatarColor(name) }}>
                      {s.avatarUrl
                        ? <img src={getFileUrl(s.avatarUrl)} alt="" />
                        : getInitials(name)}
                    </div>
                    <div>
                      <div style={{ fontWeight: 500, fontSize: "13px" }}>{name}</div>
                      {s.positionName && (
                        <div style={{ fontSize: "11px", color: "var(--gray-400)" }}>{s.positionName}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="hi-detail-footer">
          <button className="hi-btn-primary"
            onClick={() => { onClose(); onOpenUser?.(user.id, user.name); }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            Edit User
          </button>
          <button className="hi-btn-ghost"
            onClick={() => { onClose(); onOpenUser?.(user.id, user.name); }}>
            Reset Password
          </button>
        </div>
      </div>
    </>
  );
}

// ─── DeptDetailPanel ──────────────────────────────────────────────────────────
function DeptDetailPanel({ node, allDepts, closing, onClose, onAfterMutation, onOpenUser }) {
  const [members, setMembers]               = useState(null); // null = loading
  const [deleteConfirm, setDeleteConfirm]   = useState(false);
  const [deleting, setDeleting]             = useState(false);
  const [subPanel, setSubPanel]             = useState(null); // 'edit' | 'head' | null
  const [formName, setFormName]             = useState("");
  const [formParentId, setFormParentId]     = useState("");
  const [formError, setFormError]           = useState("");
  const [saving, setSaving]                 = useState(false);
  const [formAvatarUrl, setFormAvatarUrl]   = useState(null);
  const [avatarPreview, setAvatarPreview]   = useState(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef                      = useRef(null);
  const [allUsers, setAllUsers]             = useState([]);
  const [usersLoading, setUsersLoading]     = useState(false);
  const [headSearch, setHeadSearch]         = useState("");
  const [selectedHeadId, setSelectedHeadId] = useState(null);
  const [headSaving, setHeadSaving]         = useState(false);
  const headDebounce                        = useRef(null);

  useEffect(() => {
    if (!node) return;
    let active = true;
    getUsers({ departmentId: node.id, pageSize: 50 })
      .then(d => { if (active) setMembers(d?.items ?? (Array.isArray(d) ? d : [])); })
      .catch(() => { if (active) setMembers([]); });
    return () => { active = false; };
  }, [node]);

  const subDeptCount = allDepts.filter(d => d.parentDepartmentId === node.id).length;
  const parentDept   = allDepts.find(d => d.id === node.parentDepartmentId);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteDepartment(node.id);
      onClose(); onAfterMutation();
    } catch (err) {
      alert(err.message || "Delete failed.");
      setDeleting(false); setDeleteConfirm(false);
    }
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarPreview(URL.createObjectURL(file));
    setAvatarUploading(true);
    try {
      const result = await uploadDepartmentAvatar(file, node.companyId, node.id);
      setFormAvatarUrl(result.downloadUrl);
    } catch {
      setAvatarPreview(null);
      setFormAvatarUrl(null);
    } finally {
      setAvatarUploading(false);
    }
  };

  const openEdit = () => {
    setFormName(node.name);
    setFormParentId(node.parentDepartmentId ?? "");
    setFormError("");
    setFormAvatarUrl(node.avatarUrl ?? null);
    setAvatarPreview(node.avatarUrl ? getFileUrl(node.avatarUrl) : null);
    setSubPanel("edit");
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    if (!formName.trim()) { setFormError("Name is required."); return; }
    setSaving(true); setFormError("");
    try {
      await updateDepartment(node.id, { name: formName.trim(), parentDepartmentId: formParentId || null, avatarUrl: formAvatarUrl || null });
      setSubPanel(null); onClose(); onAfterMutation();
    } catch (err) {
      setFormError(err?.message ?? "An error occurred.");
    } finally { setSaving(false); }
  };

  // headSearch dəyişdikdə debounce ilə server-side axtarış — min 2 simvol
  useEffect(() => {
    if (subPanel !== "head") return;
    const q = headSearch.trim();
    if (q.length < 2) { setAllUsers([]); return; }
    clearTimeout(headDebounce.current);
    setUsersLoading(true);
    headDebounce.current = setTimeout(() => {
      searchUsers(q)
        .then(d => setAllUsers(d?.items ?? (Array.isArray(d) ? d : [])))
        .catch(() => setAllUsers([]))
        .finally(() => setUsersLoading(false));
    }, 300);
  }, [headSearch, subPanel]);

  const openHead = () => {
    setHeadSearch(""); setSelectedHeadId(null); setAllUsers([]); setSubPanel("head");
  };

  const handleAssignHead = async () => {
    if (!selectedHeadId) return;
    setHeadSaving(true);
    try {
      await assignDepartmentHead(node.id, selectedHeadId);
      setSubPanel(null); onClose(); onAfterMutation();
    } catch (err) {
      alert(err?.message ?? "Assign failed.");
    } finally { setHeadSaving(false); }
  };

  const handleRemoveHead = async () => {
    setHeadSaving(true);
    try {
      await removeDepartmentHead(node.id);
      setSubPanel(null); onClose(); onAfterMutation();
    } catch (err) {
      alert(err?.message ?? "Remove failed.");
    } finally { setHeadSaving(false); }
  };


  const parentOptions = allDepts.filter(d => d.id !== node.id);

  const CloseIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );

  return (
    <>
      <div className="hi-panel-backdrop" onClick={onClose} />
      <div className={`hi-dept-detail-panel${closing ? " closing" : ""}`}>

        <div className="hi-dept-detail-hero">
          <button className="hi-detail-hero-close" onClick={onClose}>✕</button>
          <div className="hi-dept-detail-avatar-wrap">
            {node.avatarUrl ? (
              <img src={getFileUrl(node.avatarUrl)} alt="" className="hi-dept-detail-avatar-img" />
            ) : (
              <div className="hi-dept-detail-avatar-icon">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="7" width="20" height="14" rx="2"/>
                  <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
                </svg>
              </div>
            )}
          </div>
          <div className="hi-dept-detail-name">{node.name}</div>
          {parentDept && <div className="hi-dept-detail-parent">↳ {parentDept.name}</div>}
        </div>

        <div className="hi-dept-detail-body">
          <div className="hi-detail-section">
            <p className="hi-detail-section-label">Head of Department</p>
            {node.headOfDepartmentId ? (
              <div className="hi-detail-supervisor">
                <div className="hi-dept-head-avatar" style={{ background: getAvatarColor(node.headOfDepartmentName ?? "") }}>
                  {getInitials(node.headOfDepartmentName ?? "")}
                </div>
                <span style={{ flex: 1, fontWeight: 500, fontSize: "13px" }}>{node.headOfDepartmentName}</span>
                <button className="hi-change-head-btn" onClick={openHead}>Change</button>
              </div>
            ) : (
              <div className="hi-detail-supervisor">
                <span style={{ flex: 1, fontSize: "13px", color: "#9ca3af", fontStyle: "italic" }}>No head assigned</span>
                <button className="hi-change-head-btn" onClick={openHead}>Assign</button>
              </div>
            )}
          </div>

          <div className="hi-detail-section">
            <p className="hi-detail-section-label">Overview</p>
            <div className="hi-dept-stats">
              <div className="hi-dept-stat-card">
                <div className="hi-dept-stat-num">{members.length}</div>
                <div className="hi-dept-stat-label">Members</div>
              </div>
              <div className="hi-dept-stat-card">
                <div className="hi-dept-stat-num">{subDeptCount}</div>
                <div className="hi-dept-stat-label">Sub-depts</div>
              </div>
            </div>
          </div>

          {(members === null || members.length > 0) && (
            <div className="hi-detail-section">
              <p className="hi-detail-section-label">Members</p>
              {members === null ? (
                <div style={{ fontSize: "13px", color: "#9ca3af" }}>Loading...</div>
              ) : members.map(m => {
                const mName = m.fullName ?? `${m.firstName ?? ""} ${m.lastName ?? ""}`.trim();
                return (
                  <div key={m.id} className="hi-dept-member"
                    style={onOpenUser ? { cursor: "pointer" } : undefined}
                    onClick={() => onOpenUser?.(m.id, mName)}>
                    <div className="hi-dept-member-avatar" style={{ background: getAvatarColor(mName) }}>
                      {getInitials(mName)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500, fontSize: "13px" }}>{mName}</div>
                      {(m.position ?? m.positionName) && (
                        <div style={{ fontSize: "11px", color: "#6b7280" }}>{m.position ?? m.positionName}</div>
                      )}
                    </div>
                    {m.id === node.headOfDepartmentId && <span className="hi-head-badge">HEAD</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="hi-dept-detail-footer">
          <button className="hi-btn-primary" onClick={openEdit}>Edit Department</button>
          <button className="delete-btn" onClick={() => setDeleteConfirm(true)}>Delete</button>
        </div>
      </div>

      {deleteConfirm && (
        <>
          <div className="dm-modal-backdrop" onClick={() => !deleting && setDeleteConfirm(false)} />
          <div className="dm-modal">
            <div className="dm-modal-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                <path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
              </svg>
            </div>
            <h3 className="dm-modal-title">Delete Department</h3>
            <p className="dm-modal-desc">Are you sure you want to delete <strong>{node.name}</strong>? This action cannot be undone.</p>
            <div className="dm-modal-actions">
              <button className="dm-btn dm-btn-ghost" onClick={() => setDeleteConfirm(false)} disabled={deleting}>Cancel</button>
              <button className="dm-btn dm-btn-danger" onClick={handleDelete} disabled={deleting}>
                {deleting ? "Deleting..." : "Yes, Delete"}
              </button>
            </div>
          </div>
        </>
      )}

      {subPanel === "edit" && (
        <>
          <div className="dm-form-overlay" onClick={() => setSubPanel(null)} />
          <div className="dm-form-panel">
            <div className="dm-form-header">
              <h3 className="dm-form-title">Edit Department</h3>
              <button className="dm-form-close" onClick={() => setSubPanel(null)} aria-label="Close"><CloseIcon /></button>
            </div>
            <form className="dm-form-body" onSubmit={handleEdit}>
              <div className="dm-form-field">
                <label className="dm-form-label">Department Avatar</label>
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
              <div className="dm-form-field">
                <label className="dm-form-label dm-form-label--required">Department Name *</label>
                <input className="dm-form-input" value={formName} onChange={e => setFormName(e.target.value)} autoFocus />
                {formError && <span className="dm-form-error">{formError}</span>}
              </div>
              <div className="dm-form-field">
                <label className="dm-form-label">Parent Department</label>
                <select className="dm-form-select" value={formParentId} onChange={e => setFormParentId(e.target.value)}>
                  <option value="">None (top-level)</option>
                  {parentOptions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                <span className="dm-form-hint">ⓘ Leave empty for a root department.</span>
              </div>
              <div className="dm-form-actions">
                <button type="button" className="dm-btn dm-btn-ghost" onClick={() => setSubPanel(null)} disabled={saving}>Cancel</button>
                <button type="submit" className="dm-btn dm-btn-primary" disabled={saving}>
                  {saving ? <span className="dm-spinner" /> : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      {subPanel === "head" && (
        <>
          <div className="dm-form-overlay" onClick={() => setSubPanel(null)} />
          <div className="dm-head-panel">
            <div className="dm-form-header">
              <h3 className="dm-form-title">Assign Head — {node.name}</h3>
              <button className="dm-form-close" onClick={() => setSubPanel(null)} aria-label="Close"><CloseIcon /></button>
            </div>
            <div className="dm-form-body">
              {node.headOfDepartmentId && (
                <>
                  <div className="dm-form-field">
                    <label className="dm-form-label">Current Head</label>
                    <div className="dm-current-head">
                      <div className="dm-head-avatar" style={{ background: getAvatarColor(node.headOfDepartmentName ?? "") }}>
                        {getInitials(node.headOfDepartmentName ?? "")}
                      </div>
                      <span className="dm-head-name">{node.headOfDepartmentName}</span>
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
                  ) : allUsers.length === 0 ? (
                    <div className="dm-empty">No users found.</div>
                  ) : allUsers.map(u => {
                    const n = u.fullName ?? `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim();
                    return (
                      <div key={u.id}
                        className={`dm-user-pick-row${selectedHeadId === u.id ? " selected" : ""}`}
                        onClick={() => setSelectedHeadId(u.id)}>
                        <div className="dm-user-avatar-sm" style={{ background: getAvatarColor(n) }}>
                          {getInitials(n)}
                        </div>
                        <div className="dm-user-info-sm">
                          <span>{n}</span>
                          {(u.position ?? u.positionName) && (
                            <span className="dm-user-dept">{u.position ?? u.positionName}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="dm-form-actions">
                <button type="button" className="dm-btn dm-btn-ghost" onClick={() => setSubPanel(null)}>Cancel</button>
                <button className="dm-btn dm-btn-primary" onClick={handleAssignHead} disabled={!selectedHeadId || headSaving}>
                  {headSaving ? <span className="dm-spinner" /> : "Assign"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}

// ─── CreateUserPanel ──────────────────────────────────────────────────────────
function CreateUserPanel({ isSuperAdmin, preloadedDepts = null, defaultDeptId = "", contextLabel = null, onSave, onClose }) {
  const { showToast } = useToast();
  const [firstName, setFirstName]       = useState("");
  const [lastName, setLastName]         = useState("");
  const [email, setEmail]               = useState("");
  const [password, setPassword]         = useState("");
  const [role, setRole]                 = useState("User");
  const [deptId, setDeptId]             = useState(defaultDeptId);
  const [posId, setPosId]               = useState("");
  const [depts, setDepts]               = useState(preloadedDepts ?? []);
  const [deptsLoading, setDeptsLoading] = useState(preloadedDepts === null);
  const [positions, setPositions]       = useState([]);
  const [saving, setSaving]             = useState(false);

  useEffect(() => {
    if (preloadedDepts !== null) { setDepts(preloadedDepts); setDeptsLoading(false); return; }
    setDeptsLoading(true);
    getDepartments()
      .then(d => setDepts(Array.isArray(d) ? d : []))
      .catch(() => setDepts([]))
      .finally(() => setDeptsLoading(false));
  }, [preloadedDepts]);
  useEffect(() => {
    if (!deptId) { setPositions([]); return; }
    getPositionsByDepartment(deptId).then(setPositions).catch(() => {});
  }, [deptId]);

  // Backend Role enum integer dəyərləri
  const ROLE_VALUES = { User: 0, Admin: 1, SuperAdmin: 2 };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password.trim()) {
      showToast("First name, last name, email and password are required", "error");
      return;
    }
    if (!deptId) {
      showToast("Department is required", "error");
      return;
    }
    if (password.length < 8)             { showToast("Password: minimum 8 characters", "error"); return; }
    if (!/[A-Z]/.test(password))         { showToast("Password: must contain uppercase letter", "error"); return; }
    if (!/[a-z]/.test(password))         { showToast("Password: must contain lowercase letter", "error"); return; }
    if (!/[0-9]/.test(password))         { showToast("Password: must contain a number", "error"); return; }
    if (!/[^a-zA-Z0-9]/.test(password))  { showToast("Password: must contain a special character", "error"); return; }
    setSaving(true);
    try {
      await createUser({
        firstName: firstName.trim(), lastName: lastName.trim(),
        email: email.trim(), password,
        role: ROLE_VALUES[role] ?? 0,
        departmentId: deptId,
        ...(posId ? { positionId: posId } : {}),
      });
      showToast("User created", "success");
      onSave();
    } catch (err) {
      showToast(err.message || "Failed to create user", "error");
    } finally {
      setSaving(false);
    }
  };

  const roleOptions = isSuperAdmin ? ["User", "Admin"] : ["User"];
  const noDepts = !deptsLoading && depts.length === 0;

  return (
    <>
      <div className="hi-panel-backdrop" onClick={onClose} />
      <div className="hi-create-panel">
        <div className="hi-create-panel-header">
          <div>
            <span className="hi-create-panel-title">New User</span>
            {contextLabel && <div className="hi-create-context-label">{contextLabel}</div>}
          </div>
          <button className="hi-create-panel-close" onClick={onClose}>✕</button>
        </div>
        {noDepts ? (
          <div className="hi-no-depts-notice">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="7" width="6" height="14" rx="1"/>
              <rect x="9" y="3" width="6" height="18" rx="1"/>
              <rect x="16" y="11" width="6" height="10" rx="1"/>
            </svg>
            <p className="hi-no-depts-title">No departments found</p>
            <p className="hi-no-depts-desc">Please create a department first before adding users to this company.</p>
          </div>
        ) : (
          <form id="cu-form" className="hi-create-panel-body" onSubmit={handleSubmit}>
            <div className="hi-form-row">
              <div className="hi-form-field">
                <label className="hi-form-label">First Name *</label>
                <input className="hi-form-input" value={firstName}
                  onChange={e => setFirstName(e.target.value)} placeholder="First name" autoFocus />
              </div>
              <div className="hi-form-field">
                <label className="hi-form-label">Last Name *</label>
                <input className="hi-form-input" value={lastName}
                  onChange={e => setLastName(e.target.value)} placeholder="Last name" />
              </div>
            </div>
            <div className="hi-form-field">
              <label className="hi-form-label">Email *</label>
              <input className="hi-form-input" type="email" value={email}
                onChange={e => setEmail(e.target.value)} placeholder="user@company.com" />
            </div>
            <div className="hi-form-field">
              <label className="hi-form-label">Password *</label>
              <input className="hi-form-input" type="password" value={password}
                onChange={e => setPassword(e.target.value)} placeholder="Min. 6 characters" />
            </div>
            {isSuperAdmin && (
              <div className="hi-form-field">
                <label className="hi-form-label">Role</label>
                <select className="hi-form-select" value={role} onChange={e => setRole(e.target.value)}>
                  {roleOptions.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            )}
            <div className="hi-form-row">
              <div className="hi-form-field">
                <label className="hi-form-label">Department</label>
                <select className="hi-form-select" value={deptId}
                  onChange={e => { setDeptId(e.target.value); setPosId(""); }}
                  disabled={deptsLoading}>
                  <option value="">{deptsLoading ? "Loading..." : "— Select —"}</option>
                  {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div className="hi-form-field">
                <label className="hi-form-label">Position</label>
                <select className="hi-form-select" value={posId}
                  onChange={e => setPosId(e.target.value)} disabled={!deptId}>
                  <option value="">— Select —</option>
                  {positions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>
          </form>
        )}
        <div className="hi-create-panel-footer">
          <button type="button" className="hi-btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          {!noDepts && (
            <button type="submit" form="cu-form" className="hi-btn-primary" disabled={saving || deptsLoading}>
              {saving ? "Creating..." : "Create User"}
            </button>
          )}
        </div>
      </div>
    </>
  );
}

// ─── CreateDeptPanel ──────────────────────────────────────────────────────────
function CreateDeptPanel({ preloadedDepts = null, companyId = null, defaultParentId = "", contextLabel = null, onSave, onClose }) {
  const { showToast } = useToast();
  const [name, setName]         = useState("");
  const [parentId, setParentId] = useState(defaultParentId);
  const [depts, setDepts]       = useState(preloadedDepts ?? []);
  const [saving, setSaving]     = useState(false);
  const [avatarUrl, setAvatarUrl]           = useState(null);
  const [avatarPreview, setAvatarPreview]   = useState(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarRef                            = useRef(null);

  useEffect(() => {
    if (preloadedDepts !== null) { setDepts(preloadedDepts); return; }
    getDepartments().then(d => setDepts(Array.isArray(d) ? d : [])).catch(() => {});
  }, [preloadedDepts]);

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarPreview(URL.createObjectURL(file));
    setAvatarUploading(true);
    try {
      const result = await uploadDepartmentAvatar(file, companyId);
      setAvatarUrl(result.downloadUrl);
    } catch {
      setAvatarPreview(null);
      setAvatarUrl(null);
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) { showToast("Department name is required", "error"); return; }
    if (!avatarUrl) { showToast("Department avatar is required", "error"); return; }
    setSaving(true);
    try {
      await createDepartment({ name: name.trim(), parentDepartmentId: parentId || null, companyId: companyId || null, avatarUrl });
      showToast("Department created", "success");
      onSave();
    } catch (err) {
      showToast(err.message || "Failed to create department", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="hi-panel-backdrop" onClick={onClose} />
      <div className="hi-create-panel">
        <div className="hi-create-panel-header">
          <div>
            <span className="hi-create-panel-title">New Department</span>
            {contextLabel && <div className="hi-create-context-label">{contextLabel}</div>}
          </div>
          <button className="hi-create-panel-close" onClick={onClose}>✕</button>
        </div>
        <form id="cd-form" className="hi-create-panel-body" onSubmit={handleSubmit}>
          <div className="hi-form-field">
            <label className="hi-form-label">Department Avatar *</label>
            <div className="dm-avatar-upload-area" onClick={() => avatarRef.current?.click()}>
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
            <input ref={avatarRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleAvatarChange} />
          </div>
          <div className="hi-form-field">
            <label className="hi-form-label">Department Name *</label>
            <input className="hi-form-input" value={name}
              onChange={e => setName(e.target.value)} placeholder="Enter name..." autoFocus />
          </div>
          <div className="hi-form-field">
            <label className="hi-form-label">Parent Department</label>
            <select className="hi-form-select" value={parentId} onChange={e => setParentId(e.target.value)}>
              <option value="">None (top-level)</option>
              {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
        </form>
        <div className="hi-create-panel-footer">
          <button type="button" className="hi-btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" form="cd-form" className="hi-btn-primary" disabled={saving || avatarUploading}>
            {saving ? "Creating..." : "Create Department"}
          </button>
        </div>
      </div>
    </>
  );
}

// ─── HierarchyView ────────────────────────────────────────────────────────────
function HierarchyView({ isSuperAdmin, onOpenUser }) {
  const [tree, setTree]               = useState([]);
  const [loading, setLoading]         = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch]           = useState("");
  const [expanded, setExpanded]       = useState(new Set()); // default collapsed
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [panel, setPanel]             = useState(null); // { type:"user"|"dept", data, extra }
  const [panelClosing, setPanelClosing] = useState(false);
  const [nodeOverrides, setNodeOverrides] = useState({}); // { [id]: partial overrides }
  const [deletingIds, setDeletingIds] = useState(new Set());
  const [deletedIds, setDeletedIds]   = useState(new Set());
  const [createPanel, setCreatePanel] = useState(null); // null | { type:'user', deptId?, deptName? } | { type:'dept', parentId?, parentName? }

  const loadHierarchy = useCallback(() => {
    setLoading(true);
    // Logo hierarchy response-un içindədir (AvatarUrl: company.LogoUrl) — ayrıca getCompanies() lazım deyil
    getOrganizationHierarchy()
      .then(nodes => setTree(nodes ?? []))
      .finally(() => setLoading(false));
  }, []);

  // İlk yükləmə — loading artıq true-dur, birbaşa fetch edirik
  useEffect(() => {
    getOrganizationHierarchy()
      .then(nodes => setTree(nodes ?? []))
      .finally(() => setLoading(false));
  }, []);

  // Node altındakı bütün User-ləri rekursiv say
  const countUsers = (node) => {
    if (node.type === "User") return 1;
    return (node.children ?? []).reduce((sum, c) => sum + countUsers(c), 0);
  };

  // Node altındakı online User-ləri rekursiv say
  const countOnlineUsers = (node) => {
    if (node.type === "User") return node.isOnline ? 1 : 0;
    return (node.children ?? []).reduce((sum, c) => sum + countOnlineUsers(c), 0);
  };

  // Hierarchy tree-dən bütün department node-larını düzləndirilmiş siyahıya çevir (companyId ilə)
  const allDeptNodes = useMemo(() => {
    const result = [];
    function walk(n, cid) {
      if (n.type === "Company") (n.children ?? []).forEach(c => walk(c, n.id));
      else if (n.type === "Department") {
        result.push({ ...n, companyId: cid });
        (n.children ?? []).forEach(c => walk(c, cid));
      }
    }
    tree.forEach(n => walk(n, null));
    return result;
  }, [tree]);

  // companyId-ə görə department-ları tree-dən götür (API çağırışı lazım deyil)
  const getDeptsByCompany = useCallback((companyId) =>
    companyId ? allDeptNodes.filter(d => d.companyId === companyId) : allDeptNodes,
  [allDeptNodes]);

  // Bütün user node-larını düz siyahıya çevir
  const allUserNodes = useMemo(() => {
    const result = [];
    function walk(n) {
      if (n.type === "User") result.push(n);
      else (n.children ?? []).forEach(walk);
    }
    tree.forEach(walk);
    return result;
  }, [tree]);

  const stats = useMemo(() => ({
    total:    allUserNodes.length,
    online:   allUserNodes.filter(u => u.isOnline).length,
    active:   allUserNodes.filter(u => u.isActive).length,
    inactive: allUserNodes.filter(u => !u.isActive).length,
  }), [allUserNodes]);

  // 300ms debounce
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim().toLowerCase()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const toggle = useCallback((id) => {
    setExpanded(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  }, []);

  const isExpanded = (id) => search ? true : expanded.has(id);

  // Bütün company + department id-lərini topla
  const expandAll = useCallback(() => {
    const ids = new Set();
    function walk(node) {
      if (node.type === "User") return;
      ids.add(node.id);
      (node.children ?? []).forEach(walk);
    }
    tree.forEach(walk);
    setExpanded(ids);
  }, [tree]);

  const collapseAll = useCallback(() => setExpanded(new Set()), []);

  // ─── Panel ─────────────────────────────────────────────────────────────────
  const openPanel = useCallback((type, data, extra = {}) => {
    setPanel({ type, data, extra });
    setPanelClosing(false);
  }, []);

  const closePanel = useCallback(() => {
    setPanelClosing(true);
    setTimeout(() => { setPanel(null); setPanelClosing(false); }, 200);
  }, []);

  // ─── Partial Updates ───────────────────────────────────────────────────────
  const handleToggle = useCallback(async (userId, currentIsActive) => {
    setNodeOverrides(prev => ({ ...prev, [userId]: { ...prev[userId], isActive: !currentIsActive } }));
    try {
      currentIsActive ? await deactivateUser(userId) : await activateUser(userId);
    } catch {
      setNodeOverrides(prev => ({ ...prev, [userId]: { ...prev[userId], isActive: currentIsActive } }));
    }
  }, []);

  const handleDeleteConfirm = useCallback(async (userId) => {
    setDeleteConfirm(null);
    setDeletingIds(prev => new Set(prev).add(userId));
    try {
      await deleteUser(userId);
      setTimeout(() => {
        setDeletingIds(prev => { const s = new Set(prev); s.delete(userId); return s; });
        setDeletedIds(prev => new Set(prev).add(userId));
      }, 320);
    } catch {
      setDeletingIds(prev => { const s = new Set(prev); s.delete(userId); return s; });
    }
  }, []);

  const getNodeData = (node) => {
    const ov = nodeOverrides[node.id];
    return ov ? { ...node, ...ov } : node;
  };

  // ─── User Row ──────────────────────────────────────────────────────────────
  const renderUserRow = (node, companyName, deptName) => {
    if (deletedIds.has(node.id)) return null;
    const data = getNodeData(node);
    const isDeleting  = deletingIds.has(node.id);
    const isDeleteConf = deleteConfirm === node.id;
    const rowClass = [
      "hi-user-row",
      data.isDepartmentHead ? "hi-user-row--head" : "",
      !data.isActive        ? "hi-user-row--inactive" : "",
      isDeleting            ? "removing" : "",
    ].filter(Boolean).join(" ");

    if (isDeleteConf) {
      return (
        <div key={node.id} className="hi-user-row"
          style={{ paddingLeft: `${calcIndent(node.level)}px` }}>
          <div className="hi-delete-confirm">
            <span className="hi-delete-label">Delete {data.name}?</span>
            <button className="hi-delete-yes" onClick={() => handleDeleteConfirm(node.id)}>
              Yes, delete
            </button>
            <button className="hi-delete-cancel" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </button>
          </div>
        </div>
      );
    }

    return (
      <div key={node.id} className={rowClass}
        style={{ paddingLeft: `${calcIndent(node.level)}px` }}>
        {/* Avatar */}
        <div className="hi-avatar"
          style={{ background: data.avatarUrl ? "transparent" : getAvatarColor(data.name) }}>
          {data.avatarUrl
            ? <img src={getFileUrl(data.avatarUrl)} alt="" />
            : getInitials(data.name)}
        </div>

        {/* Info */}
        <div className="hi-user-info">
          <span className="hi-user-name"
            onClick={() => onOpenUser ? onOpenUser(node.id, data.name) : openPanel("user", data, { companyName, deptName })}>
            <Highlight text={data.name} query={search} />
          </span>
          {data.positionName && <span className="hi-user-position">{data.positionName}</span>}
        </div>

        {/* Badges */}
        {data.role && (
          <span className={`hi-role-badge ${data.role.toLowerCase()}`}>{data.role}</span>
        )}

        {/* Actions toolbar */}
        <div className="hi-actions">
          {/* Toggle active/inactive */}
          <button
            className={`hi-action-btn toggle ${data.isActive ? "is-active" : "is-inactive"}`}
            title={data.isActive ? "Deactivate" : "Activate"}
            onClick={(e) => { e.stopPropagation(); handleToggle(node.id, data.isActive); }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18.36 6.64a9 9 0 1 1-12.73 0"/>
              <line x1="12" y1="2" x2="12" y2="12"/>
            </svg>
          </button>

          {/* Delete */}
          <button className="hi-action-btn delete" title="Delete user"
            onClick={(e) => { e.stopPropagation(); setDeleteConfirm(node.id); }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              <path d="M10 11v6M14 11v6"/>
              <path d="M9 6V4h6v2"/>
            </svg>
          </button>

          {/* Open detail → */}
          <button className="hi-action-btn arrow" title="View details"
            onClick={(e) => { e.stopPropagation(); onOpenUser ? onOpenUser(node.id, data.name) : openPanel("user", data, { companyName, deptName }); }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"/>
              <polyline points="12 5 19 12 12 19"/>
            </svg>
          </button>
        </div>
      </div>
    );
  };

  // ─── Dept Node ─────────────────────────────────────────────────────────────
  const renderDeptNode = (node, companyId, companyName, parentDeptName = null) => {
    const expanded  = isExpanded(node.id);
    const subDepts  = node.children?.filter(n => n.type === "Department") ?? [];
    const deptUsers = node.children?.filter(n => n.type === "User") ?? [];
    const hasAny    = subDepts.length + deptUsers.length > 0;

    return (
      <div key={node.id}>
        <div
          className="hi-dept-node"
          style={{ paddingLeft: `${calcIndent(node.level)}px`, cursor: hasAny ? "pointer" : "default" }}
          onClick={() => hasAny && toggle(node.id)}
        >
          {hasAny
            ? <span className={`hi-chevron${expanded ? " hi-chevron--open" : ""}`}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </span>
            : <span className="hi-chevron-spacer" />}
          <span className="hi-dept-icon">
            {node.avatarUrl ? (
              <img src={getFileUrl(node.avatarUrl)} alt="" className="hi-dept-avatar-img" />
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="7" width="6" height="14" rx="1"/>
                <rect x="9" y="3" width="6" height="18" rx="1"/>
                <rect x="16" y="11" width="6" height="10" rx="1"/>
              </svg>
            )}
          </span>
          <span className="hi-dept-name"><Highlight text={node.name} query={search} /></span>
          <div className="hi-dept-actions" onClick={e => e.stopPropagation()}>
            <button className="hi-dept-add-btn hi-dept-add-btn--user"
              onClick={e => { e.stopPropagation(); setCreatePanel({ type: "user", companyId, deptId: node.id, deptName: node.name }); }}
              title="New User">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <line x1="19" y1="8" x2="19" y2="14"/>
                <line x1="16" y1="11" x2="22" y2="11"/>
              </svg>
            </button>
            <button className="hi-dept-add-btn hi-dept-add-btn--dept"
              onClick={e => { e.stopPropagation(); setCreatePanel({ type: "dept", companyId, parentId: node.id, parentName: node.name }); }}
              title="New Sub-department">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <line x1="12" y1="6" x2="12" y2="12"/>
                <line x1="9" y1="9" x2="15" y2="9"/>
              </svg>
            </button>
            <button className="hi-dept-detail-btn" title="View department details"
              onClick={e => { e.stopPropagation(); openPanel("dept", node, { parentDeptName }); }}>
              ›
            </button>
          </div>
        </div>
        {expanded && hasAny && (
          <>
            {subDepts.map(d => renderDeptNode(d, companyId, companyName, node.name))}
            {deptUsers.map(u => renderUserRow(u, companyName, node.name))}
          </>
        )}
      </div>
    );
  };

  // ─── Company Node ──────────────────────────────────────────────────────────
  const renderCompanyNode = (node) => {
    const expanded    = isExpanded(node.id);
    const depts       = node.children?.filter(n => n.type === "Department") ?? [];
    const noDeptUsers = node.children?.filter(n => n.type === "User") ?? [];
    const totalUsers   = (node.children ?? []).reduce((sum, c) => sum + countUsers(c), 0);
    const onlineUsers  = (node.children ?? []).reduce((sum, c) => sum + countOnlineUsers(c), 0);

    return (
      <div key={node.id} className={`hi-company-node${expanded ? " hi-expanded" : ""}`}>
        <div className="hi-company-header" onClick={() => toggle(node.id)}>
          <span className={`hi-chevron${expanded ? " hi-chevron--open" : ""}`}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </span>
          <div className="hi-company-logo"
            style={{ background: node.avatarUrl ? "transparent" : getAvatarColor(node.name) }}>
            {node.avatarUrl
              ? <img src={getFileUrl(node.avatarUrl)} alt="" />
              : getInitials(node.name)}
          </div>
          <span className="hi-company-name"><Highlight text={node.name} query={search} /></span>
          {node.headOfDepartmentName && (
            <span className="hi-company-head">Head: {node.headOfDepartmentName}</span>
          )}
          <span className="hi-company-count">{totalUsers} users</span>
          {onlineUsers > 0 && (
            <span className="hi-company-online">{onlineUsers} online</span>
          )}
          <div className="hi-company-actions" onClick={e => e.stopPropagation()}>
            {/* New User */}
            <button className="hi-company-add-btn"
              onClick={e => { e.stopPropagation(); setCreatePanel({ type: "user", companyId: node.id, deptName: node.name }); }}
              title="New User">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <line x1="19" y1="8" x2="19" y2="14"/>
                <line x1="16" y1="11" x2="22" y2="11"/>
              </svg>
            </button>
            {/* New Department */}
            <button className="hi-company-add-btn hi-company-add-btn--dept"
              onClick={e => { e.stopPropagation(); setCreatePanel({ type: "dept", companyId: node.id }); }}
              title="New Department">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <line x1="12" y1="6" x2="12" y2="12"/>
                <line x1="9" y1="9" x2="15" y2="9"/>
              </svg>
            </button>
          </div>
        </div>
        {expanded && (depts.length > 0 || noDeptUsers.length > 0) && (
          <div className="hi-company-children">
            {depts.map(d => renderDeptNode(d, node.id, node.name, null))}
            {noDeptUsers.length > 0 && (
              <>
                <div className="hi-no-dept-header">(No department)</div>
                {noDeptUsers.map(u => renderUserRow(u, node.name, null))}
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  // ─── Content ───────────────────────────────────────────────────────────────
  const adminCompany = !isSuperAdmin ? (tree[0] ?? null) : null;
  let content;

  if (loading) {
    content = <HierarchySkeleton />;
  } else if (isSuperAdmin) {
    const visible = search ? filterTree(tree, search) : tree;
    content = visible.length === 0
      ? <div className="hi-empty">No users found.</div>
      : visible.map(renderCompanyNode);
  } else {
    const allDepts    = adminCompany?.children?.filter(n => n.type === "Department") ?? [];
    const noDeptUsers = adminCompany?.children?.filter(n => n.type === "User") ?? [];
    const visDepts    = search ? filterTree(allDepts, search) : allDepts;
    const visNoDept   = search
      ? noDeptUsers.filter(u => u.name?.toLowerCase().includes(search))
      : noDeptUsers;

    if (visDepts.length === 0 && visNoDept.length === 0) {
      content = <div className="hi-empty">{search ? "No users found." : "No departments found."}</div>;
    } else {
      content = (
        <>
          {visDepts.map(d => renderDeptNode(d, adminCompany?.id, adminCompany?.name, null))}
          {visNoDept.length > 0 && (
            <>
              <div className="hi-no-dept-header">(No department)</div>
              {visNoDept.map(u => renderUserRow(u, adminCompany?.name, null))}
            </>
          )}
        </>
      );
    }
  }

  return (
    <div className="hi-root">
      {/* Toolbar */}
      <div className="hi-toolbar">
        <div className="hi-title-wrap">
          <h2 className="hi-title">
            {isSuperAdmin ? "Users" : `Users${adminCompany ? ` — ${adminCompany.name}` : ""}`}
          </h2>
          {!isSuperAdmin && adminCompany && (
            <span className="hi-count-badge">{adminCompany.userCount ?? 0}</span>
          )}
          <div className="hi-expand-controls">
            <button className="hi-expand-btn" onClick={expandAll} title="Expand all">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="7 13 12 18 17 13"/><polyline points="7 6 12 11 17 6"/>
              </svg>
            </button>
            <button className="hi-expand-btn" onClick={collapseAll} title="Collapse all">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="17 11 12 6 7 11"/><polyline points="17 18 12 13 7 18"/>
              </svg>
            </button>
          </div>
        </div>
        <div className="hi-search-wrap">
          <svg className="hi-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            className="hi-search-input"
            placeholder="Search users, departments..."
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
          />
          <span className="hi-search-shortcut">⌘K</span>
        </div>
      </div>

      {/* Stats row */}
      {!loading && stats.total > 0 && (
        <div className="hi-stats-row">
          <div className="hi-stat-item">
            <span className="hi-stat-value">{stats.total}</span>
            <span className="hi-stat-label">Total</span>
          </div>
          <div className="hi-stat-divider" />
          <div className="hi-stat-item hi-stat-item--online">
            <span className="hi-stat-dot" />
            <span className="hi-stat-value">{stats.online}</span>
            <span className="hi-stat-label">Online</span>
          </div>
          <div className="hi-stat-divider" />
          <div className="hi-stat-item hi-stat-item--active">
            <span className="hi-stat-value">{stats.active}</span>
            <span className="hi-stat-label">Active</span>
          </div>
          <div className="hi-stat-divider" />
          <div className="hi-stat-item hi-stat-item--inactive">
            <span className="hi-stat-value">{stats.inactive}</span>
            <span className="hi-stat-label">Inactive</span>
          </div>
        </div>
      )}

      {/* Tree */}
      <div className="hi-tree">{content}</div>

      {/* Detail panels */}
      {panel?.type === "user" && (
        <UserDetailPanel
          user={panel.data}
          companyName={panel.extra.companyName}
          deptName={panel.extra.deptName}
          closing={panelClosing}
          onClose={closePanel}
          onOpenUser={onOpenUser}
        />
      )}
      {panel?.type === "dept" && (
        <DeptDetailPanel
          node={panel.data}
          allDepts={allDeptNodes}
          closing={panelClosing}
          onClose={closePanel}
          onAfterMutation={loadHierarchy}
          onOpenUser={onOpenUser}
        />
      )}

      {/* Create panels */}
      {createPanel?.type === "user" && (
        <CreateUserPanel
          isSuperAdmin={isSuperAdmin}
          preloadedDepts={getDeptsByCompany(createPanel.companyId)}
          defaultDeptId={createPanel.deptId ?? ""}
          contextLabel={createPanel.deptName ? `→ ${createPanel.deptName}` : null}
          onSave={() => { setCreatePanel(null); loadHierarchy(); }}
          onClose={() => setCreatePanel(null)}
        />
      )}
      {createPanel?.type === "dept" && (
        <CreateDeptPanel
          preloadedDepts={getDeptsByCompany(createPanel.companyId)}
          companyId={createPanel.companyId ?? null}
          defaultParentId={createPanel.parentId ?? ""}
          contextLabel={createPanel.parentName ? `Sub-dept of ${createPanel.parentName}` : null}
          onSave={() => { setCreatePanel(null); loadHierarchy(); }}
          onClose={() => setCreatePanel(null)}
        />
      )}
    </div>
  );
}

export default HierarchyView;
