export interface TweetFilters {
  source: "search" | "timeline";
  from?: string; to?: string;          // yyyy-mm-dd (UTC)
  keyword?: string; exclude?: string;
  replies: "include" | "exclude" | "only";
  retweets: "include" | "exclude" | "only";
  media: "any" | "only" | "none";
  links: "any" | "only" | "none";
  minLikes?: number; maxLikes?: number;
  minViews?: number; maxViews?: number;
  lang?: string;
}

export const defaultFilters: TweetFilters = { source: "search", replies: "include", retweets: "include", media: "any", links: "any" };

const startOf = (d: string) => Math.floor(Date.parse(d + "T00:00:00Z") / 1000);
const endOf = (d: string) => Math.floor(Date.parse(d + "T23:59:59Z") / 1000);

/** يبني استعلام Advanced Search من الفلاتر */
export function buildQuery(user: string, f: TweetFilters): string {
  const q = [`from:${user}`];
  if (f.from) q.push(`since_time:${startOf(f.from)}`);
  if (f.to) q.push(`until_time:${endOf(f.to) + 1}`);
  if (f.keyword?.trim()) q.push(f.keyword.trim());
  for (const w of (f.exclude ?? "").split(/[\s,،]+/).filter(Boolean)) q.push(`-${w}`);
  if (f.replies === "exclude") q.push("-filter:replies");
  if (f.replies === "only") q.push("filter:replies");
  if (f.retweets === "exclude") q.push("-filter:nativeretweets");
  else q.push("include:nativeretweets");
  if (f.retweets === "only") q.push("filter:nativeretweets");
  if (f.media === "only") q.push("filter:media");
  if (f.media === "none") q.push("-filter:media");
  if (f.links === "only") q.push("filter:links");
  if (f.links === "none") q.push("-filter:links");
  if (f.minLikes) q.push(`min_faves:${f.minLikes}`);
  if (f.maxLikes !== undefined && !Number.isNaN(f.maxLikes)) q.push(`-min_faves:${f.maxLikes + 1}`);
  if (f.lang) q.push(`lang:${f.lang}`);
  return q.join(" ");
}

type T = { text: string; createdAt: string; likeCount: number; viewCount: number; isReply: boolean; isRetweet: boolean; hasMedia: boolean; hasLink: boolean };

/** نفس الفلاتر لكن على النتائج مباشرة (مصدر "الخط الزمني") */
export function matches(t: T, f: TweetFilters): boolean {
  const ts = Date.parse(t.createdAt) / 1000;
  if (f.from && ts < startOf(f.from)) return false;
  if (f.to && ts > endOf(f.to)) return false;
  const text = t.text.toLowerCase();
  if (f.keyword?.trim() && !text.includes(f.keyword.trim().toLowerCase())) return false;
  for (const w of (f.exclude ?? "").split(/[\s,،]+/).filter(Boolean)) if (text.includes(w.toLowerCase())) return false;
  if (f.replies === "exclude" && t.isReply) return false;
  if (f.replies === "only" && !t.isReply) return false;
  if (f.retweets === "exclude" && t.isRetweet) return false;
  if (f.retweets === "only" && !t.isRetweet) return false;
  if (f.media === "only" && !t.hasMedia) return false;
  if (f.media === "none" && t.hasMedia) return false;
  if (f.links === "only" && !t.hasLink) return false;
  if (f.links === "none" && t.hasLink) return false;
  if (f.minLikes !== undefined && t.likeCount < f.minLikes) return false;
  if (f.maxLikes !== undefined && t.likeCount > f.maxLikes) return false;
  if (f.minViews !== undefined && t.viewCount < f.minViews) return false;
  if (f.maxViews !== undefined && t.viewCount > f.maxViews) return false;
  return true;
}
