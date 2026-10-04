import "server-only";

export interface JobItem { id: string; userName: string; status: "pending" | "removed" | "not_follower" | "missing" | "failed" | "dry_run"; error?: string }
export interface Job {
  id: string; type: "remove_followers"; status: "queued" | "running" | "waiting_cap" | "done" | "cancelled" | "attention";
  items: JobItem[]; lastError?: string; createdAt: number; updatedAt: number;
}

async function redis<T = unknown>(...cmd: (string | number)[]): Promise<T> {
  const url = process.env.UPSTASH_REDIS_REST_URL, token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error("UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN غير مضبوطين");
  const r = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(cmd), cache: "no-store" });
  const j = await r.json();
  if (!r.ok || j.error) throw new Error(j.error || `Redis HTTP ${r.status}`);
  return j.result as T;
}

export async function enqueue(users: { id: string; userName: string }[]): Promise<Job> {
  const id = crypto.randomUUID();
  const now = Date.now();
  const job: Job = { id, type: "remove_followers", status: "queued", items: users.map((u) => ({ ...u, status: "pending" })), createdAt: now, updatedAt: now };
  await redis("SET", `xm:job:${id}`, JSON.stringify(job));
  await redis("LPUSH", "xm:jobs", id);
  await redis("LPUSH", "xm:queue", id);
  return job;
}

export async function listJobs(limit = 10): Promise<Job[]> {
  const ids = await redis<string[]>("LRANGE", "xm:jobs", 0, limit - 1);
  if (!ids.length) return [];
  const raws = await redis<(string | null)[]>("MGET", ...ids.map((i) => `xm:job:${i}`));
  return raws.filter((r): r is string => !!r).map((r) => JSON.parse(r));
}

export async function cancelJob(id: string) { await redis("SET", `xm:cancel:${id}`, "1", "EX", 86400); }
export async function workerHeartbeat(): Promise<number | null> {
  const v = await redis<string | null>("GET", "xm:worker:heartbeat");
  return v ? Number(v) : null;
}
