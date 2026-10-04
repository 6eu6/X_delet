"use client";
import { useState } from "react";

export default function Login() {
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
    if (r.ok) location.href = "/";
    else setErr((await r.json()).error || "خطأ");
  }
  return (
    <div className="wrap" style={{ maxWidth: 380, marginTop: "20vh" }}>
      <form className="card" onSubmit={submit}>
        <h1 style={{ marginBottom: 12 }}>مدير حساب X</h1>
        <label>كلمة المرور<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus /></label>
        {err && <p className="err">{err}</p>}
        <p><button type="submit">دخول</button></p>
      </form>
    </div>
  );
}
