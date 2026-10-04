const enc = new TextEncoder();
export const COOKIE = "xm_session";
const TTL_MS = 1000 * 60 * 60 * 24 * 14;

function secret(): string {
  return process.env.SESSION_SECRET || process.env.APP_PASSWORD || "";
}

async function hmac(data: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export async function makeToken(): Promise<string> {
  const exp = String(Date.now() + TTL_MS);
  return `${exp}.${await hmac(exp)}`;
}

export async function verifyToken(token: string | undefined): Promise<boolean> {
  if (!token || !secret()) return false;
  const [exp, sig] = token.split(".");
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  return safeEqual(sig, await hmac(exp));
}

export function passwordOk(input: string): boolean {
  const p = process.env.APP_PASSWORD || "";
  return p.length > 0 && safeEqual(input, p);
}
