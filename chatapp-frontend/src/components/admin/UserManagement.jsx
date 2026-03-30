import { useState, useEffect, useCallback, memo } from "react";
import {
  getUsers, createUser, updateUser,
  activateUser, deactivateUser, adminChangePassword,
  getDepartments, getPositionsByDepartment,
  getSupervisors, addSupervisor, removeSupervisor,
  getFileUrl,
} from "../../services/api";
import { getInitials, getAvatarColor } from "../../utils/chatUtils";
import { useToast } from "../../context/ToastContext";
import "./UserManagement.css";

// ─── UserForm — Create/Edit slide panel ──────────────────────────────────────
const UserForm = memo(({ user: editUser, isSuperAdmin, onSave, onClose }) => {
  const { showToast } = useToast();
  const isNew = !editUser;

  const [firstName, setFirstName]     = useState(editUser?.firstName || "");
  const [lastName, setLastName]       = useState(editUser?.lastName || "");
  const [email, setEmail]             = useState(editUser?.email || "");
  const [password, setPassword]       = useState("");
  const [role, setRole]               = useState(editUser?.role || "User");
  const [departmentId, setDepartmentId] = useState(editUser?.departmentId || "");
  const [positionId, setPositionId]   = useState(editUser?.positionId || "");
  const [departments, setDepartments] = useState([]);
  const [positions, setPositions]     = useState([]);
  const [saving, setSaving]           = useState(false);

  useEffect(() => {
    getDepartments().then(setDepartments).catch(() => {});
  }, []);

  useEffect(() => {
    if (!departmentId) { setPositions([]); return; }
    getPositionsByDepartment(departmentId).then(setPositions).catch(() => {});
  }, [departmentId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      showToast("First name, last name and email are required", "error");
      return;
    }
    if (isNew && !password.trim()) {
      showToast("Password is required for new users", "error");
      return;
    }
    setSaving(true);
    try {
      const data = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        role,
        ...(departmentId ? { departmentId } : {}),
        ...(positionId   ? { positionId }   : {}),
        ...(isNew        ? { password }      : {}),
      };
      if (isNew) {
        await createUser(data);
        showToast("User created", "success");
      } else {
        await updateUser(editUser.id, data);
        showToast("User updated", "success");
      }
      onSave();
    } catch (err) {
      showToast(err.message || "Failed to save user", "error");
    } finally {
      setSaving(false);
    }
  };

  // Role options — SuperAdmin yalnız seed datadan yaranır
  const roleOptions = isSuperAdmin
    ? ["User", "Admin"]
    : ["User"];

  return (
    <div className="um-form-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="um-form-panel">
        <div className="um-form-header">
          <h2 className="um-form-title">{isNew ? "New User" : `Edit — ${editUser.fullName}`}</h2>
          <button className="um-form-close" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <form className="um-form-body" onSubmit={handleSubmit}>
          <div className="um-form-row">
            <div className="um-form-field">
              <label className="um-form-label">First Name *</label>
              <input className="um-form-input" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First name" autoFocus />
            </div>
            <div className="um-form-field">
              <label className="um-form-label">Last Name *</label>
              <input className="um-form-input" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last name" />
            </div>
          </div>
          <div className="um-form-field">
            <label className="um-form-label">Email *</label>
            <input className="um-form-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@company.com" />
          </div>
          {isNew && (
            <div className="um-form-field">
              <label className="um-form-label">Password *</label>
              <input className="um-form-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimum 6 characters" />
            </div>
          )}
          <div className="um-form-row">
            <div className="um-form-field">
              <label className="um-form-label">Department</label>
              <select className="um-form-select" value={departmentId} onChange={(e) => { setDepartmentId(e.target.value); setPositionId(""); }}>
                <option value="">— Select —</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className="um-form-field">
              <label className="um-form-label">Position</label>
              <select className="um-form-select" value={positionId} onChange={(e) => setPositionId(e.target.value)} disabled={!departmentId}>
                <option value="">— Select —</option>
                {positions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>
          <div className="um-form-field">
            <label className="um-form-label">Role</label>
            <select className="um-form-select" value={role} onChange={(e) => setRole(e.target.value)}>
              {roleOptions.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          <div className="um-form-actions">
            <button type="button" className="um-btn um-btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="um-btn um-btn-primary" disabled={saving}>
              {saving ? "Saving..." : (isNew ? "Create User" : "Save Changes")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
});

// ─── ResetPasswordModal ───────────────────────────────────────────────────────
const ResetPasswordModal = memo(({ user: targetUser, onClose }) => {
  const { showToast } = useToast();
  const [newPw, setNewPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newPw.trim()) { showToast("New password is required", "error"); return; }
    if (newPw !== confirm) { showToast("Passwords do not match", "error"); return; }
    setSaving(true);
    try {
      await adminChangePassword(targetUser.id, newPw, confirm);
      showToast("Password reset successfully", "success");
      onClose();
    } catch (err) {
      showToast(err.message || "Failed to reset password", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="um-form-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="um-form-panel um-form-panel-sm">
        <div className="um-form-header">
          <h2 className="um-form-title">Reset Password — {targetUser.fullName}</h2>
          <button className="um-form-close" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <form className="um-form-body" onSubmit={handleSubmit}>
          <div className="um-form-field">
            <label className="um-form-label">New Password</label>
            <input className="um-form-input" type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="Minimum 6 characters" autoFocus />
          </div>
          <div className="um-form-field">
            <label className="um-form-label">Confirm Password</label>
            <input className="um-form-input" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Repeat password" />
          </div>
          <div className="um-form-actions">
            <button type="button" className="um-btn um-btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="um-btn um-btn-primary" disabled={saving}>{saving ? "Saving..." : "Reset Password"}</button>
          </div>
        </form>
      </div>
    </div>
  );
});

// ─── SupervisorsModal ─────────────────────────────────────────────────────────
const SupervisorsModal = memo(({ user: targetUser, onClose }) => {
  const { showToast } = useToast();
  const [supervisors, setSupervisors] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const loadSupervisors = useCallback(async () => {
    try {
      const [svs, users] = await Promise.all([
        getSupervisors(targetUser.id),
        getUsers({ pageSize: 200 }),
      ]);
      setSupervisors(svs || []);
      setAllUsers(users?.items || users || []);
    } catch { showToast("Failed to load data", "error"); }
    finally { setLoading(false); }
  }, [targetUser.id, showToast]);

  useEffect(() => { loadSupervisors(); }, [loadSupervisors]);

  const supervisorIds = new Set(supervisors.map((s) => s.id));

  const handleAdd = async (u) => {
    try {
      await addSupervisor(targetUser.id, u.id);
      setSupervisors((prev) => [...prev, u]);
      showToast(`${u.fullName} added as supervisor`, "success");
    } catch (err) { showToast(err.message || "Failed", "error"); }
  };

  const handleRemove = async (supervisorId) => {
    try {
      await removeSupervisor(targetUser.id, supervisorId);
      setSupervisors((prev) => prev.filter((s) => s.id !== supervisorId));
      showToast("Supervisor removed", "success");
    } catch (err) { showToast(err.message || "Failed", "error"); }
  };

  const candidates = allUsers.filter(
    (u) => u.id !== targetUser.id && !supervisorIds.has(u.id) &&
      (!search.trim() || u.fullName?.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="um-form-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="um-form-panel um-form-panel-md">
        <div className="um-form-header">
          <h2 className="um-form-title">Supervisors — {targetUser.fullName}</h2>
          <button className="um-form-close" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className="um-form-body">
          {loading ? <div className="um-empty">Loading...</div> : (
            <>
              {/* Current supervisors */}
              {supervisors.length > 0 && (
                <div className="um-supervisors-section">
                  <div className="um-supervisors-label">Current Supervisors</div>
                  {supervisors.map((s) => (
                    <div key={s.id} className="um-supervisor-row">
                      <div className="um-user-avatar-sm" style={{ background: s.avatarUrl ? "transparent" : getAvatarColor(s.fullName) }}>
                        {s.avatarUrl ? <img src={getFileUrl(s.avatarUrl)} alt="" /> : getInitials(s.fullName)}
                      </div>
                      <span className="um-supervisor-name">{s.fullName}</span>
                      <button className="um-remove-btn" onClick={() => handleRemove(s.id)} title="Remove">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add supervisor */}
              <div className="um-supervisors-label">Add Supervisor</div>
              <input className="um-form-input" placeholder="Search users..." value={search} onChange={(e) => setSearch(e.target.value)} />
              <div className="um-user-pick-list">
                {candidates.length === 0
                  ? <div className="um-empty">No users found</div>
                  : candidates.slice(0, 20).map((u) => (
                    <div key={u.id} className="um-user-pick-row" onClick={() => handleAdd(u)}>
                      <div className="um-user-avatar-sm" style={{ background: u.avatarUrl ? "transparent" : getAvatarColor(u.fullName) }}>
                        {u.avatarUrl ? <img src={getFileUrl(u.avatarUrl)} alt="" /> : getInitials(u.fullName)}
                      </div>
                      <div className="um-user-info-sm">
                        <span>{u.fullName}</span>
                        <span className="um-user-dept">{u.departmentName || ""}</span>
                      </div>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--primary-color)" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    </div>
                  ))
                }
              </div>
            </>
          )}
          <div className="um-form-actions">
            <button className="um-btn um-btn-primary" onClick={onClose}>Done</button>
          </div>
        </div>
      </div>
    </div>
  );
});

// ─── UserManagement ───────────────────────────────────────────────────────────
function UserManagement({ isSuperAdmin }) {
  const { showToast } = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [departments, setDepartments] = useState([]);
  const [filterDept, setFilterDept] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [resetPwUser, setResetPwUser] = useState(null);
  const [supervisorUser, setSupervisorUser] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const PAGE_SIZE = 30;

  useEffect(() => { getDepartments().then(setDepartments).catch(() => {}); }, []);

  const load = useCallback(async (pageNum = 1) => {
    setLoading(true);
    try {
      const params = { pageNumber: pageNum, pageSize: PAGE_SIZE };
      if (search.trim()) params.searchTerm = search.trim();
      if (filterDept)    params.departmentId = filterDept;
      if (filterStatus !== "") params.isActive = filterStatus === "active";
      const res = await getUsers(params);
      const items = res?.items || res || [];
      setUsers(pageNum === 1 ? items : (prev) => [...prev, ...items]);
      setHasMore(items.length === PAGE_SIZE);
      setPage(pageNum);
    } catch { showToast("Failed to load users", "error"); }
    finally { setLoading(false); }
  }, [search, filterDept, filterStatus, showToast]);

  useEffect(() => { load(1); }, [load]);

  const handleToggleActive = async (u) => {
    try {
      u.isActive ? await deactivateUser(u.id) : await activateUser(u.id);
      showToast(`User ${u.isActive ? "deactivated" : "activated"}`, "success");
      load(1);
    } catch (err) { showToast(err.message || "Failed", "error"); }
  };

  const ROLE_COLORS = { SuperAdmin: "superadmin", Admin: "admin", User: "user" };

  return (
    <div className="um-root">
      {/* Toolbar */}
      <div className="um-toolbar">
        <div className="um-toolbar-left">
          <h2 className="um-section-title">Users</h2>
          <span className="um-count">{users.length}{hasMore ? "+" : ""}</span>
        </div>
        <div className="um-toolbar-right">
          <div className="um-search-wrap">
            <svg className="um-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input className="um-search-input" placeholder="Search users..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className="um-filter-select" value={filterDept} onChange={(e) => setFilterDept(e.target.value)}>
            <option value="">All Departments</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <select className="um-filter-select" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <button className="um-btn um-btn-primary" onClick={() => { setEditUser(null); setFormOpen(true); }}>
            + New User
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="um-table-wrap">
        <table className="um-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Department</th>
              <th>Position</th>
              <th>Role</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && users.length === 0 ? (
              <tr><td colSpan={6} className="um-empty-cell">Loading...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={6} className="um-empty-cell">No users found</td></tr>
            ) : users.map((u) => (
              <tr key={u.id} className={`um-row${!u.isActive ? " um-row-inactive" : ""}`}>
                <td>
                  <div className="um-user-cell">
                    <div className="um-avatar" style={{ background: u.avatarUrl ? "transparent" : getAvatarColor(u.fullName) }}>
                      {u.avatarUrl ? <img src={getFileUrl(u.avatarUrl)} alt="" className="um-avatar-img" /> : getInitials(u.fullName)}
                    </div>
                    <div className="um-user-meta">
                      <span className="um-user-name">{u.fullName}</span>
                      <span className="um-user-email">{u.email}</span>
                    </div>
                  </div>
                </td>
                <td className="um-cell-muted">{u.departmentName || "—"}</td>
                <td className="um-cell-muted">{u.positionName || "—"}</td>
                <td>
                  <span className={`um-role-badge ${ROLE_COLORS[u.role] || "user"}`}>{u.role}</span>
                </td>
                <td>
                  <span className={`um-status-badge ${u.isActive ? "active" : "inactive"}`}>
                    {u.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="um-actions-cell">
                  <div className="um-row-actions">
                    <button className="um-action-btn" title="Edit" onClick={() => { setEditUser(u); setFormOpen(true); }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button className="um-action-btn" title="Supervisors" onClick={() => setSupervisorUser(u)}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                    </button>
                    <button className="um-action-btn" title="Reset Password" onClick={() => setResetPwUser(u)}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="15" r="5"/><line x1="11.54" y1="11.54" x2="18" y2="5"/><line x1="15" y1="5" x2="20" y2="10"/></svg>
                    </button>
                    <button className={`um-action-btn${u.isActive ? " danger" : ""}`} title={u.isActive ? "Deactivate" : "Activate"} onClick={() => handleToggleActive(u)}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {hasMore && (
          <div className="um-load-more">
            <button className="um-btn um-btn-ghost" onClick={() => load(page + 1)} disabled={loading}>
              {loading ? "Loading..." : "Load More"}
            </button>
          </div>
        )}
      </div>

      {/* Modals */}
      {formOpen && (
        <UserForm
          user={editUser}
          isSuperAdmin={isSuperAdmin}
          onSave={() => { setFormOpen(false); load(1); }}
          onClose={() => setFormOpen(false)}
        />
      )}
      {resetPwUser && (
        <ResetPasswordModal user={resetPwUser} onClose={() => setResetPwUser(null)} />
      )}
      {supervisorUser && (
        <SupervisorsModal user={supervisorUser} onClose={() => setSupervisorUser(null)} />
      )}
    </div>
  );
}

export default memo(UserManagement);
