"use client";

import { FormEvent, useState } from "react";
import { Eye, EyeOff, LockKeyhole, Loader2, Stethoscope } from "lucide-react";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const payload = (await response.json()) as { error?: string; destination?: string };
      if (!response.ok) throw new Error(payload.error || "Kirish amalga oshmadi.");
      window.location.href = payload.destination || "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kirishda xatolik.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="login-brand"><div><Stethoscope /></div><span>Buxoro viloyati sog‘liqni saqlash boshqarmasi</span></div>
        <h1>KPI nazorat tizimiga kirish</h1>
        <p>Tizim hozircha faqat administrator uchun ochiq. Administrator login va parolini kiriting.</p>
        <form onSubmit={submit}>
          <label>Login<input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required /></label>
          <label>Parol<div className="password-field"><input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required /><button type="button" className="password-toggle" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Parolni yashirish" : "Parolni ko‘rsatish"} title={showPassword ? "Parolni yashirish" : "Parolni ko‘rsatish"}>{showPassword ? <EyeOff /> : <Eye />}</button></div></label>
          {error && <div className="login-error">{error}</div>}
          <button type="submit" disabled={loading}>{loading ? <Loader2 className="animate-spin" /> : <LockKeyhole />} Kirish</button>
        </form>
      </section>
    </main>
  );
}
