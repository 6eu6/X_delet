import { NextRequest } from "next/server";
import { searchTweets, timeline } from "@/lib/twitter";
import { handle, me } from "@/lib/route";
import { buildQuery, matches, TweetFilters } from "@/lib/filters";

export const maxDuration = 60;

export const POST = (req: NextRequest) =>
  handle(async () => {
    const { filters, cursor = "" } = (await req.json()) as { filters: TweetFilters; cursor?: string };
    const user = me();
    if (filters.source === "timeline") {
      const r = await timeline(user, cursor);
      return { ...r, tweets: r.tweets.filter((t) => matches(t, filters)) };
    }
    const r = await searchTweets(buildQuery(user, filters), cursor);
    // الفلاتر التي لا يدعمها البحث (المشاهدات) تُطبّق هنا
    return { ...r, tweets: r.tweets.filter((t) => (filters.minViews === undefined || t.viewCount >= filters.minViews) && (filters.maxViews === undefined || t.viewCount <= filters.maxViews)) };
  });
