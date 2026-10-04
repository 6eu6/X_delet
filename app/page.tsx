"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import type { UserLite } from "@/lib/twitter";
import { TweetsTab } from "@/components/TweetsTab";
import { NetworkTab } from "@/components/NetworkTab";
import { DmTab } from "@/components/DmTab";

type Tab = "tweets" | "followings" | "followers" | "dm";
const TABS: [Tab, string][] = [["tweets", "التغريدات"], ["followings", "أتابعهم"], ["followers", "المتابعون"], ["dm", "الرسائل"]];

export default function Home() {
  const [tab, setTab] = useState<Tab>("tweets");
  const [me, setMe] = useState<{ profile: UserLite; credits: number | null; cookieInEnv: boolean } | null>(null);
  const [err, setErr] = useState("");
  const [dmTo, setDmTo] = useState("");
  const [cookie, setCookie] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { api<typeof me>("/api/me").then(setMe).catch((e) => setErr(e.message)); }, []);

  async function relogin() {
    setBusy(true); setErr("");
    try { setCookie((await api<{ cookie: string }>("/api/session", {})).cookie); } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  }

  return (
    <div className="wrap">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div className="row">
          {me?.profile.profilePicture && /* eslint-disable-next-line @next/next/no-img-element */ <img className="avatar" src={me.profile.profilePicture} alt="" />}
          <div>
            <h1>{me ? `@${me.profile.userName}` : "مدير حساب X"}</h1>
            {me && <div className="meta">{me.profile.followers} متابع · {me.profile.following} يتابع · {me.profile.statusesCount} تغريدة{me.credits !== null && ` · الرصيد ${me.credits.toLocaleString()} credit`}</div>}
          </div>
        </div>
        <div className="row">
          <button className="sec" onClick={relogin} disabled={busy}>{busy ? "…" : "تسجيل دخول X"}</button>
          <button className="sec" onClick={async () => { await fetch("/api/auth", { method: "DELETE" }); location.href = "/login"; }}>خروج</button>
        </div>
      </div>
      {err && <p className="err">{err}</p>}
      {cookie && (
        <div className="card">
          <p className="note">تم تسجيل الدخول. للحفظ الدائم (وتفادي تكلفة تسجيل دخول جديد مع كل تشغيل بارد) ضع هذه القيمة في متغير Vercel باسم <code>X_LOGIN_COOKIE</code>:</p>
          <textarea readOnly rows={3} value={cookie} onFocus={(e) => e.target.select()} />
        </div>
      )}
      <div className="tabs">{TABS.map(([k, l]) => <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>)}</div>
      <div hidden={tab !== "tweets"}><TweetsTab /></div>
      <div hidden={tab !== "followings"}><NetworkTab kind="followings" onMessage={(u) => { setDmTo(u); setTab("dm"); }} /></div>
      <div hidden={tab !== "followers"}><NetworkTab kind="followers" onMessage={(u) => { setDmTo(u); setTab("dm"); }} /></div>
      <div hidden={tab !== "dm"}><DmTab prefill={dmTo} /></div>
    </div>
  );
}
