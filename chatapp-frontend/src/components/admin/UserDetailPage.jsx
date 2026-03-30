import { useState, useEffect, useCallback, useRef } from "react";
import {
  getUserById, getUserStorageStats, getAllPermissions,
  addSupervisor, removeSupervisor,
  getDepartments, assignEmployeeToDepartment, removeUserFromDepartment,
  getUsers, searchUsers, activateUser, deactivateUser, adminChangePassword,
  assignPermission, removePermission, updateUser, deleteUser,
  getAllPositions,
  getFileUrl,
} from "../../services/api";
import { getInitials, getAvatarColor } from "../../utils/chatUtils";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../context/AuthContext";
import { getConnection } from "../../services/signalr";
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

function daysSince(dateStr) {
  if (!dateStr) return null;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
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

// ─── SVG Donut Chart ─────────────────────────────────────────────────────────
function StorageDonut({ storage }) {
  const total = storage.totalMb || 1;
  const segments = [
    { label: "Images",    count: storage.imageCount,    mb: storage.imageMb ?? 0,    color: "#2563eb" },
    { label: "Documents", count: storage.documentCount, mb: storage.documentMb ?? 0, color: "#22c55e" },
    { label: "Other",     count: storage.otherCount,    mb: storage.otherMb ?? 0,    color: "#94a3b8" },
  ];

  const radius = 52, stroke = 10, circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="ud-donut-section">
      <div className="ud-donut-wrap">
        <svg width="140" height="140" viewBox="0 0 140 140">
          <circle cx="70" cy="70" r={radius} fill="none" stroke="#f1f5f9" strokeWidth={stroke} />
          {segments.map((seg, i) => {
            const pct = seg.mb / total;
            const dashLen = circumference * pct;
            const dashOff = circumference * offset;
            offset += pct;
            return pct > 0 ? (
              <circle key={i} cx="70" cy="70" r={radius}
                fill="none" stroke={seg.color} strokeWidth={stroke}
                strokeDasharray={`${dashLen} ${circumference - dashLen}`}
                strokeDashoffset={-dashOff}
                strokeLinecap="round"
                style={{ transition: "stroke-dasharray 600ms cubic-bezier(0.16,1,0.3,1)" }}
              />
            ) : null;
          })}
        </svg>
        <div className="ud-donut-center">
          <span className="ud-donut-value">{storage.totalMb.toFixed(1)}</span>
          <span className="ud-donut-unit">MB</span>
        </div>
      </div>
      <div className="ud-storage-legend">
        {segments.map((seg, i) => (
          <div key={i} className="ud-storage-legend-item">
            <span className="ud-storage-legend-dot" style={{ background: seg.color }} />
            <span>{seg.label}</span>
            <span className="ud-storage-legend-meta">
              <span className="ud-storage-legend-count">{seg.count}</span>
              <span className="ud-storage-legend-size">{seg.mb.toFixed(1)} MB</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── UserDetailPage — Dashboard Layout (tab yoxdur) ──────────────────────────
function UserDetailPage({ userId, onDeleted }) {
  const { showToast } = useToast();
  const { hasPermission } = useAuth();
  const [user, setUser]               = useState(null);
  const [loading, setLoading]         = useState(true);
  const [storage, setStorage]         = useState(null);
  const [storageLoading, setStorageLoading] = useState(false);
  const [toggling, setToggling]       = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting]       = useState(false);
  const [isOnline, setIsOnline]       = useState(false);

  // Personal Details — edit state
  const [editing, setEditing]         = useState(false);
  const [saving, setSaving]           = useState(false);
  const [positions, setPositions]     = useState([]);
  const [form, setForm]               = useState({});

  // Organization state
  const [supervisors, setSupervisors] = useState([]);
  const [subordinates, setSubordinates] = useState([]);
  const [depts, setDepts]             = useState([]);
  const [changingDept, setChangingDept] = useState(false);
  const [deptSearch, setDeptSearch]   = useState("");
  const [selectedDeptId, setSelectedDeptId] = useState("");
  const [deptSaving, setDeptSaving]   = useState(false);
  const [supSearch, setSupSearch]     = useState("");
  const [supSuggestions, setSupSuggestions] = useState([]);
  const [addingSupMode, setAddingSupMode] = useState(false);
  const supDebounceRef = useRef(null);

  // Security state
  const [resetOpen, setResetOpen] = useState(false);
  const [newPwd, setNewPwd]       = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [pwdError, setPwdError]   = useState("");
  const [pwdSaving, setPwdSaving] = useState(false);

  // Permissions state
  const [modules, setModules]     = useState([]);
  const [permLoading, setPermLoading] = useState(true);
  const [overrides, setOverrides] = useState({});

  // ─── SignalR ilə online status ──────────────────────────────────────────────
  useEffect(() => {
    const conn = getConnection();
    if (!conn || !userId) return;
    conn.invoke("GetOnlineStatus", [userId])
      .then((statusMap) => setIsOnline(!!statusMap?.[userId]))
      .catch(() => {});
    const handleOnline = (id) => { if (id === userId) setIsOnline(true); };
    const handleOffline = (id) => { if (id === userId) setIsOnline(false); };
    conn.on("UserOnline", handleOnline);
    conn.on("UserOffline", handleOffline);
    return () => {
      conn.off("UserOnline", handleOnline);
      conn.off("UserOffline", handleOffline);
    };
  }, [userId]);

  // ─── Data yüklə ────────────────────────────────────────────────────────────
  const loadUser = useCallback(() => {
    setLoading(true);
    getUserById(userId)
      .then(u => {
        setUser(u);
        // Organization state-lərini set et
        setSupervisors((u?.supervisors ?? []).map(s => ({
          ...s, id: s.id ?? s.userId,
          positionName: s.positionName ?? s.position ?? null,
        })));
        setSubordinates(u?.subordinates ?? []);
        setSelectedDeptId(u?.departmentId ?? "");
        // Form state-i set et
        setForm({
          firstName: u?.firstName ?? "", lastName: u?.lastName ?? "",
          email: u?.email ?? "", workPhone: u?.workPhone ?? "",
          aboutMe: u?.aboutMe ?? "",
          dateOfBirth: u?.dateOfBirth ? u.dateOfBirth.split("T")[0] : "",
          positionId: u?.positionId ?? "",
          hiringDate: u?.hiringDate ? u.hiringDate.split("T")[0] : "",
        });
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, [userId]);

  useEffect(() => { loadUser(); }, [loadUser]);

  // Storage yüklə
  useEffect(() => {
    if (!userId) return;
    setStorageLoading(true);
    getUserStorageStats(userId)
      .then(setStorage)
      .catch(() => {})
      .finally(() => setStorageLoading(false));
  }, [userId]);

  // Departments + Positions + Permissions paralel yüklə
  useEffect(() => {
    getDepartments().then(setDepts).catch(() => {});
    getAllPositions().then(data => {
      setPositions(Array.isArray(data) ? data : (data?.items ?? []));
    }).catch(() => {});
    getAllPermissions()
      .then(data => setModules(Array.isArray(data) ? data : []))
      .catch(() => setModules([]))
      .finally(() => setPermLoading(false));
  }, []);

  // Supervisor axtarışı
  useEffect(() => {
    if (!addingSupMode) { setSupSuggestions([]); return; }
    clearTimeout(supDebounceRef.current);
    const fetch = () => {
      const q = supSearch.trim();
      const req = q.length >= 2 ? searchUsers(q) : getUsers({ pageSize: 50 });
      req.then(d => {
        const list = d?.items ?? (Array.isArray(d) ? d : []);
        const existingIds = new Set(supervisors.map(s => s.id));
        setSupSuggestions(list.filter(u => !existingIds.has(u.id) && u.id !== userId));
      }).catch(() => {});
    };
    supDebounceRef.current = setTimeout(fetch, supSearch.trim().length >= 2 ? 300 : 0);
  }, [supSearch, addingSupMode, supervisors, userId]);

  // ─── Handlers ───────────────────────────────────────────────────────────────
  const setField = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateUser(userId, {
        ...form,
        dateOfBirth: form.dateOfBirth || null,
        workPhone: form.workPhone || null,
        aboutMe: form.aboutMe || null,
        positionId: form.positionId || null,
        hiringDate: form.hiringDate || null,
      });
      showToast("Profile updated", "success");
      setEditing(false);
      loadUser();
    } catch (err) {
      showToast(err.message || "Failed to update", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async () => {
    setToggling(true);
    try {
      user.isActive ? await deactivateUser(userId) : await activateUser(userId);
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
      await deleteUser(userId);
      showToast("User deleted", "success");
      onDeleted?.();
    } catch (err) {
      showToast(err.message || "Failed to delete user", "error");
      setDeleting(false);
      setDeleteConfirm(false);
    }
  };

  const handleDeptSave = async () => {
    setDeptSaving(true);
    try {
      await assignEmployeeToDepartment(userId, selectedDeptId);
      setChangingDept(false);
      showToast("Department updated", "success");
      loadUser();
    } catch (err) {
      showToast(err.message || "Failed to update department", "error");
    } finally {
      setDeptSaving(false);
    }
  };

  const handleRemoveDept = async () => {
    try {
      await removeUserFromDepartment(userId);
      showToast("Removed from department", "success");
      loadUser();
    } catch (err) {
      showToast(err.message || "Failed to remove from department", "error");
    }
  };

  const handleRemoveSupervisor = async (supId) => {
    try {
      await removeSupervisor(userId, supId);
      setSupervisors(prev => prev.filter(s => s.id !== supId));
      showToast("Supervisor removed", "success");
    } catch (err) {
      showToast(err.message || "Failed to remove supervisor", "error");
    }
  };

  const handleAddSupervisor = async (supUser) => {
    try {
      await addSupervisor(userId, supUser.id);
      const name = supUser.fullName ?? `${supUser.firstName ?? ""} ${supUser.lastName ?? ""}`.trim();
      setSupervisors(prev => [...prev, { id: supUser.id, fullName: name, avatarUrl: supUser.avatarUrl, positionName: supUser.positionName ?? supUser.position ?? null }]);
      setAddingSupMode(false);
      setSupSearch("");
      showToast("Supervisor added", "success");
    } catch (err) {
      showToast(err.message || "Failed to add supervisor", "error");
    }
  };

  const handlePwdSave = async (e) => {
    e.preventDefault();
    if (!newPwd.trim()) { setPwdError("Password is required"); return; }
    if (newPwd !== confirmPwd) { setPwdError("Passwords do not match"); return; }
    if (newPwd.length < 8)          { setPwdError("Minimum 8 characters"); return; }
    if (!/[A-Z]/.test(newPwd))      { setPwdError("Must contain uppercase letter"); return; }
    if (!/[a-z]/.test(newPwd))      { setPwdError("Must contain lowercase letter"); return; }
    if (!/[0-9]/.test(newPwd))      { setPwdError("Must contain a number"); return; }
    if (!/[^a-zA-Z0-9]/.test(newPwd)) { setPwdError("Must contain special character"); return; }
    setPwdSaving(true); setPwdError("");
    try {
      await adminChangePassword(userId, newPwd, confirmPwd);
      showToast("Password reset successfully", "success");
      setResetOpen(false); setNewPwd(""); setConfirmPwd("");
    } catch (err) {
      setPwdError(err.message || "Failed to reset password");
    } finally {
      setPwdSaving(false);
    }
  };

  const isGranted = (permName) => {
    if (permName in overrides) return overrides[permName];
    return (user?.permissions ?? []).includes(permName);
  };

  const handleTogglePerm = async (permName) => {
    const current = isGranted(permName);
    setOverrides(prev => ({ ...prev, [permName]: !current }));
    try {
      current ? await removePermission(userId, permName) : await assignPermission(userId, permName);
    } catch {
      setOverrides(prev => ({ ...prev, [permName]: current }));
      showToast("Failed to update permission", "error");
    }
  };

  // ─── Loading / Not Found ────────────────────────────────────────────────────
  if (loading) return <div className="ud-root"><div className="ud-loading">Loading...</div></div>;
  if (!user) return <div className="ud-root"><div className="ud-loading">User not found</div></div>;

  const name = user.fullName ?? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim();
  const canAssignPerm = hasPermission("Permissions.Assign");
  const filteredDepts = deptSearch.trim()
    ? depts.filter(d => d.name.toLowerCase().includes(deptSearch.toLowerCase()))
    : depts;
  const memberDays = daysSince(user.createdAtUtc ?? user.createdAt);
  const pwdDays = daysSince(user.passwordChangedAt);

  return (
    <div className="ud-root">
      {/* ═══ HERO ═══ */}
      <div className="ud-hero">
        <div className="ud-hero-avatar-wrap">
          <div className="ud-hero-avatar" style={{ background: user.avatarUrl ? "transparent" : getAvatarColor(name) }}>
            {user.avatarUrl ? <img src={getFileUrl(user.avatarUrl)} alt="" /> : getInitials(name)}
          </div>
        </div>
        <div className="ud-hero-info">
          <div className="ud-hero-name">{name}</div>
          {(user.position || user.departmentName) && (
            <div className="ud-hero-position">
              {user.position}{user.position && user.departmentName ? " · " : ""}{user.departmentName}
            </div>
          )}
          <div className="ud-hero-badges">
            <span className={`ud-badge role-${(user.role ?? "user").toLowerCase()}`}>{user.role ?? "User"}</span>
            <span className={`ud-badge status-${isOnline ? "online" : user.isActive ? "active" : "inactive"}`}>
              {isOnline ? "Online" : user.isActive ? "Active" : "Inactive"}
              {!isOnline && user.lastVisit && <span className="ud-badge-time">· {formatRelativeTime(user.lastVisit)}</span>}
            </span>
          </div>
          {/* Əlaqə məlumatları */}
          <div className="ud-hero-contact">
            {user.email && (
              <span className="ud-hero-contact-item">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
                </svg>
                {user.email}
              </span>
            )}
            {user.email && user.workPhone && <span className="ud-hero-contact-sep">·</span>}
            {user.workPhone && (
              <span className="ud-hero-contact-item">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                </svg>
                {user.workPhone}
              </span>
            )}
          </div>
        </div>
        <div className="ud-hero-actions">
          {hasPermission("Users.Update") && (
            <button className="ud-btn-outline" onClick={handleToggleStatus} disabled={toggling}>
              {toggling ? "..." : user.isActive ? "Deactivate" : "Activate"}
            </button>
          )}
          {hasPermission("Users.Delete") && (
            <button className="ud-btn-danger-outline" onClick={() => setDeleteConfirm(true)}>Delete</button>
          )}
        </div>
      </div>

      {/* ═══ STATS ROW ═══ */}
      <div className="ud-stats-row">
        <div className="ud-stat-card storage">
          <div className="ud-stat-label">Storage</div>
          <div className="ud-stat-value">{storage ? `${storage.totalMb.toFixed(1)} MB` : "—"}</div>
          <div className="ud-stat-sub">{storage ? `${storage.fileCount} files` : "No data"}</div>
          {storage && (
            <div className="ud-stat-bar-bg">
              <div className="ud-stat-bar-fill" style={{ width: `${Math.min((storage.totalMb / 100) * 100, 100)}%` }} />
            </div>
          )}
        </div>
        <div className="ud-stat-card status">
          <div className="ud-stat-label">Status</div>
          <div className={`ud-stat-value ${isOnline ? "online" : ""}`}>
            {isOnline && <span className="ud-stat-online-dot" />}
            {isOnline ? "Online" : "Offline"}
          </div>
          <div className="ud-stat-sub">{isOnline ? "Active now" : user.lastVisit ? formatRelativeTime(user.lastVisit) : "Never logged in"}</div>
        </div>
        <div className="ud-stat-card member">
          <div className="ud-stat-label">Member Since</div>
          <div className="ud-stat-value">{memberDays != null ? `${memberDays} days` : "—"}</div>
          <div className="ud-stat-sub">{user.createdAtUtc || user.createdAt ? `Since ${new Date(user.createdAtUtc ?? user.createdAt).toLocaleDateString("en", { month: "short", year: "numeric" })}` : ""}</div>
        </div>
        <div className="ud-stat-card security">
          <div className="ud-stat-label">Password</div>
          <div className="ud-stat-value">{pwdDays != null ? `${pwdDays} days` : "Never"}</div>
          <div className={`ud-stat-sub${pwdDays == null ? " warning" : ""}`}>{pwdDays != null ? "Last changed" : "Never changed"}</div>
        </div>
      </div>

      {/* ═══ CONTENT GRID ═══ */}
      <div className="ud-content-grid">
        {/* Sol sütun */}
        <div className="ud-content-left">
          {/* Personal Details */}
          <div className="ud-detail-card">
            <div className="ud-detail-card-header">
              <span className="ud-detail-card-title">Personal Details</span>
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
                  <button className="ud-card-save-btn" onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
                  <button className="ud-card-cancel-btn" onClick={() => { setEditing(false); loadUser(); }}>Cancel</button>
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
                <div className="ud-edit-row">
                  <div className="ud-edit-field">
                    <label>Date of Birth</label>
                    <input type="date" value={form.dateOfBirth} onChange={e => setField("dateOfBirth", e.target.value)} />
                  </div>
                  <div className="ud-edit-field">
                    <label>Hiring Date</label>
                    <input type="date" value={form.hiringDate} onChange={e => setField("hiringDate", e.target.value)} />
                  </div>
                </div>
                <div className="ud-edit-field">
                  <label>Position</label>
                  <select value={form.positionId} onChange={e => setField("positionId", e.target.value)}>
                    <option value="">— No position —</option>
                    {positions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="ud-edit-field">
                  <label>About</label>
                  <textarea rows={3} value={form.aboutMe} onChange={e => setField("aboutMe", e.target.value)} />
                </div>
              </div>
            ) : (
              <>
                <div className="ud-info-row"><span className="ud-info-label">Full Name</span><span className="ud-info-value">{name || "—"}</span></div>
                <div className="ud-info-row"><span className="ud-info-label">Email</span><span className="ud-info-value">{user.email || "—"}</span></div>
                <div className="ud-info-row"><span className="ud-info-label">Phone</span><span className={`ud-info-value${!user.workPhone ? " muted" : ""}`}>{user.workPhone || "—"}</span></div>
                <div className="ud-info-row"><span className="ud-info-label">Date of Birth</span><span className={`ud-info-value${!user.dateOfBirth ? " muted" : ""}`}>{user.dateOfBirth ? new Date(user.dateOfBirth).toLocaleDateString() : "—"}</span></div>
                <div className="ud-info-row"><span className="ud-info-label">Hired</span><span className={`ud-info-value${!user.hiringDate ? " muted" : ""}`}>{user.hiringDate ? new Date(user.hiringDate).toLocaleDateString() : "—"}</span></div>
                {user.aboutMe && <div className="ud-info-row"><span className="ud-info-label">About</span><span className="ud-info-value">{user.aboutMe}</span></div>}
              </>
            )}
          </div>

          {/* Organization — Dept + Supervisors + Subordinates bir card-da */}
          <div className="ud-detail-card">
            <div className="ud-detail-card-header">
              <span className="ud-detail-card-title">Organization</span>
            </div>

            {/* Department */}
            <div className="ud-org-section">
              <div className="ud-org-section-title">Department</div>
              <div className="ud-dept-row">
                <span className={`ud-dept-name${!user.departmentName ? " empty" : ""}`}>{user.departmentName || "(No department)"}</span>
                <button className="ud-dept-change-btn" onClick={() => { setChangingDept(v => !v); setSelectedDeptId(user.departmentId ?? ""); }}>
                  {user.departmentName ? "Change →" : "Assign →"}
                </button>
                {user.departmentId && <button className="ud-dept-remove-btn" onClick={handleRemoveDept}>Remove</button>}
              </div>
              {changingDept && (
                <div className="ud-dept-dropdown">
                  <div className="ud-dept-dropdown-search">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input placeholder="Search..." value={deptSearch} onChange={e => setDeptSearch(e.target.value)} autoFocus />
                  </div>
                  <div className="ud-dept-dropdown-list">
                    {filteredDepts.map(d => (
                      <button key={d.id} className={`ud-dept-dropdown-item${selectedDeptId === d.id ? " active" : ""}`} onClick={() => setSelectedDeptId(d.id)}>{d.name}</button>
                    ))}
                    {filteredDepts.length === 0 && <div style={{ padding: "12px", fontSize: "13px", color: "#9ca3af" }}>No departments found</div>}
                  </div>
                  <div className="ud-dept-dropdown-actions">
                    <button className="ud-dept-save-btn" onClick={handleDeptSave} disabled={deptSaving || !selectedDeptId}>{deptSaving ? "Saving..." : "Save"}</button>
                    <button className="ud-dept-cancel-btn" onClick={() => { setChangingDept(false); setDeptSearch(""); }}>Cancel</button>
                  </div>
                </div>
              )}
            </div>

            {/* Supervisors */}
            <div className="ud-org-section">
              <div className="ud-org-section-title">
                Supervisors
                {supervisors.length > 0 && <span className="ud-org-count">{supervisors.length}</span>}
              </div>
              {supervisors.length === 0 && !addingSupMode && <p className="ud-empty-note">No supervisors assigned</p>}
              {supervisors.map(s => {
                const sName = s.fullName ?? s.name ?? "";
                return (
                  <div key={s.id} className="ud-supervisor-row">
                    <Avatar name={sName} url={s.avatarUrl} size={28} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="ud-sup-name">{sName}</div>
                      {s.positionName && <div className="ud-sup-pos">{s.positionName}</div>}
                    </div>
                    <button className="ud-sup-remove" title="Remove" onClick={() => handleRemoveSupervisor(s.id)}>✕</button>
                  </div>
                );
              })}
              {addingSupMode ? (
                <div className="ud-sup-search-wrap">
                  <div className="ud-sup-search-input-row">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input placeholder="Search users..." value={supSearch} onChange={e => setSupSearch(e.target.value)} autoFocus />
                    <button onClick={() => { setAddingSupMode(false); setSupSearch(""); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: "13px" }}>✕</button>
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
                    {supSearch.trim() && supSuggestions.length === 0 && <div style={{ padding: "10px 12px", fontSize: "13px", color: "#9ca3af" }}>No users found</div>}
                  </div>
                </div>
              ) : (
                <button className="ud-add-sup-btn" onClick={() => setAddingSupMode(true)}>+ Add supervisor</button>
              )}
            </div>

            {/* Subordinates */}
            <div className="ud-org-section">
              <div className="ud-org-section-title">
                Subordinates
                {subordinates.length > 0 && <span className="ud-org-count">{subordinates.length}</span>}
              </div>
              {subordinates.length === 0 ? (
                <p className="ud-empty-note">No subordinates</p>
              ) : subordinates.map(s => {
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
              })}
            </div>
          </div>
        </div>

        {/* Sağ sütun */}
        <div className="ud-content-right">
          {/* Storage Breakdown */}
          <div className="ud-detail-card">
            <div className="ud-detail-card-header">
              <span className="ud-detail-card-title">Storage Breakdown</span>
            </div>
            {storageLoading ? (
              <>
                <div className="ud-skeleton-bar" style={{ width: "60%" }} />
                <div className="ud-skeleton-bar" style={{ width: "40%" }} />
              </>
            ) : storage && storage.totalMb > 0 ? (
              <StorageDonut storage={storage} />
            ) : (
              <p className="ud-empty-note">No files uploaded</p>
            )}
          </div>

          {/* Security & Access */}
          <div className="ud-detail-card">
            <div className="ud-detail-card-header">
              <span className="ud-detail-card-title">Security & Access</span>
            </div>
            <div className="ud-info-row"><span className="ud-info-label">Last Login</span><span className="ud-info-value">{user.lastVisit ? formatRelativeTime(user.lastVisit) : "—"}</span></div>
            <div className="ud-info-row"><span className="ud-info-label">Pwd Changed</span><span className="ud-info-value">{formatRelativeTime(user.passwordChangedAt)}</span></div>
            <div className="ud-info-row">
              <span className="ud-info-label">Status</span>
              <span className="ud-info-value">
                <span className={`ud-status-dot-lg ${user.isActive ? "active" : "inactive"}`} style={{ display: "inline-block", marginRight: 6, verticalAlign: "middle" }} />
                {user.isActive ? "Active" : "Inactive"}
              </span>
            </div>

            <div className="ud-security-actions-divider">Actions</div>

            {/* Reset Password */}
            {!resetOpen ? (
              <button className="ud-security-action" onClick={() => setResetOpen(true)}>
                <div className="ud-security-action-icon key">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.78 7.78 5.5 5.5 0 0 1 7.78-7.78zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
                  </svg>
                </div>
                <span>Reset Password</span>
                <span style={{ marginLeft: "auto", color: "#9ca3af", fontSize: "12px" }}>→</span>
              </button>
            ) : (
              <form className="ud-pwd-form" onSubmit={handlePwdSave}>
                <input className="ud-pwd-input" type="password" placeholder="New password" value={newPwd} onChange={e => setNewPwd(e.target.value)} autoFocus />
                <input className="ud-pwd-input" type="password" placeholder="Confirm password" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} />
                {pwdError && <span className="ud-pwd-error">{pwdError}</span>}
                <div className="ud-pwd-actions">
                  <button className="ud-pwd-save-btn" type="submit" disabled={pwdSaving}>{pwdSaving ? "Saving..." : "Save"}</button>
                  <button className="ud-pwd-cancel-btn" type="button" onClick={() => { setResetOpen(false); setNewPwd(""); setConfirmPwd(""); setPwdError(""); }}>Cancel</button>
                </div>
              </form>
            )}

            {/* Deactivate/Activate */}
            <button className={`ud-security-action${user.isActive ? " danger" : ""}`} onClick={handleToggleStatus} disabled={toggling}>
              <div className={`ud-security-action-icon ${user.isActive ? "deactivate" : "activate"}`}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  {user.isActive
                    ? <><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></>
                    : <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></>
                  }
                </svg>
              </div>
              <span>{toggling ? "..." : user.isActive ? "Deactivate Account" : "Activate Account"}</span>
              <span style={{ marginLeft: "auto", color: "#9ca3af", fontSize: "12px" }}>→</span>
            </button>

            <div className="ud-security-actions-divider">Activity</div>
            <p className="ud-empty-note">Coming soon</p>
          </div>
        </div>
      </div>

      {/* ═══ PERMISSIONS ═══ */}
      {hasPermission("Permissions.Read") && (
        <div className="ud-permissions-section">
          <div className="ud-detail-card-header">
            <span className="ud-detail-card-title">Permissions</span>
          </div>
          {permLoading ? (
            <div className="ud-perm-modules-grid">
              {[1, 2, 3].map(i => <div key={i} className="ud-skeleton-bar" style={{ height: 120, borderRadius: 10 }} />)}
            </div>
          ) : modules.length === 0 ? (
            <p className="ud-empty-note">No permissions data available</p>
          ) : (
            <div className="ud-perm-modules-grid">
              {modules.map(mod => {
                const perms = mod.permissions ?? [];
                if (perms.length === 0) return null;
                const grantedCount = perms.filter(p => isGranted(p)).length;
                return (
                  <div key={mod.module} className="ud-perm-module-card">
                    <div className="ud-perm-module-card-header">
                      <span className="ud-perm-module-card-title">{mod.module}</span>
                      {grantedCount > 0 && <span className="ud-perm-granted-count">{grantedCount}/{perms.length}</span>}
                    </div>
                    {perms.map(permName => {
                      const granted = isGranted(permName);
                      const label = permName.split(".").pop();
                      return (
                        <div key={permName} className="ud-perm-toggle-row">
                          <span className="ud-perm-toggle-label">{label}</span>
                          <button className={`ud-toggle ${granted ? "on" : "off"}`}
                            onClick={() => canAssignPerm && handleTogglePerm(permName)}
                            disabled={!canAssignPerm}
                            aria-label={`Toggle ${permName}`}>
                            <span className="ud-toggle-knob" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══ DELETE MODAL ═══ */}
      {deleteConfirm && (
        <div className="ud-modal-backdrop" onClick={() => setDeleteConfirm(false)}>
          <div className="ud-modal" onClick={e => e.stopPropagation()}>
            <p className="ud-modal-title">Delete User</p>
            <p className="ud-modal-body">Are you sure you want to delete <strong>{name}</strong>? This only removes the account — messages and files are preserved.</p>
            <div className="ud-modal-actions">
              <button className="ud-modal-cancel" onClick={() => setDeleteConfirm(false)} disabled={deleting}>Cancel</button>
              <button className="ud-modal-confirm danger" onClick={handleDelete} disabled={deleting}>{deleting ? "Deleting..." : "Delete"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default UserDetailPage;
