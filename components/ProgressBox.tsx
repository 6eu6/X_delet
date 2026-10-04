import type { Progress } from "@/lib/client";

export function ProgressBox({ p, running, onStop }: { p: Progress | null; running: boolean; onStop: () => void }) {
  if (!p) return null;
  const pct = p.total ? Math.round(((p.done + p.failed) / p.total) * 100) : 0;
  return (
    <div className="card">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <span>تم {p.done} من {p.total} {p.failed > 0 && <span className="err">· فشل {p.failed}</span>}</span>
        {running && <button className="danger" onClick={onStop}>إيقاف</button>}
      </div>
      <div className="bar" style={{ margin: "8px 0" }}><i style={{ width: pct + "%" }} /></div>
      {p.lastError && <div className="err">آخر خطأ: {p.lastError}</div>}
    </div>
  );
}
