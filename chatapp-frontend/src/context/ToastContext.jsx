// ─── ToastContext — Global Toast Notification Sistemi ────────────────────────
// .NET-dəki INotificationService kimi — istənilən komponentdən toast göstərmək üçün.
// Bitrix24/Telegram style: aşağı-sağda modern notification panel.
//
// İstifadəsi:
//   const { showToast } = useToast();
//   showToast("Mesaj silindi", "success");
//   showToast("Fayl tipi icazə verilmir", "error");
//   showToast("Fayl yüklənir...", "warning");

import { createContext, useContext, useState, useCallback, useRef } from "react";

// Context — bütün komponentlər buradan showToast funksiyasına çatır
const ToastContext = createContext(null);

// Custom hook — useToast() ilə kontekstə rahat giriş
// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

// Toast tipləri: success (yaşıl), error (qırmızı), warning (sarı), info (mavi)
// duration: toast neçə ms görünsün (default 4000ms)
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idCounter = useRef(0);
  // Timer ID-ləri saxla — unmount-da cleanup üçün
  const timersRef = useRef(new Map());

  // showToast — yeni toast əlavə et
  // message: göstəriləcək mətn
  // type: "success" | "error" | "warning" | "info"
  // duration: avtomatik bağlanma vaxtı (ms), 0 = bağlanmır
  const showToast = useCallback((message, type = "info", duration = 4000) => {
    const id = ++idCounter.current;
    setToasts((prev) => [...prev, { id, message, type, duration }]);

    // Avtomatik bağlanma — duration > 0 olduqda
    if (duration > 0) {
      const timerId = setTimeout(() => {
        timersRef.current.delete(id);
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
      timersRef.current.set(id, timerId);
    }
    return id;
  }, []);

  // removeToast — toast-u əl ilə bağla (X düyməsi üçün)
  const removeToast = useCallback((id) => {
    // Timer-i ləğv et — artıq lazım deyil
    const timerId = timersRef.current.get(id);
    if (timerId) {
      clearTimeout(timerId);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, removeToast }}>
      {children}
      {/* ToastContainer — toastları render edir */}
      {toasts.length > 0 && (
        <div className="toast-container">
          {toasts.map((t) => (
            <div key={t.id} className={`toast-item toast-${t.type}`}>
              <div className="toast-icon">
                {t.type === "success" && (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
                {t.type === "error" && (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" strokeWidth="2" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                )}
                {t.type === "warning" && (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" strokeWidth="2" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                )}
                {t.type === "info" && (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" strokeWidth="2" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                )}
              </div>
              <span className="toast-message">{t.message}</span>
              <button className="toast-close" onClick={() => removeToast(t.id)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
              {/* Progress bar — avtomatik bağlanma vizualı */}
              {t.duration > 0 && (
                <div
                  className="toast-progress"
                  style={{ animationDuration: `${t.duration}ms` }}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}
