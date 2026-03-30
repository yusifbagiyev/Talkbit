import { useState, useContext, useEffect } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { AuthContext, useAuth } from "../context/AuthContext";
import CompanyManagement from "../components/admin/CompanyManagement";
import HierarchyView from "../components/admin/HierarchyView";
import DepartmentManagement from "../components/admin/DepartmentManagement";
import PositionManagement from "../components/admin/PositionManagement";
import UserDetailPage from "../components/admin/UserDetailPage";
import "./AdminPanel.css";

const SECTION_LABELS = {
  companies: "Companies",
  users: "Users",
  user_detail: "",
  departments: "Departments",
  positions: "Positions",
};

function AdminPanel() {
  const { user } = useContext(AuthContext);
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  const { section: urlSection, userId: urlUserId } = useParams();
  const location = useLocation();
  const isSuperAdmin = user?.role === "SuperAdmin";

  const validSections = isSuperAdmin
    ? ["companies", "users"]
    : ["users", "departments", "positions"];
  const defaultSection = isSuperAdmin ? "companies" : "users";

  // URL-dən alınan section (yoxlanılmış)
  const isUserDetailUrl = !!urlUserId;
  const urlActiveSection = isUserDetailUrl
    ? "users"
    : (urlSection && validSections.includes(urlSection) ? urlSection : defaultSection);

  // "out-fwd" | "in-fwd" | "out-back" | "in-back" | "out-fade" | "in-fade" | ""
  const [transition, setTransition] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  // subSection yalnız user_detail üçün — URL-dən sync olunur
  const [subSection, setSubSection] = useState(isUserDetailUrl ? "user_detail" : null);

  // URL-dəki userId dəyişəndə state-i sync et (refresh, browser back/forward)
  useEffect(() => {
    if (urlUserId) {
      setSubSection("user_detail");
      if (!selectedUser || selectedUser.id !== urlUserId) {
        setSelectedUser({ id: urlUserId, name: location.state?.userName ?? "" });
      }
    } else {
      setSubSection(null);
    }
  }, [urlUserId]); // eslint-disable-line react-hooks/exhaustive-deps

  // /admin (section yoxdur) → default section-a yönləndir
  useEffect(() => {
    if (!urlUserId && (!urlSection || !validSections.includes(urlSection))) {
      navigate(`/admin/${defaultSection}`, { replace: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Aktiv section: user_detail varsa o, yoxsa URL-dən
  const activeSection = subSection ?? urlActiveSection;

  const changeSection = (newSection) => {
    if (newSection === activeSection) return;
    const isDeeper = newSection === "user_detail";
    const isBack   = activeSection === "user_detail";
    const dir = isDeeper ? "fwd" : isBack ? "back" : "fade";
    setTransition(`out-${dir}`);
    setTimeout(() => {
      if (newSection === "user_detail") {
        setSubSection("user_detail");
        navigate(`/admin/users/${selectedUser?.id}`, { state: { userName: selectedUser?.name } });
      } else {
        setSubSection(null);
        setSelectedUser(null);
        navigate(`/admin/${newSection}`);
      }
      setTransition(`in-${dir}`);
      setTimeout(() => setTransition(""), 260);
    }, 160);
  };

  const openUserDetail = (userId, userName) => {
    setSelectedUser({ id: userId, name: userName });
    setTransition("out-fwd");
    setTimeout(() => {
      setSubSection("user_detail");
      navigate(`/admin/users/${userId}`, { state: { userName } });
      setTransition("in-fwd");
      setTimeout(() => setTransition(""), 260);
    }, 160);
  };

  // Breadcrumb üçün ad — local state və ya location.state-dən
  const userDetailName = selectedUser?.name || location.state?.userName || "User";

  return (
    <div className="ap-page">
      {/* ─── Header ──────────────────────────────────────────────────────────── */}
      <div className="ap-header">
        <button className="ap-back-btn" onClick={() => navigate("/")}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back to Chat
        </button>

        <div className="ap-breadcrumb">
          <span className="ap-breadcrumb-root">Admin</span>
          <span className="ap-breadcrumb-sep">›</span>
          {activeSection === "user_detail" ? (
            <>
              <button className="ap-breadcrumb-link" onClick={() => changeSection("users")}>
                Users
              </button>
              <span className="ap-breadcrumb-sep">›</span>
              <span key={userDetailName} className="ap-breadcrumb-page">
                {userDetailName}
              </span>
            </>
          ) : (
            <span key={activeSection} className="ap-breadcrumb-page">
              {SECTION_LABELS[activeSection]}
            </span>
          )}
        </div>

        <span className={`ap-role-badge ${user?.role?.toLowerCase()}`}>{user?.role}</span>
      </div>

      <div className="ap-body">
        {/* ─── Sidebar nav ─────────────────────────────────────────────────── */}
        <nav className="ap-nav">
          {/* Brand */}
          <div className="ap-nav-brand">
            <div className="ap-nav-brand-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </div>
            <span className="ap-nav-brand-label">Admin Panel</span>
          </div>

          {isSuperAdmin ? (
            <>
              <div className="ap-nav-group-label">Management</div>
              <button
                className={`ap-nav-item${activeSection === "companies" ? " active" : ""}`}
                onClick={() => changeSection("companies")}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="7" width="20" height="14" rx="2"/>
                  <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
                </svg>
                Companies
              </button>
              {hasPermission("Users.Read") && <button
                className={`ap-nav-item${activeSection === "users" || activeSection === "user_detail" ? " active" : ""}`}
                onClick={() => changeSection("users")}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
                Users
              </button>}
            </>
          ) : (
            <>
              <div className="ap-nav-group-label">People</div>
              {hasPermission("Users.Read") && <button
                className={`ap-nav-item${activeSection === "users" || activeSection === "user_detail" ? " active" : ""}`}
                onClick={() => changeSection("users")}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
                Users
              </button>}
              <div className="ap-nav-group-label">Organization</div>
              <button
                className={`ap-nav-item${activeSection === "departments" ? " active" : ""}`}
                onClick={() => changeSection("departments")}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                  <polyline points="9 22 9 12 15 12 15 22"/>
                </svg>
                Departments
              </button>
              <button
                className={`ap-nav-item${activeSection === "positions" ? " active" : ""}`}
                onClick={() => changeSection("positions")}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="7" width="20" height="14" rx="2"/>
                  <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
                  <line x1="12" y1="12" x2="12" y2="16"/>
                  <line x1="10" y1="14" x2="14" y2="14"/>
                </svg>
                Positions
              </button>
            </>
          )}
        </nav>

        {/* ─── Content ─────────────────────────────────────────────────────── */}
        <main className={`ap-content${transition ? ` ${transition}` : ""}`}>
          {activeSection === "companies"   && isSuperAdmin  && <CompanyManagement />}
          {activeSection === "users"                        && <HierarchyView isSuperAdmin={isSuperAdmin} onOpenUser={openUserDetail} />}
          {activeSection === "user_detail" && selectedUser  && <UserDetailPage userId={selectedUser.id} onDeleted={() => changeSection("users")} />}
          {activeSection === "departments" && !isSuperAdmin && <DepartmentManagement />}
          {activeSection === "positions"   && !isSuperAdmin && <PositionManagement />}
        </main>
      </div>
    </div>
  );
}

export default AdminPanel;
