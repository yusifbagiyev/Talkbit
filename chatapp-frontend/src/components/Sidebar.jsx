import { memo } from "react";
import "./Sidebar.css";

// Sidebar komponenti — sol dar navigasiya paneli (60px en)
// Props:
//   onLogout — Chat.jsx-dən gəlir, logout button-una klikləndikdə çağırılır
// .NET ekvivalenti: MainLayout.razor-dakı sol NavMenu komponenti
function Sidebar({ onLogout }) {
  return (
    <aside className="sidebar">
      {/* Logo sahəsi — ən yuxarı chat ikonu */}
      <div className="sidebar-logo">
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="2"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </div>

      {/* nav — navigasiya düymələri qrupu */}
      <nav className="sidebar-nav">
        {/* Messages — aktiv (active class var) */}
        <button className="nav-item active" title="Messages" aria-label="Messages">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </button>

        {/* Contacts — TODO: onClick əlavə et, panel aç */}
        <button className="nav-item" title="Contacts" aria-label="Contacts">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </button>

        {/* Channels — TODO: onClick əlavə et, panel aç */}
        <button className="nav-item" title="Channels" aria-label="Channels">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M4 11a9 9 0 0 1 9 9" />
            <path d="M4 4a16 16 0 0 1 16 16" />
            <circle cx="5" cy="19" r="1" />
          </svg>
        </button>

        {/* Settings — TODO: onClick əlavə et, panel aç */}
        <button className="nav-item" title="Settings" aria-label="Settings">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
          </svg>
        </button>
      </nav>

      {/* sidebar-bottom — ən aşağı yerləşdirilmiş logout düyməsi */}
      <div className="sidebar-bottom">
        {/* onClick={onLogout} — prop olaraq gəlir (Chat.jsx-dən: logout funksiyası) */}
        {/* AuthContext.logout() çağırır → backend POST /api/auth/logout, state sıfırlanır */}
        <button className="nav-item" title="Logout" aria-label="Logout" onClick={onLogout}>
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
      </div>
    </aside>
  );
}

export default memo(Sidebar);
