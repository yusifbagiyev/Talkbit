import { useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import CompanyManagement from "../components/admin/CompanyManagement";
import HierarchyView from "../components/admin/HierarchyView";
import DepartmentManagement from "../components/admin/DepartmentManagement";
import PositionManagement from "../components/admin/PositionManagement";
import "./AdminPanel.css";

function AdminPanel() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const isSuperAdmin = user?.role === "SuperAdmin";

  const [activeSection, setActiveSection] = useState(
    isSuperAdmin ? "companies" : "users"
  );

  return (
    <div className="ap-page">
      {/* Header */}
      <div className="ap-header">
        <button className="ap-back-btn" onClick={() => navigate("/")}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back to Chat
        </button>
        <h1 className="ap-title">Admin Panel</h1>
        <span className={`ap-role-badge ${user?.role?.toLowerCase()}`}>{user?.role}</span>
      </div>

      <div className="ap-body">
        {/* Sol navigasiya */}
        <nav className="ap-nav">
          {/* SuperAdmin only */}
          {isSuperAdmin && (
            <button
              className={`ap-nav-item${activeSection === "companies" ? " active" : ""}`}
              onClick={() => setActiveSection("companies")}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="7" width="20" height="14" rx="2" />
                <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
              </svg>
              Companies
            </button>
          )}

          {/* Hər iki rol */}
          <button
            className={`ap-nav-item${activeSection === "users" ? " active" : ""}`}
            onClick={() => setActiveSection("users")}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            Users
          </button>

          {/* Admin only */}
          {!isSuperAdmin && (
            <>
              <button
                className={`ap-nav-item${activeSection === "departments" ? " active" : ""}`}
                onClick={() => setActiveSection("departments")}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
                Departments
              </button>
              <button
                className={`ap-nav-item${activeSection === "positions" ? " active" : ""}`}
                onClick={() => setActiveSection("positions")}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="7" width="20" height="14" rx="2" />
                  <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
                  <line x1="12" y1="12" x2="12" y2="16" />
                  <line x1="10" y1="14" x2="14" y2="14" />
                </svg>
                Positions
              </button>
            </>
          )}
        </nav>

        {/* Content */}
        <main className="ap-content">
          {activeSection === "companies" && isSuperAdmin && <CompanyManagement />}
          {activeSection === "users" && <HierarchyView isSuperAdmin={isSuperAdmin} />}
          {activeSection === "departments" && !isSuperAdmin && <DepartmentManagement />}
          {activeSection === "positions" && !isSuperAdmin && <PositionManagement />}
        </main>
      </div>
    </div>
  );
}

export default AdminPanel;
