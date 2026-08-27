import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { AdminLogin } from "./AdminLogin";
import { AdminPage } from "./AdminPage";

export function AdminGate() {
  const { ready, user, isAdmin } = useAuth();

  if (!ready) {
    return (
      <div className="admin-shell">
        <p className="muted">Yükleniyor…</p>
      </div>
    );
  }

  if (!user) return <AdminLogin />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return <AdminPage />;
}
