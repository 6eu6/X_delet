import "server-only";

const BASE = (process.env.TWITTERAPI_IO_BASE_URL || "https://api.twitterapi.io").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

type Q = Record<string, string | number | boolean | undefined>;

async function call<T>(method: "GET" | "POST", path: string, opts: { query?: Q; body?: unknown } = {}): Promise<T> {
  const key = process.env.TWITTERAPI_IO_KEY;
  if (!key) throw new ApiError(500, "TWITTERAPI_IO_KEY غير مضبوط");
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(opts.query ?? {})) if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
  const res = await fetch(url, {
    method,
    headers: { "X-API-Key": key, "Content-Type": "application/json" },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    cache: "no-store",
  });
  const text = await res.text();
  let json: any = {};
  try { json = text ? JSON.parse(text) : {}; } catch { /* non-json */ }
  if (!res.ok || json?.status === "error") {
    throw new ApiError(res.status === 200 ? 502 : res.status, json?.msg || json?.message || json?.error || text.slice(0, 200) || `HTTP ${res.status}`);
  }
  return json as T;
}

// ---------- X session (login cookie) ----------
const g = globalThis as unknown as { __xCookie?: string };

export async function login(): Promise<string> {
  const { X_USERNAME, X_EMAIL, X_PASSWORD, X_TOTP_SECRET, X_PROXY } = process.env;
  if (!X_USERNAME || !X_EMAIL || !X_PASSWORD || !X_PROXY) {
    throw new ApiError(400, "أضف X_USERNAME و X_EMAIL و X_PASSWORD و X_PROXY في متغيرات البيئة (أو X_LOGIN_COOKIE)");
  }
  const r = await call<{ login_cookie?: string }>("POST", "/twitter/user_login_v2", {
    body: { user_name: X_USERNAME, email: X_EMAIL, password: X_PASSWORD, totp_secret: X_TOTP_SECRET || undefined, proxy: X_PROXY },
  });
  if (!r.login_cookie) throw new ApiError(502, "لم يرجع تسجيل الدخول cookie");
  g.__xCookie = r.login_cookie;
  return r.login_cookie;
}

export async function getCookie(): Promise<string> {
  return process.env.X_LOGIN_COOKIE || g.__xCookie || (await login());
}

export function resetCookie() { g.__xCookie = undefined; }

function proxy(): string {
  const p = process.env.X_PROXY;
  if (!p) throw new ApiError(400, "X_PROXY غير مضبوط");
  return p;
}

async function authed(path: string, body: Record<string, unknown>) {
  return call("POST", path, { body: { ...body, login_cookies: await getCookie(), proxy: proxy() } });
}

// ---------- Types ----------
export interface TweetLite {
  id: string; text: string; createdAt: string; url: string;
  likeCount: number; retweetCount: number; replyCount: number; viewCount: number;
  isReply: boolean; isRetweet: boolean; hasMedia: boolean; hasLink: boolean;
}
export interface UserLite {
  id: string; userName: string; name: string; profilePicture: string; description: string;
  followers: number; following: number; statusesCount: number; createdAt: string; canDm?: boolean;
}

function normTweet(t: any): TweetLite {
  const media = t.extendedEntities?.media?.length || t.entities?.media?.length || 0;
  return {
    id: String(t.id), text: t.text ?? "", createdAt: t.createdAt ?? "", url: t.url ?? "",
    likeCount: t.likeCount ?? 0, retweetCount: t.retweetCount ?? 0, replyCount: t.replyCount ?? 0, viewCount: t.viewCount ?? 0,
    isReply: !!t.isReply, isRetweet: !!t.retweeted_tweet || /^RT @/.test(t.text ?? ""),
    hasMedia: media > 0, hasLink: (t.entities?.urls?.length ?? 0) > 0,
  };
}

function normUser(u: any): UserLite {
  return {
    id: String(u.id), userName: u.userName, name: u.name ?? "", profilePicture: u.profilePicture ?? "", description: u.description ?? "",
    followers: u.followers ?? 0, following: u.following ?? 0, statusesCount: u.statusesCount ?? 0, createdAt: u.createdAt ?? "", canDm: u.canDm,
  };
}

// ---------- Read endpoints ----------
export async function searchTweets(query: string, cursor: string) {
  const r = await call<any>("GET", "/twitter/tweet/advanced_search", { query: { query, queryType: "Latest", cursor } });
  return { tweets: (r.tweets ?? []).map(normTweet) as TweetLite[], hasNext: !!r.has_next_page, cursor: (r.next_cursor ?? "") as string };
}

export async function timeline(userName: string, cursor: string) {
  const r = await call<any>("GET", "/twitter/user/last_tweets", { query: { userName, cursor, includeReplies: true } });
  const list = r.data?.tweets ?? r.tweets ?? [];
  return { tweets: list.map(normTweet) as TweetLite[], hasNext: !!r.has_next_page, cursor: (r.next_cursor ?? "") as string };
}

export async function network(kind: "followers" | "followings", userName: string, cursor: string) {
  const r = await call<any>("GET", `/twitter/user/${kind}`, { query: { userName, cursor, pageSize: 200 } });
  return { users: (r[kind] ?? []).map(normUser) as UserLite[], hasNext: !!r.has_next_page, cursor: (r.next_cursor ?? "") as string };
}

export async function userInfo(userName: string): Promise<UserLite & { canDm?: boolean }> {
  const r = await call<any>("GET", "/twitter/user/info", { query: { userName } });
  if (!r.data?.id) throw new ApiError(404, "المستخدم غير موجود");
  return normUser(r.data);
}

export async function credits(): Promise<number> {
  const r = await call<any>("GET", "/oapi/my/info");
  return r.recharge_credits ?? 0;
}

// ---------- Write endpoints ----------
export const deleteTweet = (tweet_id: string) => authed("/twitter/delete_tweet_v2", { tweet_id });
export const unfollow = (user_id: string) => authed("/twitter/unfollow_user_v2", { user_id });
export const sendDm = (user_id: string, text: string) => authed("/twitter/send_dm_to_user", { user_id, text });
