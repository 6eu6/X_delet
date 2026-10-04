"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import type { Job } from "@/lib/queue";

const LABEL: Record<Job["status"], string> = { queued: "بالانتظار", running: "قيد التنفيذ", waiting_cap: "بانتظار السقف اليومي", done: "مكتملة", cancelled: "ملغاة", attention: "تحتاج تدخلك" };

export function JobsPanel({ reload }: { reload: number }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [beat, setBeat] = useState<number | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    const load = () => api<{ jobs: Job[]; heartbeat: number | null }>("/api/jobs").then((r) => { if (alive) { setJobs(r.jobs); setBeat(r.heartbeat); setErr(""); } }).catch((e) => alive && setErr(e.message));
    load();
    const t = setInterval(load, 10000);
    return () => { alive = false; clearInterval(t); };
  }, [reload]);

  const online = beat !== null && Date.now() - beat < 150000;
  const cancel = (id: string) => fetch(`/api/jobs/${id}`, { method: "DELETE" });

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2>مهام الوركر</h2>
        <span className="pill" style={{ color: online ? "var(--ok)" : "var(--danger)" }}>{online ? "الوركر متصل" : "الوركر غير متصل"}</span>
      </div>
      {err && <p className="err">{err}</p>}
      {jobs.length === 0 && !err && <p className="note">لا توجد مهام.</p>}
      {jobs.map((j) => {
        const c = (s: string) => j.items.filter((i) => i.status === s).length;
        const finished = ["done", "cancelled"].includes(j.status);
        return (
          <div key={j.id} className="item">
            <div className="body">
              <div><b>{LABEL[j.status]}</b> · {new Date(j.createdAt).toLocaleString("ar")}</div>
              <div className="meta">
                المجموع {j.items.length} · أُزيل {c("removed")} · ليس متابعاً {c("not_follower")} · غير موجود {c("missing")} · فشل {c("failed")} · متبقٍ {c("pending")}{c("dry_run") > 0 && ` · تجريبي ${c("dry_run")}`}
              </div>
              {j.lastError && <div className="err">{j.lastError}</div>}
            </div>
            {!finished && <button className="sec" onClick={() => cancel(j.id)}>إلغاء</button>}
          </div>
        );
      })}
    </div>
  );
}
