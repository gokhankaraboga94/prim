import { FormEvent, useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { ADMIN_EMAIL, auth } from "../firebase";

export function AdminLogin() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await signInWithEmailAndPassword(auth, ADMIN_EMAIL, password);
    } catch {
      setError("Giriş reddedildi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-shell">
      <form className="admin-card" onSubmit={onSubmit}>
        <p className="join-kicker">Komuta</p>
        <h1>Admin girişi</h1>
        <p className="muted">Sadece yönetici hesabı kabul edilir.</p>
        <label htmlFor="admin-pass">Şifre</label>
        <input
          id="admin-pass"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button className="btn-gold" type="submit" disabled={busy}>
          {busy ? "Kontrol..." : "Giriş yap"}
        </button>
        {error && <p className="join-err">{error}</p>}
      </form>
    </div>
  );
}
