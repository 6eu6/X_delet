"use client";
import { useEffect, useState } from "react";
import { api, retry } from "@/lib/client";
import type { UserLite } from "@/lib/twitter";

export function DmTab({ prefill }: { prefill: string }) {
  const [name, setName] = useState(prefill);
  const [user, setUser] = useState<UserLite | null>(null);
  const [text, setText] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (prefill) { setName(prefill); setUser(null); } }, [prefill]);

  async function lookup() {
    setMsg(null); setBusy(true);
    try { setUser(await api<UserLite>(`/api/lookup?userName=${encodeURIComponent(name.replace(/^@/, ""))}`)); }
    catch (e) { setUser(null); setMsg({ ok: false, t: (e as Error).message }); }
    setBusy(false);
  }

  async function send() {
    if (!user) return;
    setBusy(true); setMsg(null);
    try { await retry(() => api("/api/dm", { userId: user.id, text })); setMsg({ ok: true, t: "تم الإرسال" }); setText(""); }
    catch (e) { setMsg({ ok: false, t: (e as Error).message }); }
    setBusy(false);
  }

  return (
    <div className="card">
      <h2>إرسال رسالة خاصة</h2>
      <div className="row" style={{ marginBottom: 10 }}>
        <input style={{ flex: 1 }} placeholder="@username" value={name} onChange={(e) => setName(e.target.value)} />
        <button onClick={lookup} disabled={busy || !name}>بحث</button>
      </div>
      {user && (
        <>
          <p><b>{user.name}</b> @{user.userName} {user.canDm === false && <span className="err">· لا يستقبل رسائل</span>}</p>
          <textarea rows={4} placeholder="نص الرسالة" value={text} onChange={(e) => setText(e.target.value)} />
          <p><button onClick={send} disabled={busy || !text.trim()}>إرسال</button></p>
        </>
      )}
      {msg && <p className={msg.ok ? "" : "err"}>{msg.t}</p>}
      <p className="note">الخدمة تدعم إرسال الرسائل فقط؛ لا يوجد endpoint لقراءة الرسائل الواردة أو حذف المحادثات. الإرسال ينجح فقط لمن فتح رسائله.</p>
    </div>
  );
}
