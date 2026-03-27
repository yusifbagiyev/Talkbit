import { useState, useEffect, useCallback, useRef } from "react";
import {
  getUserById, getUserStorageStats, getAllPermissions,
  addSupervisor, removeSupervisor,
  getDepartments, assignEmployeeToDepartment, removeUserFromDepartment,
  getUsers, searchUsers, activateUser, deactivateUser, adminChangePassword,
  assignPermission, removePermission, updateUser, deleteUser,
  getFileUrl,
} from "../../services/api";
import { getInitials, getAvatarColor } from "../../utils/chatUtils";
import { useToast } from "../../context/ToastContext";
import "./UserDetailPage.css";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatRelativeTime(dateStr) {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const sec  = Math.floor(diff / 1000);
  if (sec < 60)  return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60)  return `${min} minute${min !== 1 ? "s" : ""} ago`;
  const hr  = Math.floor(min / 60);
  if (hr  < 24)  return `${hr} hour${hr !== 1 ? "s" : ""} ago`;
  const day = Math.floor(hr / 24);
  if (day < 30)  return `${day} day${day !== 1 ? "s" : ""} ago`;
  const mo  = Math.floor(day / 30);
  if (mo  < 12)  return `${mo} month${mo !== 1 ? "s" : ""} ago`;
  const yr  = Math.floor(mo / 12);
  return `${yr} year${yr !== 1 ? "s" : ""} ago`;
}

function Avatar({ name, url, size = 28 }) {
  const style = {
    width: size, height: size, borderRadius: "50%", flexShrink: 0,
    overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: size * 0.38, fontWeight: 700, color: "#fff",
    background: url ? "transparent" : getAvatarColor(name ?? ""),
  };
  return (
    <div style={style}>
      {url ? <img src={getFileUrl(url)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
           : getInitials(name ?? "")}
    </div>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────
function OverviewTab({ user, storage, storageLoading, onUserUpdate }) {
  const { showToast } = useToast();
  const name = user.fullName ?? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [form, setForm] = useState({
    firstName: user.firstName ?? "",
    lastName:  user.lastName  ?? "",
    email:     user.email     ?? "",
    workPhone: user.workPhone ?? "",
    aboutMe:   user.aboutMe   ?? "",
    dateOfBirth: user.dateOfBirth ? user.dateOfBirth.split("T")[0] : "",
  });

  const setField = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateUser(user.id, {
        ...form,
        dateOfBirth: form.dateOfBirth || null,
        workPhone:   form.workPhone   || null,
        aboutMe:     form.aboutMe     || null,
      });
      showToast("Profile updated", "success");
      setEditing(false);
      onUserUpdate?.();
    } catch (err) {
      showToast(err.message || "Failed to update", "error");
    } finally {
      setSaving(false);
    }
  };

  const storageFill = storage
    ? Math.min((storage.totalMb / 100) * 100, 100)
    : 0;

  return (
    <div className="ud-overview-grid">
      {/* Sol: info cards */}
      <div>
        <div className="ud-card">
          <div className="ud-card-header">
            <p className="ud-card-title">Personal Information</p>
            {!editing ? (
              <button className="ud-card-edit-btn" onClick={() => setEditing(true)}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
                Edit
              </button>
            ) : (
              <div style={{ display: "flex", gap: 6 }}>
                <button className="ud-card-save-btn" onClick={handleSave} disabled={saving}>
                  {saving ? "Saving…" : "Save"}
                </button>
                <button className="ud-card-cancel-btn" onClick={() => {
                  setEditing(false);
                  setForm({
                    firstName: user.firstName ?? "",
                    lastName:  user.lastName  ?? "",
                    email:     user.email     ?? "",
                    workPhone: user.workPhone ?? "",
                    aboutMe:   user.aboutMe   ?? "",
                    dateOfBirth: user.dateOfBirth ? user.dateOfBirth.split("T")[0] : "",
                  });
                }}>Cancel</button>
              </div>
            )}
          </div>

          {editing ? (
            <div className="ud-edit-form">
              <div className="ud-edit-row">
                <div className="ud-edit-field">
                  <label>First Name</label>
                  <input value={form.firstName} onChange={e => setField("firstName", e.target.value)} />
                </div>
                <div className="ud-edit-field">
                  <label>Last Name</label>
                  <input value={form.lastName} onChange={e => setField("lastName", e.target.value)} />
                </div>
              </div>
              <div className="ud-edit-field">
                <label>Email</label>
                <input type="email" value={form.email} onChange={e => setField("email", e.target.value)} />
              </div>
              <div className="ud-edit-field">
                <label>Phone</label>
                <input value={form.workPhone} onChange={e => setField("workPhone", e.target.value)} />
              </div>
              <div className="ud-edit-field">
                <label>Date of Birth</label>
                <input type="date" value={form.dateOfBirth} onChange={e => setField("dateOfBirth", e.target.value)} />
              </div>
              <div className="ud-edit-field">
                <label>About</label>
                <textarea rows={3} value={form.aboutMe} onChange={e => setField("aboutMe", e.target.value)} />
              </div>
            </div>
          ) : (
            <>
              <div className="ud-info-row">
                <span className="ud-info-label">Full Name</span>
                <span className="ud-info-value">{name || "—"}</span>
              </div>
              <div className="ud-info-row">
                <span className="ud-info-label">Email</span>
                <span className="ud-info-value">{user.email || "—"}</span>
              </div>
              <div className="ud-info-row">
                <span className="ud-info-label">Phone</span>
                <span className={`ud-info-value${!user.workPhone ? " muted" : ""}`}>
                  {user.workPhone || "—"}
                </span>
              </div>
              <div className="ud-info-row">
                <span className="ud-info-label">Date of Birth</span>
                <span className={`ud-info-value${!user.dateOfBirth ? " muted" : ""}`}>
                  {user.dateOfBirth ? new Date(user.dateOfBirth).toLocaleDateString() : "—"}
                </span>
              </div>
              {user.aboutMe && (
                <div className="ud-info-row">
                  <span className="ud-info-label">About</span>
                  <span className="ud-info-value">{user.aboutMe}</span>
                </div>
              )}
            </>
          )}
        </div>

        <div className="ud-card">
          <p className="ud-card-title">Employment</p>
          <div className="ud-info-row">
            <span className="ud-info-label">Position</span>
            <span className={`ud-info-value${!user.position ? " muted" : ""}`}>
              {user.position || "—"}
            </span>
          </div>
          <div className="ud-info-row">
            <span className="ud-info-label">Department</span>
            <span className={`ud-info-value${!user.departmentName ? " muted" : ""}`}>
              {user.departmentName || "—"}
            </span>
          </div>
          <div className="ud-info-row">
            <span className="ud-info-label">Hired</span>
            <span className={`ud-info-value${!user.hiringDate ? " muted" : ""}`}>
              {user.hiringDate ? new Date(user.hiringDate).toLocaleDateString() : "—"}
            </span>
          </div>
          <div className="ud-info-row">
            <span className="ud-info-label">Account Created</span>
            <span className="ud-info-value">
              {formatRelativeTime(user.createdAtUtc ?? user.createdAt)}
            </span>
          </div>
          <div className="ud-info-row">
            <span className="ud-info-label">Password Changed</span>
            <span className="ud-info-value">
              {formatRelativeTime(user.passwordChangedAt)}
            </span>
          </div>
        </div>
      </div>

      {/* Sağ: storage card */}
      <div>
        <div className="ud-card">
          <p className="ud-card-title">Storage</p>
          {storageLoading ? (
            <>
              <div className="ud-skeleton-bar" style={{ width: "60%" }} />
              <div className="ud-skeleton-bar" style={{ width: "40%" }} />
            </>
          ) : storage ? (
            <>
              <div className="ud-storage-total">{storage.totalMb.toFixed(1)} MB</div>
              <div className="ud-storage-sub">{storage.fileCount} files total</div>
              <div className="ud-storage-bar-bg">
                <div className="ud-storage-bar-fill" style={{ width: `${storageFill}%` }} />
              </div>
              <div className="ud-storage-breakdown">
                <div className="ud-storage-item">
                  <span className="ud-storage-dot images" />
                  Images
                  <span className="ud-storage-count">{storage.imageCount}</span>
                </div>
                <div className="ud-storage-item">
                  <span className="ud-storage-dot documents" />
                  Documents
                  <span className="ud-storage-count">{storage.documentCount}</span>
                </div>
                <div className="ud-storage-item">
                  <span className="ud-storage-dot other" />
                  Other
                  <span className="ud-storage-count">{storage.otherCount}</span>
                </div>
              </div>
            </>
          ) : (
            <p className="ud-empty-note">No storage data</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Organization Tab ─────────────────────────────────────────────────────────
function OrganizationTab({ user, onUserUpdate }) {
  const { showToast } = useToast();
  // Backend SupervisorDto → userId field, id deyil — normalize et
  const [supervisors, setSupervisors] = useState(
    (user.supervisors ?? []).map(s => ({
      ...s,
      id: s.id ?? s.userId,
      positionName: s.positionName ?? s.position ?? null,
    }))
  );
  const [subordinates] = useState(user.subordinates ?? []);
  const [depts, setDepts]             = useState([]);
  const [changingDept, setChangingDept] = useState(false);
  const [deptSearch, setDeptSearch]   = useState("");
  const [selectedDeptId, setSelectedDeptId] = useState(user.departmentId ?? "");
  const [deptSaving, setDeptSaving]   = useState(false);
  const [supSearch, setSupSearch]     = useState("");
  const [supSuggestions, setSupSuggestions] = useState([]);
  const [addingSupMode, setAddingSupMode]   = useState(false);
  const supDebounceRef = useRef(null);

  useEffect(() => {
    getDepartments().then(setDepts).catch(() => {});
  }, []);

  // Supervisor axtarışı — açılanda dərhal yüklə, yazdıqda debounce
  useEffect(() => {
    if (!addingSupMode) { setSupSuggestions([]); return; }
    clearTimeout(supDebounceRef.current);
    const fetch = () => {
      const q = supSearch.trim();
      const req = q.length >= 2
        ? searchUsers(q)
        : getUsers({ pageSize: 50 });
      req.then(d => {
          const list = d?.items ?? (Array.isArray(d) ? d : []);
          const existingIds = new Set(supervisors.map(s => s.id));
          setSupSuggestions(list.filter(u => !existingIds.has(u.id) && u.id !== user.id));
        })
        .catch(() => {});
    };
    supDebounceRef.current = setTimeout(fetch, supSearch.trim().length >= 2 ? 300 : 0);
  }, [supSearch, addingSupMode, supervisors, user.id]);

  const handleDeptSave = async () => {
    setDeptSaving(true);
    try {
      await assignEmployeeToDepartment(user.id, selectedDeptId);
      setChangingDept(false);
      showToast("Department updated", "success");
      onUserUpdate?.();
    } catch (err) {
      showToast(err.message || "Failed to update department", "error");
    } finally {
      setDeptSaving(false);
    }
  };

  const handleRemoveDept = async () => {
    try {
      await removeUserFromDepartment(user.id);
      showToast("Removed from department", "success");
      onUserUpdate?.();
    } catch (err) {
      showToast(err.message || "Failed to remove from department", "error");
    }
  };

  const handleRemoveSupervisor = async (supId) => {
    try {
      await removeSupervisor(user.id, supId);
      setSupervisors(prev => prev.filter(s => s.id !== supId));
      showToast("Supervisor removed", "success");
    } catch (err) {
      showToast(err.message || "Failed to remove supervisor", "error");
    }
  };

  const handleAddSupervisor = async (supUser) => {
    try {
      await addSupervisor(user.id, supUser.id);
      const name = supUser.fullName ?? `${supUser.firstName ?? ""} ${supUser.lastName ?? ""}`.trim();
      const pos  = supUser.positionName ?? supUser.position ?? null;
      setSupervisors(prev => [...prev, { id: supUser.id, fullName: name, avatarUrl: supUser.avatarUrl, positionName: pos }]);
      setAddingSupMode(false);
      setSupSearch("");
      setSupSuggestions([]);
      showToast("Supervisor added", "success");
    } catch (err) {
      showToast(err.message || "Failed to add supervisor", "error");
    }
  };

  const filteredDepts = deptSearch.trim()
    ? depts.filter(d => d.name.toLowerCase().includes(deptSearch.toLowerCase()))
    : depts;

  return (
    <div>
      {/* Department card */}
      <div className="ud-card">
        <p className="ud-card-title">Department</p>
        <div className="ud-dept-row">
          <span className={`ud-dept-name${!user.departmentName ? " empty" : ""}`}>
            {user.departmentName || "(No department)"}
          </span>
          <button className="ud-dept-change-btn" onClick={() => { setChangingDept(v => !v); setSelectedDeptId(user.departmentId ?? ""); }}>
            {user.departmentName ? "Change →" : "Assign →"}
          </button>
          {user.departmentId && (
            <button className="ud-dept-remove-btn" onClick={handleRemoveDept}>
              Remove
            </button>
          )}
        </div>

        {changingDept && (
          <div className="ud-dept-dropdown">
            <div className="ud-dept-dropdown-search">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input placeholder="Search..." value={deptSearch}
                onChange={e => setDeptSearch(e.target.value)} autoFocus />
            </div>
            <div className="ud-dept-dropdown-list">
              {filteredDepts.map(d => (
                <button key={d.id}
                  className={`ud-dept-dropdown-item${selectedDeptId === d.id ? " active" : ""}`}
                  onClick={() => setSelectedDeptId(d.id)}>
                  {d.name}
                </button>
              ))}
              {filteredDepts.length === 0 && (
                <div style={{ padding: "12px", fontSize: "13px", color: "#9ca3af" }}>No departments found</div>
              )}
            </div>
            <div className="ud-dept-dropdown-actions">
              <button className="ud-dept-save-btn" onClick={handleDeptSave}
                disabled={deptSaving || !selectedDeptId}>
                {deptSaving ? "Saving..." : "Save Change"}
              </button>
              <button className="ud-dept-cancel-btn" onClick={() => { setChangingDept(false); setDeptSearch(""); }}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Supervisors card */}
      <div className="ud-card">
        <p className="ud-card-title">Supervisors</p>
        {supervisors.length === 0 && !addingSupMode && (
          <p className="ud-empty-note">No supervisors assigned</p>
        )}
        {supervisors.map(s => {
          const sName = s.fullName ?? s.name ?? "";
          return (
            <div key={s.id} className="ud-supervisor-row">
              <Avatar name={sName} url={s.avatarUrl} size={28} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="ud-sup-name">{sName}</div>
                {s.positionName && <div className="ud-sup-pos">{s.positionName}</div>}
              </div>
              <button className="ud-sup-remove" title="Remove supervisor"
                onClick={() => handleRemoveSupervisor(s.id)}>✕</button>
            </div>
          );
        })}

        {addingSupMode ? (
          <div className="ud-sup-search-wrap">
            <div className="ud-sup-search-input-row">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input placeholder="Search users..." value={supSearch}
                onChange={e => setSupSearch(e.target.value)} autoFocus />
              <button onClick={() => { setAddingSupMode(false); setSupSearch(""); setSupSuggestions([]); }}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: "13px" }}>✕</button>
            </div>
            <div className="ud-sup-suggestions">
              {supSuggestions.map(u => {
                const uName = u.fullName ?? `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim();
                return (
                  <button key={u.id} className="ud-sup-suggestion" onClick={() => handleAddSupervisor(u)}>
                    <Avatar name={uName} url={u.avatarUrl} size={24} />
                    <span>{uName}</span>
                    {(u.positionName ?? u.position) && <span style={{ fontSize: "11px", color: "#9ca3af" }}>{u.positionName ?? u.position}</span>}
                  </button>
                );
              })}
              {supSearch.trim() && supSuggestions.length === 0 && (
                <div style={{ padding: "10px 12px", fontSize: "13px", color: "#9ca3af" }}>No users found</div>
              )}
            </div>
          </div>
        ) : (
          <button className="ud-add-sup-btn" onClick={() => setAddingSupMode(true)}>
            + Add supervisor
          </button>
        )}
      </div>

      {/* Subordinates card (read-only) */}
      <div className="ud-card">
        <p className="ud-card-title">Subordinates</p>
        {subordinates.length === 0 ? (
          <p className="ud-empty-note">No subordinates</p>
        ) : (
          subordinates.map(s => {
            const sName = s.fullName ?? s.name ?? "";
            return (
              <div key={s.id} className="ud-sub-row">
                <Avatar name={sName} url={s.avatarUrl} size={28} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "13px", fontWeight: 500, color: "#111827" }}>{sName}</div>
                  {(s.positionName ?? s.position) && <div style={{ fontSize: "11px", color: "#6b7280" }}>{s.positionName ?? s.position}</div>}
                </div>
                {!s.isActive && <span className="ud-inactive-badge">Inactive</span>}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// CRUD əsas hüquqları — heç kimə verilə bilməz, siyahıda göstərilmir
const HIDDEN_ACTIONS = new Set(["Create", "Update", "Read", "Delete"]);

// ─── Permissions Tab ──────────────────────────────────────────────────────────
// allPermissions: GET /api/users/permissions → [{ module, permissions: ["Users.Create",...] }]
// userPermissions: user.permissions string[] (getUserById-dan gəlir)
function PermissionsTab({ userId, userPermissions }) {
  const { showToast } = useToast();
  const [modules, setModules]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [overrides, setOverrides] = useState({}); // { [permName]: bool } — optimistic

  useEffect(() => {
    setLoading(true);
    getAllPermissions()
      .then(data => setModules(Array.isArray(data) ? data : []))
      .catch(() => setModules([]))
      .finally(() => setLoading(false));
  }, []);

  const isGranted = (permName) => {
    if (permName in overrides) return overrides[permName];
    return (userPermissions ?? []).includes(permName);
  };

  const handleToggle = useCallback(async (permName) => {
    const current = isGranted(permName);
    setOverrides(prev => ({ ...prev, [permName]: !current }));
    try {
      if (current) {
        await removePermission(userId, permName);
      } else {
        await assignPermission(userId, permName);
      }
      // onRefresh çağırılmır — optimistic update kifayətdir, setLoading(true) tetiklənməsin
    } catch {
      setOverrides(prev => ({ ...prev, [permName]: current }));
      showToast("Failed to update permission", "error");
    }
  }, [userId, userPermissions, overrides]);

  if (loading) {
    return (
      <div>
        {[1, 2, 3].map(i => (
          <div key={i} className="ud-card">
            <div className="ud-skeleton-bar" style={{ width: "30%", marginBottom: "14px" }} />
            <div className="ud-skeleton-bar" style={{ width: "80%" }} />
            <div className="ud-skeleton-bar" style={{ width: "65%" }} />
          </div>
        ))}
      </div>
    );
  }

  if (modules.length === 0) {
    return <div className="ud-card"><p className="ud-empty-note">No permissions data available</p></div>;
  }

  return (
    <div>
      {modules.map(mod => {
        const visiblePerms = (mod.permissions ?? []).filter(
          p => !HIDDEN_ACTIONS.has(p.split(".").pop())
        );
        if (visiblePerms.length === 0) return null;
        return (
          <div key={mod.module} className="ud-card ud-perm-module">
            <p className="ud-perm-module-title">{mod.module}</p>
            <div className="ud-perm-grid">
              {visiblePerms.map(permName => {
                const granted = isGranted(permName);
                const label = permName.split(".").pop();
                return (
                  <div key={permName} className="ud-perm-item">
                    <span className="ud-perm-name">{label}</span>
                    <button
                      className={`ud-toggle ${granted ? "on" : "off"}`}
                      onClick={() => handleToggle(permName)}
                      aria-label={`Toggle ${permName}`}
                    >
                      <span className="ud-toggle-knob" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Security Tab ─────────────────────────────────────────────────────────────
function SecurityTab({ user, onUserUpdate }) {
  const { showToast } = useToast();
  const [resetOpen, setResetOpen] = useState(false);
  const [newPwd, setNewPwd]       = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [pwdError, setPwdError]   = useState("");
  const [pwdSaving, setPwdSaving] = useState(false);
  const [toggling, setToggling]   = useState(false);

  const handlePwdSave = async (e) => {
    e.preventDefault();
    if (!newPwd.trim()) { setPwdError("Password is required"); return; }
    if (newPwd !== confirmPwd) { setPwdError("Passwords do not match"); return; }
    if (newPwd.length < 8)          { setPwdError("Minimum 8 characters"); return; }
    if (!/[A-Z]/.test(newPwd))      { setPwdError("Must contain at least one uppercase letter"); return; }
    if (!/[a-z]/.test(newPwd))      { setPwdError("Must contain at least one lowercase letter"); return; }
    if (!/[0-9]/.test(newPwd))      { setPwdError("Must contain at least one number"); return; }
    if (!/[^a-zA-Z0-9]/.test(newPwd)) { setPwdError("Must contain at least one special character"); return; }
    setPwdSaving(true);
    setPwdError("");
    try {
      await adminChangePassword(user.id, newPwd, confirmPwd);
      showToast("Password reset successfully", "success");
      setResetOpen(false);
      setNewPwd(""); setConfirmPwd("");
    } catch (err) {
      setPwdError(err.message || "Failed to reset password");
    } finally {
      setPwdSaving(false);
    }
  };

  const handleToggleStatus = async () => {
    setToggling(true);
    try {
      user.isActive ? await deactivateUser(user.id) : await activateUser(user.id);
      showToast(user.isActive ? "Account deactivated" : "Account activated", "success");
      onUserUpdate?.();
    } catch (err) {
      showToast(err.message || "Failed to update status", "error");
    } finally {
      setToggling(false);
    }
  };

  return (
    <div>
      {/* Session card */}
      <div className="ud-card">
        <p className="ud-card-title">Session</p>
        <div className="ud-security-item">
          <span className="ud-security-label">Last Login</span>
          <span className="ud-security-value">
            {user.lastVisit ? formatRelativeTime(user.lastVisit) : "—"}
          </span>
        </div>
        <div className="ud-security-item">
          <span className="ud-security-label">Activity Logs</span>
          <span className="ud-security-value muted">Coming soon</span>
        </div>
      </div>

      {/* Password card */}
      <div className="ud-card">
        <p className="ud-card-title">Password</p>
        <div className="ud-security-item">
          <span className="ud-security-label">Last Changed</span>
          <span className="ud-security-value">
            {formatRelativeTime(user.passwordChangedAt)}
          </span>
        </div>
        {!resetOpen ? (
          <button className="ud-reset-pwd-btn" onClick={() => setResetOpen(true)}>
            Reset Password →
          </button>
        ) : (
          <form className="ud-pwd-form" onSubmit={handlePwdSave}>
            <input className="ud-pwd-input" type="password" placeholder="New password"
              value={newPwd} onChange={e => setNewPwd(e.target.value)} autoFocus />
            <input className="ud-pwd-input" type="password" placeholder="Confirm password"
              value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} />
            {pwdError && <span className="ud-pwd-error">{pwdError}</span>}
            <div className="ud-pwd-actions">
              <button className="ud-pwd-save-btn" type="submit" disabled={pwdSaving}>
                {pwdSaving ? "Saving..." : "Save"}
              </button>
              <button className="ud-pwd-cancel-btn" type="button"
                onClick={() => { setResetOpen(false); setNewPwd(""); setConfirmPwd(""); setPwdError(""); }}>
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Account status card */}
      <div className="ud-card">
        <p className="ud-card-title">Account Status</p>
        <div className="ud-status-wrap">
          <div className="ud-status-indicator">
            <span className={`ud-status-dot-lg ${user.isActive ? "active" : "inactive"}`} />
            {user.isActive ? "Active" : "Inactive"}
          </div>
          <button
            className={`ud-activate-btn ${user.isActive ? "deactivate" : "activate"}`}
            onClick={handleToggleStatus}
            disabled={toggling}
          >
            {toggling ? "..." : user.isActive ? "Deactivate Account" : "Activate Account"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── UserDetailPage ───────────────────────────────────────────────────────────
function UserDetailPage({ userId, onDeleted }) {
  const { showToast } = useToast();
  const [user, setUser]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [storage, setStorage]     = useState(null);
  const [storageLoading, setStorageLoading] = useState(false);
  const [toggling, setToggling]   = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting]   = useState(false);

  const loadUser = useCallback(() => {
    setLoading(true);
    getUserById(userId)
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, [userId]);

  useEffect(() => { loadUser(); }, [loadUser]);

  const handleToggleStatus = async () => {
    setToggling(true);
    try {
      user.isActive ? await deactivateUser(user.id) : await activateUser(user.id);
      showToast(user.isActive ? "Account deactivated" : "Account activated", "success");
      loadUser();
    } catch (err) {
      showToast(err.message || "Failed to update status", "error");
    } finally {
      setToggling(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteUser(user.id);
      showToast("User deleted", "success");
      onDeleted?.();
    } catch (err) {
      showToast(err.message || "Failed to delete user", "error");
      setDeleting(false);
      setDeleteConfirm(false);
    }
  };

  // Storage-i overview tab ilk açıldığında yüklə
  useEffect(() => {
    if (activeTab === "overview" && user && !storage && !storageLoading) {
      setStorageLoading(true);
      getUserStorageStats(userId)
        .then(setStorage)
        .catch(() => {})
        .finally(() => setStorageLoading(false));
    }
  }, [activeTab, user, userId, storage, storageLoading]);

  if (loading) {
    return (
      <div className="ud-root">
        <div className="ud-loading">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="ud-root">
        <div className="ud-loading">User not found</div>
      </div>
    );
  }

  const name = user.fullName ?? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim();
  const tabs = ["overview", "organization", "permissions", "security"];
  const tabLabels = { overview: "Overview", organization: "Organization", permissions: "Permissions", security: "Security" };

  return (
    <div className="ud-root">
      {/* Hero */}
      <div className="ud-hero">
        <div className="ud-hero-avatar-wrap">
          <div className="ud-hero-avatar"
            style={{ background: user.avatarUrl ? "transparent" : getAvatarColor(name) }}>
            {user.avatarUrl
              ? <img src={getFileUrl(user.avatarUrl)} alt="" />
              : getInitials(name)}
          </div>
        </div>

        <div className="ud-hero-info">
          <div className="ud-hero-name">{name}</div>
          {user.position && <div className="ud-hero-position">{user.position}</div>}
          <div className="ud-hero-badges">
            <span className={`ud-badge role-${(user.role ?? "user").toLowerCase()}`}>
              {user.role ?? "User"}
            </span>
            <span className={`ud-badge status-${user.isActive ? "active" : "inactive"}`}>
              {user.isActive ? "Active" : "Inactive"}
              {user.lastVisit && (
                <span className="ud-badge-time">· {formatRelativeTime(user.lastVisit)}</span>
              )}
            </span>
          </div>
        </div>

        <div className="ud-hero-actions">
          <button className="ud-btn-outline" onClick={() => setActiveTab("security")}>
            Reset Password
          </button>
          <button className="ud-btn-outline" onClick={handleToggleStatus} disabled={toggling}>
            {toggling ? "..." : user.isActive ? "Deactivate" : "Activate"}
          </button>
          <button className="ud-btn-danger-outline" onClick={() => setDeleteConfirm(true)}>
            Delete
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="ud-tabs">
        {tabs.map(tab => (
          <button key={tab}
            className={`ud-tab${activeTab === tab ? " active" : ""}`}
            onClick={() => setActiveTab(tab)}>
            {tabLabels[tab]}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "overview" && (
        <OverviewTab user={user} storage={storage} storageLoading={storageLoading} onUserUpdate={loadUser} />
      )}
      {activeTab === "organization" && (
        <OrganizationTab user={user} onUserUpdate={loadUser} />
      )}
      {activeTab === "permissions" && (
        <PermissionsTab userId={userId} userPermissions={user.permissions ?? []} />
      )}
      {activeTab === "security" && (
        <SecurityTab user={user} onUserUpdate={loadUser} />
      )}

      {/* Delete confirmation modal */}
      {deleteConfirm && (
        <div className="ud-modal-backdrop" onClick={() => setDeleteConfirm(false)}>
          <div className="ud-modal" onClick={e => e.stopPropagation()}>
            <p className="ud-modal-title">Delete User</p>
            <p className="ud-modal-body">
              Are you sure you want to delete <strong>{name}</strong>?
              This only removes the account — messages and files are preserved.
            </p>
            <div className="ud-modal-actions">
              <button className="ud-modal-cancel" onClick={() => setDeleteConfirm(false)} disabled={deleting}>
                Cancel
              </button>
              <button className="ud-modal-confirm danger" onClick={handleDelete} disabled={deleting}>
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default UserDetailPage;
