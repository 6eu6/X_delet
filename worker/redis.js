// عميل Upstash REST بدون اعتماديات
const { UPSTASH_REDIS_REST_URL: URL_, UPSTASH_REDIS_REST_TOKEN: TOKEN } = process.env;

export async function redis(...cmd) {
  const r = await fetch(URL_, { method: "POST", headers: { Authorization: `Bearer ${TOKEN}` }, body: JSON.stringify(cmd) });
  const j = await r.json();
  if (!r.ok || j.error) throw new Error(j.error || `Redis HTTP ${r.status}`);
  return j.result;
}

export const getJob = async (id) => { const r = await redis("GET", `xm:job:${id}`); return r ? JSON.parse(r) : null; };
export const saveJob = async (job) => { job.updatedAt = Date.now(); await redis("SET", `xm:job:${job.id}`, JSON.stringify(job)); };
export const isCancelled = async (id) => (await redis("GET", `xm:cancel:${id}`)) === "1";
