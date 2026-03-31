// ─── App.jsx — Router + Auth Guard + Global TopNavbar + ProfilePanel ─────────
import { useContext, useState, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AuthContext, AuthProvider } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import TopNavbar from "./components/TopNavbar";
import UserProfilePanel from "./components/UserProfilePanel";
import Chat from "./pages/Chat";
import Login from "./pages/Login";
import AdminPanel from "./pages/AdminPanel";
import ComingSoon from "./pages/ComingSoon";
import ErrorBoundary from "./components/ErrorBoundary";

// ─── ProtectedRoute ───────────────────────────────────────────────────────────
function ProtectedRoute({ children, requireRole }) {
  const { user, isLoading } = useContext(AuthContext);

  if (isLoading) {
    return (
      <div className="app-loader">
        <div className="app-loader-ring">
          <svg className="app-loader-icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </div>
        <span className="app-loader-title">ChatApp</span>
        <div className="app-loader-dots">
          <span /><span /><span />
        </div>
        <style>{`
          .app-loader {
            display:flex; flex-direction:column; align-items:center; justify-content:center;
            height:100vh; background:#fff; gap:20px; user-select:none;
          }
          .app-loader-ring {
            width:88px; height:88px; border-radius:50%;
            background: linear-gradient(135deg, #063f7a 0%, #0a4a8a 50%, #2fc6f6 100%);
            display:flex; align-items:center; justify-content:center;
            animation: loaderPop 0.6s cubic-bezier(0.16,1,0.3,1);
            box-shadow: 0 8px 32px rgba(47,198,246,0.2);
          }
          .app-loader-icon { color:rgba(255,255,255,0.9); }
          .app-loader-title {
            font-size:22px; font-weight:600; color:#1f2937; letter-spacing:-0.5px;
            animation: loaderFade 0.5s cubic-bezier(0.16,1,0.3,1) 0.15s both;
          }
          .app-loader-dots {
            display:flex; gap:6px;
            animation: loaderFade 0.5s cubic-bezier(0.16,1,0.3,1) 0.3s both;
          }
          .app-loader-dots span {
            width:7px; height:7px; border-radius:50%; background:#2fc6f6;
            animation: loaderBounce 1.2s cubic-bezier(0.16,1,0.3,1) infinite;
          }
          .app-loader-dots span:nth-child(2) { animation-delay:0.15s; }
          .app-loader-dots span:nth-child(3) { animation-delay:0.3s; }
          @keyframes loaderPop {
            from { transform:scale(0.7); opacity:0; }
            to   { transform:scale(1);   opacity:1; }
          }
          @keyframes loaderFade {
            from { opacity:0; transform:translateY(8px); }
            to   { opacity:1; transform:translateY(0); }
          }
          @keyframes loaderBounce {
            0%,80%,100% { transform:scale(0.6); opacity:0.4; }
            40%         { transform:scale(1);   opacity:1; }
          }
        `}</style>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" />;

  if (requireRole && !requireRole.includes(user.role)) {
    return <Navigate to="/messages" />;
  }

  return children;
}

// ─── AuthenticatedLayout — TopNavbar + content + global ProfilePanel ─────────
function AuthenticatedLayout({ children }) {
  const { user } = useContext(AuthContext);
  const [profileUserId, setProfileUserId] = useState(null);

  // TopNavbar-dan "open-profile" event-i dinlə
  useEffect(() => {
    const handler = (e) => setProfileUserId(e.detail.userId);
    window.addEventListener("open-profile", handler);
    return () => window.removeEventListener("open-profile", handler);
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
      <TopNavbar />
      <div className="app-content">
        {children}
      </div>

      {/* Global ProfilePanel — bütün səhifələrdə işləyir */}
      {profileUserId && user && (
        <UserProfilePanel
          userId={profileUserId}
          currentUserId={user.id}
          isOwnProfile={profileUserId === user.id}
          onClose={() => setProfileUserId(null)}
          onStartChat={() => setProfileUserId(null)}
        />
      )}
    </div>
  );
}

// ─── App ─────────────────────────────────────────────────────────────────────
function App() {
  return (
    <ErrorBoundary>
    <ToastProvider>
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
    </ToastProvider>
    </ErrorBoundary>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      {/* / → /messages redirect */}
      <Route path="/" element={<Navigate to="/messages" replace />} />

      <Route path="/messages" element={
        <ProtectedRoute>
          <AuthenticatedLayout><Chat /></AuthenticatedLayout>
        </ProtectedRoute>
      } />

      <Route path="/feed" element={
        <ProtectedRoute>
          <AuthenticatedLayout><ComingSoon title="Feed" /></AuthenticatedLayout>
        </ProtectedRoute>
      } />

      <Route path="/drive" element={
        <ProtectedRoute>
          <AuthenticatedLayout><ComingSoon title="Drive" /></AuthenticatedLayout>
        </ProtectedRoute>
      } />

      <Route path="/settings" element={
        <ProtectedRoute>
          <AuthenticatedLayout><ComingSoon title="Settings" /></AuthenticatedLayout>
        </ProtectedRoute>
      } />

      <Route path="/admin" element={
        <ProtectedRoute requireRole={["Admin", "SuperAdmin"]}>
          <AuthenticatedLayout><AdminPanel /></AuthenticatedLayout>
        </ProtectedRoute>
      } />
      <Route path="/admin/:section" element={
        <ProtectedRoute requireRole={["Admin", "SuperAdmin"]}>
          <AuthenticatedLayout><AdminPanel /></AuthenticatedLayout>
        </ProtectedRoute>
      } />
      <Route path="/admin/users/:userId" element={
        <ProtectedRoute requireRole={["Admin", "SuperAdmin"]}>
          <AuthenticatedLayout><AdminPanel /></AuthenticatedLayout>
        </ProtectedRoute>
      } />
    </Routes>
  );
}

export default App;
