import { addMinutes, isBefore } from "date-fns";
import { google } from "googleapis";
import { getConfig } from "@/lib/config";
import { getCache, setCache } from "@/lib/util/cache";

const cfg = getConfig();

const youtube = google.youtube("v3");

export async function fetchTrendingKeywords(): Promise<string[]> {
  if (!process.env.YOUTUBE_API_KEY && !cfg.YOUTUBE_CLIENT_ID) return [];
  const cached = await getCache<string[]>("trending:keywords");
  if (cached) return cached;
  try {
    const auth = process.env.YOUTUBE_API_KEY
      ? process.env.YOUTUBE_API_KEY
      : undefined;
    const response = await youtube.videos.list({
      key: auth,
      chart: "mostPopular",
      regionCode: cfg.YOUTUBE_REGION_CODE,
      part: ["snippet"],
      maxResults: 20
    });
    const tags = new Set<string>();
    response.data.items?.forEach((item) => {
      item.snippet?.tags?.forEach((tag) => {
        if (tag.length <= 40) tags.add(tag.toLowerCase());
      });
      if (item.snippet?.title) {
        const words = item.snippet.title.split(/\W+/).filter((word) => word.length > 3);
        words.slice(0, 3).forEach((word) => tags.add(word.toLowerCase()));
      }
    });
    const output = Array.from(tags).slice(0, 20);
    await setCache("trending:keywords", output, cfg.TRENDING_CACHE_TTL_MINUTES);
    return output;
  } catch {
    return [];
  }
}
