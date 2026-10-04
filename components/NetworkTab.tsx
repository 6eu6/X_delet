"use client";
import { useMemo, useRef, useState } from "react";
import { api, fmtDate, retry, runQueue, Progress } from "@/lib/client";
import type { UserLite } from "@/lib/twitter";
import { ProgressBox } from "./ProgressBox";

type Kind = "followings" | "followers";
const num = (v: string) => (v === "" ? undefined : Number(v));

async function loadAll(kind: Kind, onPage: (n: number) => void, stop: { current: boolean }): Promise<UserLite[]> {
  const out: UserLite[] = []; let cursor = "", pages = 0;
  for (;;) {
    const r = await retry(() => api<{ users: UserLite[]; hasNext: boolean; cursor: string }>(`/api/users?kind=${kind}&cursor=${encodeURIComponent(cursor)}`));
    out.push(...r.users); onPage(++pages);
    if (!r.hasNext || !r.cursor || stop.current) break;
    cursor = r.cursor;
  }
  return out;
}

export function NetworkTab({ kind, onMessage }: { kind: Kind; onMessage: (userName: string) => void }) {
  const isFollowings = kind === "followings";
  const [users, setUsers] = useState<UserLite[]>([]);
  const [otherIds, setOtherIds] = useState<Set<string> | null>(null); // معرّفات القائمة الأخرى لحساب "لا يتابعني"
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [pages, setPages] = useState(0);
  const [prog, setProg] = useState<Progress | null>(null);
  const [err, setErr] = useState("");
  const [delay, setDelay] = useState(1500);
  const stop = useRef(false);

  const [q, setQ] = useState("");
  const [rel, setRel] = useState<"all" | "nonmutual">("all");
  const [noAvatar, setNoAvatar] = useState(false);
  const [minF, setMinF] = useState<number>(); const [maxF, setMaxF] = useState<number>();
  const [maxTweets, setMaxTweets] = useState<number>();
  const [before, setBefore] = useState(""); const [after, setAfter] = useState("");

  async function load() {
    setErr(""); setLoading(true); stop.current = false; setPages(0); setSel(new Set());
    try {
      setUsers(await loadAll(kind, setPages, stop));
      // لتحديد "لا يتابعني" نحتاج قائمة المتابعين أيضاً
      if (isFollowings) setOtherIds(new Set((await loadAll("followers", () => {}, stop)).map((u) => u.id)));
    } catch (e) { setErr((e as Error).message); }
    setLoading(false);
  }

  const shown = useMemo(() => users.filter((u) => {
    if (q && !`${u.userName} ${u.name} ${u.description}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (rel === "nonmutual" && otherIds?.has(u.id)) return false;
    if (noAvatar && u.profilePicture && !u.profilePicture.includes("default_profile")) return false;
    if (minF !== undefined && u.followers < minF) return false;
    if (maxF !== undefined && u.followers > maxF) return false;
    if (maxTweets !== undefined && u.statusesCount > maxTweets) return false;
    const c = Date.parse(u.createdAt);
    if (before && c >= Date.parse(before)) return false;
    if (after && c <= Date.parse(after)) return false;
    return true;
  }), [users, q, rel, noAvatar, minF, maxF, maxTweets, before, after, otherIds]);

  async function unfollowSel() {
    const ids = shown.filter((u) => sel.has(u.id)).map((u) => u.id);
    if (!ids.length || !confirm(`إلغاء متابعة ${ids.length} حساب؟`)) return;
    stop.current = false; setRunning(true);
    await runQueue(ids, (userId) => api("/api/users/unfollow", { userId }).then(() => undefined), {
      delay, stop, onProgress: setProg,
      onDone: (id) => { setUsers((o) => o.filter((u) => u.id !== id)); setSel((o) => { const n = new Set(o); n.delete(id); return n; }); },
    });
    setRunning(false);
  }

  const toggle = (id: string) => setSel((o) => { const n = new Set(o); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const busy = loading || running;

  return (
    <>
      <div className="card">
        <h2>{isFollowings ? "الحسابات التي أتابعها" : "المتابعون"}</h2>
        <div className="row"><button onClick={load} disabled={busy}>{loading ? `جارٍ التحميل… (${pages})` : "تحميل القائمة"}</button>
          {loading && <button className="sec" onClick={() => (stop.current = true)}>إيقاف</button>}
          {users.length > 0 && <span className="pill">{users.length} حساب</span>}</div>
        {!isFollowings && <p className="note">واجهة twitterapi.io لا توفّر حذف متابع (Remove follower) أو حظره، لذلك هذه القائمة للعرض والفلترة فقط.</p>}
        {err && <p className="err">{err}</p>}
      </div>

      {users.length > 0 && (
        <div className="card">
          <h2>فلاتر</h2>
          <div className="grid">
            <label>بحث (اسم/وصف)<input value={q} onChange={(e) => setQ(e.target.value)} /></label>
            {isFollowings && (
              <label>العلاقة
                <select value={rel} onChange={(e) => setRel(e.target.value as "all" | "nonmutual")}>
                  <option value="all">الكل</option><option value="nonmutual">لا يتابعونني</option>
                </select>
              </label>
            )}
            <label>متابعوه ≥<input type="number" min={0} onChange={(e) => setMinF(num(e.target.value))} /></label>
            <label>متابعوه ≤<input type="number" min={0} onChange={(e) => setMaxF(num(e.target.value))} /></label>
            <label>عدد تغريداته ≤<input type="number" min={0} onChange={(e) => setMaxTweets(num(e.target.value))} /></label>
            <label>أُنشئ قبل<input type="date" value={before} onChange={(e) => setBefore(e.target.value)} /></label>
            <label>أُنشئ بعد<input type="date" value={after} onChange={(e) => setAfter(e.target.value)} /></label>
            <label className="row" style={{ flexDirection: "row", alignItems: "center", paddingTop: 18 }}>
              <input type="checkbox" style={{ width: "auto" }} checked={noAvatar} onChange={(e) => setNoAvatar(e.target.checked)} /> بدون صورة شخصية
            </label>
            {isFollowings && <label>التأخير (مللي ثانية)<input type="number" value={delay} onChange={(e) => setDelay(Number(e.target.value))} /></label>}
          </div>
        </div>
      )}

      <ProgressBox p={prog} running={running} onStop={() => (stop.current = true)} />

      {users.length > 0 && (
        <div className="card">
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
            <span>المعروض {shown.length} · المحدد {sel.size}</span>
            {isFollowings && (
              <div className="row">
                <button className="sec" onClick={() => setSel(new Set(shown.map((u) => u.id)))}>تحديد المعروض</button>
                <button className="sec" onClick={() => setSel(new Set())}>إلغاء</button>
                <button className="danger" disabled={busy || !sel.size} onClick={unfollowSel}>إلغاء متابعة ({sel.size})</button>
              </div>
            )}
          </div>
          <div className="list">
            {shown.map((u) => (
              <div key={u.id} className="item">
                {isFollowings && <input type="checkbox" checked={sel.has(u.id)} onChange={() => toggle(u.id)} />}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="avatar" src={u.profilePicture} alt="" />
                <div className="body">
                  <div><b>{u.name}</b> <a href={`https://x.com/${u.userName}`} target="_blank" rel="noreferrer">@{u.userName}</a>
                    {isFollowings && otherIds && !otherIds.has(u.id) && <span className="pill" style={{ marginInlineStart: 6 }}>لا يتابعك</span>}</div>
                  <div className="meta">{u.followers} متابع · {u.statusesCount} تغريدة · منذ {fmtDate(u.createdAt)}</div>
                  <div className="meta">{u.description}</div>
                </div>
                <button className="sec" onClick={() => onMessage(u.userName)}>✉</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
