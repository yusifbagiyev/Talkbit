import { useState, useEffect, useCallback, memo } from "react";
import { getCompanies, getCompany, createCompany, updateCompany, assignCompanyAdmin, getUsers, apiUpload } from "../../services/api";
import { useToast } from "../../context/ToastContext";
import { getFileUrl } from "../../services/api";
import { getInitials, getAvatarColor } from "../../utils/chatUtils";
import "./CompanyManagement.css";

// ─── CompanyForm — Create/Edit panel ─────────────────────────────────────────
const CompanyForm = memo(({ company, onSave, onClose }) => {
  const { showToast } = useToast();
  const [name, setName] = useState(company?.name || "");
  const [description, setDescription] = useState(company?.description || "");
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(company?.logoUrl ? getFileUrl(company.logoUrl) : null);
  const [saving, setSaving] = useState(false);

  const handleLogoChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    e.target.value = "";
    if (f.size === 0) { showToast(`"${f.name}" is empty (0 bytes)`, "error"); return; }
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); setLogoFile(f); setLogoPreview(URL.createObjectURL(f)); };
    img.onerror = () => { URL.revokeObjectURL(url); showToast(`"${f.name}" — corrupt or unreadable image`, "error"); };
    img.src = url;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) { showToast("Company name is required", "error"); return; }
    setSaving(true);
    try {
      let logoUrl = company?.logoUrl || null;
      if (logoFile) {
        const fd = new FormData();
        fd.append("File", logoFile);
        const res = await apiUpload("/api/files/upload", fd);
        if (res?.downloadUrl) logoUrl = res.downloadUrl;
      }
      const data = { name: name.trim(), description: description.trim(), ...(logoUrl ? { logoUrl } : {}) };
      if (company) {
        await updateCompany(company.id, data);
        showToast("Company updated", "success");
      } else {
        await createCompany(data);
        showToast("Company created", "success");
      }
      onSave();
    } catch (err) {
      showToast(err.message || "Failed to save company", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="cm-form-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="cm-form-panel">
        <div className="cm-form-header">
          <h2 className="cm-form-title">{company ? "Edit Company" : "New Company"}</h2>
          <button className="cm-form-close" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <form className="cm-form-body" onSubmit={handleSubmit}>
          {/* Logo */}
          <div className="cm-form-logo-row">
            <label className="cm-form-logo" title="Upload logo">
              {logoPreview
                ? <img src={logoPreview} alt="Logo" className="cm-form-logo-img" />
                : <span className="cm-form-logo-placeholder">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  </span>
              }
              <input type="file" accept="image/*" style={{ display: "none" }} onChange={handleLogoChange} />
            </label>
            <div className="cm-form-logo-hint">Click to upload logo (optional)</div>
          </div>

          {/* Fields */}
          <div className="cm-form-field">
            <label className="cm-form-label">Company Name *</label>
            <input className="cm-form-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. 166 Logistic" autoFocus />
          </div>
          <div className="cm-form-field">
            <label className="cm-form-label">Description</label>
            <textarea className="cm-form-textarea" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description..." rows={3} />
          </div>

          <div className="cm-form-actions">
            <button type="button" className="cm-btn cm-btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="cm-btn cm-btn-primary" disabled={saving}>
              {saving ? "Saving..." : (company ? "Save Changes" : "Create Company")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
});

// ─── AssignAdminModal ─────────────────────────────────────────────────────────
const AssignAdminModal = memo(({ company, onSave, onClose }) => {
  const { showToast } = useToast();
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getUsers({ pageSize: 100, companyId: company.id })
      .then((res) => setUsers(res?.items || res || []))
      .catch(() => showToast("Failed to load users", "error"))
      .finally(() => setLoading(false));
  }, [company.id]);

  const filtered = search.trim()
    ? users.filter((u) => u.fullName?.toLowerCase().includes(search.toLowerCase()))
    : users;

  const handleAssign = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await assignCompanyAdmin(company.id, selected.id);
      showToast(`${selected.fullName} assigned as admin`, "success");
      onSave();
    } catch (err) {
      showToast(err.message || "Failed to assign admin", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="cm-form-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="cm-form-panel cm-form-panel-sm">
        <div className="cm-form-header">
          <h2 className="cm-form-title">Assign Admin — {company.name}</h2>
          <button className="cm-form-close" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className="cm-form-body">
          <input className="cm-form-input" placeholder="Search users..." value={search} onChange={(e) => setSearch(e.target.value)} autoFocus />
          <div className="cm-user-list">
            {loading ? <div className="cm-empty">Loading...</div> : filtered.length === 0
              ? <div className="cm-empty">No users found</div>
              : filtered.map((u) => (
                <div key={u.id} className={`cm-user-row${selected?.id === u.id ? " selected" : ""}`} onClick={() => setSelected(u)}>
                  <div className="cm-user-avatar" style={{ background: u.avatarUrl ? "transparent" : getAvatarColor(u.fullName) }}>
                    {u.avatarUrl ? <img src={getFileUrl(u.avatarUrl)} alt="" /> : getInitials(u.fullName)}
                  </div>
                  <div className="cm-user-info">
                    <span className="cm-user-name">{u.fullName}</span>
                    <span className="cm-user-role">{u.role}</span>
                  </div>
                  {selected?.id === u.id && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--primary-color)" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                  )}
                </div>
              ))
            }
          </div>
          <div className="cm-form-actions">
            <button type="button" className="cm-btn cm-btn-ghost" onClick={onClose}>Cancel</button>
            <button className="cm-btn cm-btn-primary" disabled={!selected || saving} onClick={handleAssign}>
              {saving ? "Assigning..." : "Assign Admin"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

// ─── CompanyManagement ────────────────────────────────────────────────────────
function CompanyManagement() {
  const { showToast } = useToast();
  const [companies, setCompanies]     = useState([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState("");
  const [formOpen, setFormOpen]       = useState(false);
  const [editCompany, setEditCompany] = useState(null);
  const [assignModal, setAssignModal] = useState(null);
  const [menuOpen, setMenuOpen]       = useState(null);
  const [detail, setDetail]           = useState(null);   // CompanyDetailDto
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getCompanies({ pageSize: 100 });
      setCompanies(res?.items || res || []);
    } catch { showToast("Failed to load companies", "error"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openDetail = useCallback(async (company) => {
    setDetail({ ...company });
    setDetailLoading(true);
    try {
      const full = await getCompany(company.id);
      setDetail(full);
    } catch { /* list datası ilə qalır */ }
    finally { setDetailLoading(false); }
  }, []);

  // Edit formunu açmadan əvvəl tam məlumatı gətirir (description itməsin deyə)
  const openEdit = useCallback(async (company) => {
    setMenuOpen(null);
    try {
      const full = await getCompany(company.id);
      setEditCompany(full);
    } catch {
      setEditCompany(company);
    }
    setFormOpen(true);
  }, []);

  const handleDeactivate = async (company) => {
    setMenuOpen(null);
    try {
      await updateCompany(company.id, { isActive: !company.isActive });
      showToast(`Company ${company.isActive ? "deactivated" : "activated"}`, "success");
      load();
    } catch (err) { showToast(err.message || "Failed", "error"); }
  };

  const filtered = search.trim()
    ? companies.filter((c) => c.name?.toLowerCase().includes(search.toLowerCase()))
    : companies;

  return (
    <div className="cm-root">
      {/* Toolbar */}
      <div className="cm-toolbar">
        <div className="cm-toolbar-left">
          <h2 className="cm-section-title">Companies</h2>
          <span className="cm-count">{companies.length}</span>
        </div>
        <div className="cm-toolbar-right">
          <div className="cm-search-wrap">
            <svg className="cm-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input className="cm-search-input" placeholder="Search companies..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <button className="cm-btn cm-btn-primary" onClick={() => { setEditCompany(null); setFormOpen(true); }}>
            + New Company
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="cm-table-wrap">
        <table className="cm-table">
          <thead>
            <tr>
              <th>Company</th>
              <th>Description</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="cm-empty-cell">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={4} className="cm-empty-cell">No companies found</td></tr>
            ) : filtered.map((c) => (
              <tr
                key={c.id}
                className={!c.isActive ? "cm-row-inactive" : ""}
                onClick={() => openDetail(c)}
                style={{ cursor: "pointer" }}
              >
                <td>
                  <div className="cm-company-cell">
                    <div className="cm-company-logo" style={{ background: c.logoUrl ? "transparent" : getAvatarColor(c.name) }}>
                      {c.logoUrl ? <img src={getFileUrl(c.logoUrl)} alt="" /> : getInitials(c.name)}
                    </div>
                    <span className="cm-company-name">{c.name}</span>
                  </div>
                </td>
                <td className="cm-desc-cell">{c.description || <span className="cm-muted">—</span>}</td>
                <td>
                  <span className={`cm-status-badge ${c.isActive ? "active" : "inactive"}`}>
                    {c.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="cm-actions-cell" onClick={e => e.stopPropagation()}>
                  <div className="cm-menu-wrap">
                    <button className="cm-menu-btn" onClick={() => setMenuOpen(menuOpen === c.id ? null : c.id)}>•••</button>
                    {menuOpen === c.id && (
                      <>
                        <div className="cm-menu-overlay" onClick={() => setMenuOpen(null)} />
                        <div className="cm-menu">
                          <button className="cm-menu-item" onClick={() => openEdit(c)}>Edit</button>
                          <button className="cm-menu-item" onClick={() => { setMenuOpen(null); setAssignModal(c); }}>Assign Admin</button>
                          <button className={`cm-menu-item ${c.isActive ? "danger" : ""}`} onClick={() => handleDeactivate(c)}>
                            {c.isActive ? "Deactivate" : "Activate"}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modals */}
      {formOpen && (
        <CompanyForm
          company={editCompany}
          onSave={() => { setFormOpen(false); load(); }}
          onClose={() => setFormOpen(false)}
        />
      )}
      {assignModal && (
        <AssignAdminModal
          company={assignModal}
          onSave={() => { setAssignModal(null); load(); }}
          onClose={() => setAssignModal(null)}
        />
      )}

      {/* Detail Panel */}
      {detail && (
        <>
          <div className="cm-form-overlay" onClick={() => setDetail(null)} />
          <div className="cm-detail-panel">
            <div className="cm-form-header">
              <h3 className="cm-form-title">{detail.name}</h3>
              <button className="cm-form-close" onClick={() => setDetail(null)} aria-label="Close">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div className="cm-detail-body">
              {/* Logo + status */}
              <div className="cm-detail-logo-row">
                <div className="cm-detail-logo" style={{ background: detail.logoUrl ? "transparent" : getAvatarColor(detail.name) }}>
                  {detail.logoUrl
                    ? <img src={getFileUrl(detail.logoUrl)} alt="" className="cm-form-logo-img" />
                    : <span className="cm-detail-logo-initials">{getInitials(detail.name)}</span>}
                </div>
                <div>
                  <div className="cm-detail-name">{detail.name}</div>
                  <span className={`cm-status-badge ${detail.isActive ? "active" : "inactive"}`}>
                    {detail.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>

              <hr className="cm-detail-divider" />

              {/* Stats */}
              {!detailLoading && (
                <div className="cm-detail-stats">
                  <div className="cm-detail-stat-card">
                    <span className="cm-detail-stat-num">{detail.userCount ?? 0}</span>
                    <span className="cm-detail-stat-label">Users</span>
                  </div>
                  <div className="cm-detail-stat-card">
                    <span className="cm-detail-stat-num">{detail.departmentCount ?? "—"}</span>
                    <span className="cm-detail-stat-label">Departments</span>
                  </div>
                </div>
              )}

              {/* Company Admin */}
              {(detail.headOfCompanyName || detail.adminName) && (
                <div className="cm-form-field">
                  <label className="cm-form-label">Company Admin</label>
                  <div className="cm-detail-admin">
                    <div className="cm-user-avatar" style={{ background: getAvatarColor(detail.headOfCompanyName ?? detail.adminName ?? "") }}>
                      {getInitials(detail.headOfCompanyName ?? detail.adminName ?? "")}
                    </div>
                    <span className="cm-detail-admin-name">{detail.headOfCompanyName ?? detail.adminName}</span>
                  </div>
                </div>
              )}

              {/* Description */}
              <div className="cm-form-field">
                <label className="cm-form-label">Description</label>
                <p className="cm-detail-desc">
                  {detail.description || <span className="cm-muted">(not set)</span>}
                </p>
              </div>

              {/* Edit button */}
              <div className="cm-form-actions">
                <button
                  className="cm-btn cm-btn-primary"
                  onClick={() => { setDetail(null); openEdit(detail); }}
                >
                  Edit Company
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default memo(CompanyManagement);
