export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function api<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, body === undefined ? undefined : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (res.status === 401) { location.href = "/login"; throw new HttpError(401, "انتهت الجلسة"); }
  if (!res.ok) throw new HttpError(res.status, json.error || `HTTP ${res.status}`);
  return json as T;
}

/** يعيد المحاولة عند 429 (حد المعدّل في الخطة المجانية) */
export async function retry<T>(fn: () => Promise<T>, tries = 5): Promise<T> {
  for (let i = 0; ; i++) {
    try { return await fn(); } catch (e) {
      if (e instanceof HttpError && e.status === 429 && i < tries) { await sleep(6000 * (i + 1)); continue; }
      throw e;
    }
  }
}

export interface Progress { done: number; failed: number; total: number; lastError?: string }

/** ينفّذ عناصر القائمة واحداً واحداً مع تأخير وإمكانية الإيقاف */
export async function runQueue<T>(items: T[], worker: (x: T) => Promise<void>, o: { delay: number; stop: { current: boolean }; onProgress: (p: Progress) => void; onDone?: (x: T) => void }) {
  const p: Progress = { done: 0, failed: 0, total: items.length };
  o.onProgress({ ...p });
  for (const it of items) {
    if (o.stop.current) break;
    try { await retry(() => worker(it)); p.done++; o.onDone?.(it); } catch (e) { p.failed++; p.lastError = (e as Error).message; }
    o.onProgress({ ...p });
    await sleep(o.delay);
  }
  return p;
}

export const fmtDate = (s: string) => { const d = new Date(s); return isNaN(+d) ? s : d.toLocaleDateString("ar", { year: "numeric", month: "short", day: "numeric" }); };
