// ─── App.jsx — Router + Auth Guard ──────────────────────────────────────────
//   1. AuthProvider — global auth state-i bütün komponentlərə verir
//   2. Routes — URL-ə görə hansı komponentin render olacağını təyin edir
//   3. ProtectedRoute — login olmayan istifadəçini /login-ə yönləndirir

// useContext: istənilən komponentdən context-ə daxil olmaq üçün hook
import { useContext } from "react";

// Routes: bütün Route-ları əhatə edən wrapper
import { Routes, Route, Navigate } from "react-router-dom";

// AuthContext — global auth state (user, isLoading, login, logout)
// AuthProvider — həmin state-i bütün child komponentlərə distribute edir
import { AuthContext, AuthProvider } from "./context/AuthContext";
// ToastProvider — global toast notification sistemi (alert() əvəzinə)
import { ToastProvider } from "./context/ToastContext";
import Chat from "./pages/Chat";
import Login from "./pages/Login";
import AdminPanel from "./pages/AdminPanel";
import ErrorBoundary from "./components/ErrorBoundary";

// ─── ProtectedRoute ───────────────────────────────────────────────────────────
// Bu bir "guard" komponentidir. Login olmayan istifadəçi Chat-a girə bilməsin deyə.
// .NET-də: [Authorize] attribute + middleware kimi işləyir.
//
// children prop — bu komponentin içinə yazılan JSX-dir.
// Məsələn: <ProtectedRoute><Chat /></ProtectedRoute> → children = <Chat />
function ProtectedRoute({ children, requireRole }) {
  // AuthContext-dən cari user-i və loading state-ini al
  const { user, isLoading } = useContext(AuthContext);

  // Auth vəziyyəti hələ yoxlanılır (app yeni açılıb, /api/users/me çağırılır)
  if (isLoading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          color: "#6366F1",
          fontSize: "18px",
        }}
      >
        Loading...
      </div>
    );
  }

  // user yoxdur (login olmayıb) → /login-ə redirect et
  if (!user) return <Navigate to="/login" />;

  // requireRole var amma user-in rolu uyğun deyil → ana səhifəyə yönləndir
  if (requireRole && !requireRole.includes(user.role)) {
    return <Navigate to="/" />;
  }

  return children;
}

// ─── App ─────────────────────────────────────────────────────────────────────
// Bütün app-ın root komponentidir. main.jsx buradan başlayır.
function App() {
  return (
    // AuthProvider — bütün child komponentlər AuthContext-ə daxil ola bilsin deyə
    // Bu olmasa, useContext(AuthContext) hər yerdə undefined qaytarardı
    <ErrorBoundary>
    <ToastProvider>
    <AuthProvider>
      {/* Routes — yalnız URL-ə uyğun olan 1 Route render olunur */}
      <Routes>
        {/* /login URL-i → Login komponentini göstər */}
        <Route path="/login" element={<Login />} />

        {/* / (root) URL-i → ProtectedRoute içindəki Chat komponentini göstər */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Chat />
            </ProtectedRoute>
          }
        />

        {/* /admin — yalnız Admin və SuperAdmin üçün */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute requireRole={["Admin", "SuperAdmin"]}>
              <AdminPanel />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/:section"
          element={
            <ProtectedRoute requireRole={["Admin", "SuperAdmin"]}>
              <AdminPanel />
            </ProtectedRoute>
          }
        />
      </Routes>
    </AuthProvider>
    </ToastProvider>
    </ErrorBoundary>
  );
}

// default export — başqa fayllar import App from "./App" ilə idxal edə bilər
export default App;
