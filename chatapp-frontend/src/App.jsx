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

// ─── ProtectedRoute ───────────────────────────────────────────────────────────
// Bu bir "guard" komponentidir. Login olmayan istifadəçi Chat-a girə bilməsin deyə.
// .NET-də: [Authorize] attribute + middleware kimi işləyir.
//
// children prop — bu komponentin içinə yazılan JSX-dir.
// Məsələn: <ProtectedRoute><Chat /></ProtectedRoute> → children = <Chat />
function ProtectedRoute({ children }) {
  // AuthContext-dən cari user-i və loading state-ini al
  const { user, isLoading } = useContext(AuthContext);

  // Auth vəziyyəti hələ yoxlanılır (app yeni açılıb, /api/users/me çağırılır)
  // Bu zaman "Loading..." göstər — əks halda user null olduğu üçün /login-ə redirect olar
  if (isLoading) {
    return (
      <div
        style={{
          display: "flex",        // flexbox layout
          justifyContent: "center", // üfüqi mərkəzlə
          alignItems: "center",   // şaquli mərkəzlə
          height: "100vh",        // ekranın tam hündürlüyü
          color: "#6366F1",
          fontSize: "18px",
        }}
      >
        Loading...
      </div>
    );
  }

  // user yoxdur (login olmayıb) → /login-ə redirect et
  // Navigate komponenti render olaraq dərhal URL-i dəyişir
  if (!user) {
    return <Navigate to="/login" />;
  }

  // user var → children-i render et (yəni <Chat /> göstər)
  return children;
}

// ─── App ─────────────────────────────────────────────────────────────────────
// Bütün app-ın root komponentidir. main.jsx buradan başlayır.
function App() {
  return (
    // AuthProvider — bütün child komponentlər AuthContext-ə daxil ola bilsin deyə
    // Bu olmasa, useContext(AuthContext) hər yerdə undefined qaytarardı
    <ToastProvider>
    <AuthProvider>
      {/* Routes — yalnız URL-ə uyğun olan 1 Route render olunur */}
      <Routes>
        {/* /login URL-i → Login komponentini göstər */}
        <Route path="/login" element={<Login />} />

        {/* / (root) URL-i → ProtectedRoute içindəki Chat komponentini göstər */}
        {/* ProtectedRoute: əgər user yoxdursa /login-ə yönləndir */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Chat />
            </ProtectedRoute>
          }
        />
      </Routes>
    </AuthProvider>
    </ToastProvider>
  );
}

// default export — başqa fayllar import App from "./App" ilə idxal edə bilər
export default App;
