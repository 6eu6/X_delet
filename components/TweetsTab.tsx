"use client";
import { useRef, useState } from "react";
import { api, fmtDate, retry, runQueue, Progress } from "@/lib/client";
import { defaultFilters, TweetFilters } from "@/lib/filters";
import type { TweetLite } from "@/lib/twitter";
import { ProgressBox } from "./ProgressBox";

const num = (v: string) => (v === "" ? undefined : Number(v));

export function TweetsTab() {
  const [f, setF] = useState<TweetFilters>(defaultFilters);
  const [tweets, setTweets] = useState<TweetLite[]>([]);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [scanning, setScanning] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [prog, setProg] = useState<Progress | null>(null);
  const [err, setErr] = useState("");
  const [delay, setDelay] = useState(1500);
  const [scanned, setScanned] = useState(0);
  const stop = useRef(false);

  const set = <K extends keyof TweetFilters>(k: K, v: TweetFilters[K]) => setF((o) => ({ ...o, [k]: v }));

  async function scan() {
    setErr(""); setTweets([]); setSel(new Set()); setScanned(0); setProg(null);
    stop.current = false; setScanning(true);
    let cursor = ""; const seen = new Set<string>(); let pages = 0, empty = 0;
    try {
      for (;;) {
        const r = await retry(() => api<{ tweets: TweetLite[]; hasNext: boolean; cursor: string }>("/api/tweets", { filters: f, cursor }));
        const fresh = r.tweets.filter((t) => !seen.has(t.id));
        fresh.forEach((t) => seen.add(t.id));
        setTweets((o) => [...o, ...fresh]);
        setSel((o) => new Set([...o, ...fresh.map((t) => t.id)]));
        setScanned(++pages);
        empty = r.tweets.length === 0 ? empty + 1 : 0;
        if (!r.hasNext || !r.cursor || stop.current || empty >= 5) break;
      }
    } catch (e) { setErr((e as Error).message); }
    setScanning(false);
  }

  async function del() {
    const ids = tweets.filter((t) => sel.has(t.id)).map((t) => t.id);
    if (!ids.length) return;
    if (!confirm(`سيتم حذف ${ids.length} تغريدة نهائياً. هل أنت متأكد؟`)) return;
    stop.current = false; setDeleting(true); setErr("");
    await runQueue(ids, (id) => api("/api/tweets/delete", { id }).then(() => undefined), {
      delay, stop, onProgress: setProg,
      onDone: (id) => { setTweets((o) => o.filter((t) => t.id !== id)); setSel((o) => { const n = new Set(o); n.delete(id); return n; }); },
    });
    setDeleting(false);
  }

  const toggle = (id: string) => setSel((o) => { const n = new Set(o); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const busy = scanning || deleting;

  return (
    <>
      <div className="card">
        <h2>الفلاتر</h2>
        <div className="grid">
          <label>المصدر
            <select value={f.source} onChange={(e) => set("source", e.target.value as TweetFilters["source"])}>
              <option value="search">بحث متقدّم (يصل للتغريدات القديمة)</option>
              <option value="timeline">الخط الزمني (آخر التغريدات)</option>
            </select>
          </label>
          <label>من تاريخ<input type="date" value={f.from ?? ""} onChange={(e) => set("from", e.target.value || undefined)} /></label>
          <label>إلى تاريخ<input type="date" value={f.to ?? ""} onChange={(e) => set("to", e.target.value || undefined)} /></label>
          <label>تحتوي على كلمة<input value={f.keyword ?? ""} onChange={(e) => set("keyword", e.target.value)} /></label>
          <label>لا تحتوي على (مفصولة بمسافة)<input value={f.exclude ?? ""} onChange={(e) => set("exclude", e.target.value)} /></label>
          <label>الردود
            <select value={f.replies} onChange={(e) => set("replies", e.target.value as TweetFilters["replies"])}>
              <option value="include">تضمين</option><option value="exclude">استبعاد</option><option value="only">الردود فقط</option>
            </select>
          </label>
          <label>إعادة التغريد
            <select value={f.retweets} onChange={(e) => set("retweets", e.target.value as TweetFilters["retweets"])}>
              <option value="include">تضمين</option><option value="exclude">استبعاد</option><option value="only">فقط</option>
            </select>
          </label>
          <label>الوسائط
            <select value={f.media} onChange={(e) => set("media", e.target.value as TweetFilters["media"])}>
              <option value="any">الكل</option><option value="only">بوسائط فقط</option><option value="none">بدون وسائط</option>
            </select>
          </label>
          <label>الروابط
            <select value={f.links} onChange={(e) => set("links", e.target.value as TweetFilters["links"])}>
              <option value="any">الكل</option><option value="only">بروابط فقط</option><option value="none">بدون روابط</option>
            </select>
          </label>
          <label>إعجابات ≥<input type="number" min={0} value={f.minLikes ?? ""} onChange={(e) => set("minLikes", num(e.target.value))} /></label>
          <label>إعجابات ≤ (احتفظ بالمشهورة)<input type="number" min={0} value={f.maxLikes ?? ""} onChange={(e) => set("maxLikes", num(e.target.value))} /></label>
          <label>مشاهدات ≥<input type="number" min={0} value={f.minViews ?? ""} onChange={(e) => set("minViews", num(e.target.value))} /></label>
          <label>مشاهدات ≤<input type="number" min={0} value={f.maxViews ?? ""} onChange={(e) => set("maxViews", num(e.target.value))} /></label>
          <label>اللغة (مثل ar, en)<input value={f.lang ?? ""} onChange={(e) => set("lang", e.target.value || undefined)} /></label>
          <label>التأخير بين كل حذف (مللي ثانية)<input type="number" min={0} value={delay} onChange={(e) => setDelay(Number(e.target.value))} /></label>
        </div>
        <p className="note">بدون أي فلتر = كل تغريداتك. التواريخ بتوقيت UTC.</p>
        <div className="row">
          <button onClick={scan} disabled={busy}>{scanning ? "جارٍ الفحص…" : "فحص التغريدات"}</button>
          {scanning && <button className="sec" onClick={() => (stop.current = true)}>إيقاف الفحص</button>}
          <button className="sec" onClick={() => { setF(defaultFilters); }} disabled={busy}>إعادة ضبط</button>
        </div>
        {err && <p className="err">{err}</p>}
      </div>

      <ProgressBox p={prog} running={deleting} onStop={() => (stop.current = true)} />

      {(tweets.length > 0 || scanned > 0) && (
        <div className="card">
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
            <span>{tweets.length} تغريدة · محدد {sel.size} {scanning && <span className="pill">صفحات: {scanned}</span>}</span>
            <div className="row">
              <button className="sec" onClick={() => setSel(new Set(tweets.map((t) => t.id)))}>تحديد الكل</button>
              <button className="sec" onClick={() => setSel(new Set())}>إلغاء التحديد</button>
              <button className="danger" onClick={del} disabled={busy || sel.size === 0}>حذف المحدد ({sel.size})</button>
            </div>
          </div>
          <div className="list">
            {tweets.map((t) => (
              <label key={t.id} className="item" style={{ color: "inherit", fontSize: "inherit" }}>
                <input type="checkbox" checked={sel.has(t.id)} onChange={() => toggle(t.id)} />
                <div className="body">
                  <div>{t.text || <i>(بدون نص)</i>}</div>
                  <div className="meta">
                    {fmtDate(t.createdAt)} · ♥ {t.likeCount} · ↻ {t.retweetCount} · 💬 {t.replyCount} · 👁 {t.viewCount}
                    {t.isReply && " · رد"}{t.isRetweet && " · إعادة تغريد"}{t.hasMedia && " · وسائط"}
                    {t.url && <> · <a href={t.url} target="_blank" rel="noreferrer">فتح</a></>}
                  </div>
                </div>
              </label>
            ))}
            {!scanning && tweets.length === 0 && <p className="note">لا توجد نتائج.</p>}
          </div>
        </div>
      )}
    </>
  );
}
