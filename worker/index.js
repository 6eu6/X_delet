import { chromium } from "playwright";
import { redis, getJob, saveJob, isCancelled } from "./redis.js";
import { removeFollower, AttentionError } from "./xactions.js";

const env = process.env;
const DAILY_CAP = Number(env.DAILY_CAP || 40);          // أقصى إزالات يومياً
const MIN_DELAY = Number(env.MIN_DELAY_S || 45) * 1000;  // تأخير عشوائي بين كل متابع
const MAX_DELAY = Number(env.MAX_DELAY_S || 120) * 1000;
const BREAK_EVERY = Number(env.BREAK_EVERY || 10);       // استراحة طويلة كل N إزالة
const MAX_CONSEC_FAIL = 3;
const DRY_RUN = env.DRY_RUN === "1";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rand = (a, b) => a + Math.random() * (b - a);
const today = () => new Date().toISOString().slice(0, 10);
const log = (...a) => console.log(new Date().toISOString(), ...a);

for (const k of ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN", "X_AUTH_TOKEN", "X_CT0"]) {
  if (!env[k]) { console.error(`متغير ${k} مطلوب`); process.exit(1); }
}

async function heartbeat() { await redis("SET", "xm:worker:heartbeat", Date.now(), "EX", 120).catch(() => {}); }

async function newSession(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "en-US", timezoneId: env.TZ || "UTC" });
  await ctx.addCookies([
    { name: "auth_token", value: env.X_AUTH_TOKEN, domain: ".x.com", path: "/", secure: true, httpOnly: true },
    { name: "ct0", value: env.X_CT0, domain: ".x.com", path: "/", secure: true },
  ]);
  return ctx;
}

async function capLeft() { return DAILY_CAP - Number((await redis("GET", `xm:cap:${today()}`)) || 0); }

async function runJob(browser, id) {
  const job = await getJob(id);
  if (!job || ["done", "cancelled"].includes(job.status)) return;
  job.status = "running"; delete job.lastError; await saveJob(job);
  log("job start", id, `items=${job.items.length}`, DRY_RUN ? "(DRY RUN)" : "");

  const ctx = await newSession(browser);
  const page = await ctx.newPage();
  let consecFail = 0, sinceBreak = 0;

  try {
    for (const item of job.items) {
      if (item.status !== "pending") continue;
      if (await isCancelled(id)) { job.status = "cancelled"; await saveJob(job); return; }

      while ((await capLeft()) <= 0 && !DRY_RUN) { // السقف اليومي: انتظر لليوم التالي
        if (job.status !== "waiting_cap") { job.status = "waiting_cap"; await saveJob(job); log("daily cap reached, waiting"); }
        await heartbeat();
        if (await isCancelled(id)) { job.status = "cancelled"; await saveJob(job); return; }
        await sleep(10 * 60 * 1000);
      }
      if (job.status !== "running") { job.status = "running"; await saveJob(job); }

      try {
        item.status = await removeFollower(page, item.userName, { dryRun: DRY_RUN });
        delete item.error; consecFail = 0;
        if (item.status === "removed") { await redis("INCR", `xm:cap:${today()}`); await redis("EXPIRE", `xm:cap:${today()}`, 172800); sinceBreak++; }
        log(item.userName, item.status);
      } catch (e) {
        if (e instanceof AttentionError) { job.status = "attention"; job.lastError = e.message; await saveJob(job); log("ATTENTION:", e.message); return; }
        item.status = "failed"; item.error = e.message; consecFail++;
        log(item.userName, "failed:", e.message);
        if (consecFail >= MAX_CONSEC_FAIL) { job.status = "attention"; job.lastError = `توقف بعد ${MAX_CONSEC_FAIL} إخفاقات متتالية: ${e.message}`; await saveJob(job); return; }
      }
      await saveJob(job); await heartbeat();

      if (sinceBreak >= BREAK_EVERY) { sinceBreak = 0; const b = rand(5, 10) * 60 * 1000; log(`break ${Math.round(b / 60000)}m`); await sleep(b); }
      else await sleep(rand(MIN_DELAY, MAX_DELAY));
    }
    job.status = "done"; await saveJob(job); log("job done", id);
  } finally { await ctx.close(); }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  log("worker started", { DAILY_CAP, MIN_DELAY, MAX_DELAY, DRY_RUN });

  // استئناف المهام غير المكتملة بعد إعادة التشغيل
  const ids = await redis("LRANGE", "xm:jobs", 0, 49);
  for (const id of [...ids].reverse()) {
    const j = await getJob(id);
    if (j && ["running", "waiting_cap"].includes(j.status)) await runJob(browser, id).catch((e) => log("resume error", e.message));
  }

  for (;;) {
    await heartbeat();
    const id = await redis("RPOP", "xm:queue").catch(() => null);
    if (id) await runJob(browser, id).catch((e) => log("job error", e.message));
    else await sleep(15000);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
