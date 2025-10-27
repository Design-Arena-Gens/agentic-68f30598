import { createHash } from "crypto";
import { parse } from "path";
import { getConfig } from "@/lib/config";
import { VideoAsset, VideoMetadata } from "@/lib/types";
import { readMetadataContent } from "@/lib/storage";
import OpenAI from "openai";
import { fetchTrendingKeywords } from "@/lib/trending";

const cfg = getConfig();

const openai = cfg.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: cfg.OPENAI_API_KEY
    })
  : null;

interface MetadataFile {
  title?: string;
  description?: string;
  hashtags?: string[];
  tags?: string[];
  language?: string;
}

function parseMetadataRaw(raw: string | null): MetadataFile {
  if (!raw) return {};
  try {
    const data = JSON.parse(raw);
    return data;
  } catch {
    const entries = raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const output: MetadataFile = {};
    for (const entry of entries) {
      const [key, ...rest] = entry.split(":");
      if (!key || rest.length === 0) continue;
      const value = rest.join(":").trim();
      if (key.toLowerCase() === "title") output.title = value;
      if (key.toLowerCase() === "description") output.description = value;
      if (key.toLowerCase() === "hashtags") output.hashtags = value.split(",").map((v) => v.trim());
      if (key.toLowerCase() === "tags") output.tags = value.split(",").map((v) => v.trim());
    }
    return output;
  }
}

function fallbackFromFilename(asset: VideoAsset): MetadataFile {
  const { name } = parse(asset.key);
  const clean = name
    .replace(/[_-]+/g, " ")
    .replace(/\d+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const capitalized = clean
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
  return {
    title: capitalized || "Untitled Short",
    description: `Another quick hit from our channel. ${capitalized}.`,
    hashtags: cfg.FALLBACK_HASHTAGS.split(",").map((tag) => tag.trim())
  };
}

async function generateWithOpenAI(asset: VideoAsset): Promise<MetadataFile> {
  if (!openai) return fallbackFromFilename(asset);
  const prompt = `You are helping craft metadata for a YouTube Short. The file name is "${asset.key}" and it is a vertical, under-60-second short. Reply with a JSON object containing keys: title, description, hashtags (array of #tags), tags (array of keywords). Title <= 70 chars; description two sentences with hook plus CTA; hashtags 6-10 items; tags 6-12 items without #.`;
  const response = await openai.chat.completions.create({
    model: cfg.AI_MODEL,
    temperature: 0.7,
    messages: [
      {
        role: "system",
        content: "You craft succinct, high-converting YouTube Shorts metadata. Always respond with pure JSON."
      },
      {
        role: "user",
        content: prompt
      }
    ]
  });
  const text = response.choices[0]?.message?.content ?? "";
  try {
    const parsed = JSON.parse(text) as MetadataFile;
    return parsed;
  } catch {
    return fallbackFromFilename(asset);
  }
}

export async function buildMetadata(asset: VideoAsset): Promise<VideoMetadata> {
  const raw = await readMetadataContent(asset.metadataPath);
  const fileMeta = parseMetadataRaw(raw);
  const base = fileMeta.title ? fileMeta : await generateWithOpenAI(asset);
  const hashtags = new Set([
    ...(base.hashtags ?? []),
    ...cfg.FALLBACK_HASHTAGS.split(",").map((tag) => tag.trim())
  ]);
  const trending = await fetchTrendingKeywords();
  trending.slice(0, 5).forEach((keyword) => hashtags.add(`#${keyword.replace(/#/g, "")}`));
  const tags = new Set(base.tags ?? []);
  trending.forEach((keyword) => tags.add(keyword.replace(/#/g, "")));

  return {
    title: base.title ?? fallbackFromFilename(asset).title!,
    description: base.description ?? fallbackFromFilename(asset).description!,
    hashtags: Array.from(hashtags).map((tag) => (tag.startsWith("#") ? tag : `#${tag}`)),
    tags: Array.from(tags),
    language: base.language,
    source: raw ? "file" : openai ? "ai" : "file"
  };
}

export function buildUploadId(asset: VideoAsset): string {
  const hash = createHash("sha256");
  hash.update(asset.key);
  if (asset.etag) hash.update(asset.etag);
  hash.update(String(asset.size));
  return hash.digest("hex");
}
