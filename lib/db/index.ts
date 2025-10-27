import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { Redis } from "@upstash/redis";
import { parseISO } from "date-fns";
import { getConfig } from "@/lib/config";
import { AgentRunSummary, UploadRecord, UploadStatus } from "@/lib/types";

const cfg = getConfig();
const dataDir = path.join(process.cwd(), "data");
const dbPath = path.join(dataDir, "uploads.json");

interface Database {
  videos: UploadRecord[];
  runs: AgentRunSummary[];
}

const defaultDb: Database = {
  videos: [],
  runs: []
};

const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN
      })
    : null;

async function readJson(): Promise<Database> {
  await mkdir(dataDir, { recursive: true });
  try {
    const raw = await readFile(dbPath, "utf-8");
    return JSON.parse(raw) as Database;
  } catch {
    await writeFile(dbPath, JSON.stringify(defaultDb, null, 2), "utf-8");
    return JSON.parse(JSON.stringify(defaultDb));
  }
}

async function writeJson(payload: Database): Promise<void> {
  await mkdir(dataDir, { recursive: true });
  await writeFile(dbPath, JSON.stringify(payload, null, 2), "utf-8");
}

export async function listUploads(): Promise<UploadRecord[]> {
  if (redis) {
    const ids = (await redis.zrange<string[]>("uploads:index", 0, -1)) ?? [];
    if (!ids.length) return [];
    const pipeline = redis.pipeline();
    ids.forEach((id) => pipeline.hgetall<Record<string, string>>(`uploads:${id}`));
    const rows = await pipeline.exec<(Record<string, string> | null)[]>();
    return rows
      .map((row, idx) => parseUploadRecord(ids[idx], row ?? undefined))
      .filter(Boolean) as UploadRecord[];
  }
  const db = await readJson();
  return db.videos;
}

function parseUploadRecord(
  id: string,
  data?: Record<string, string>
): UploadRecord | null {
  if (!data) return null;
  return {
    id,
    sourceKey: data.sourceKey,
    bucket: data.bucket,
    status: data.status as UploadStatus,
    scheduledAt: data.scheduledAt,
    metadata: JSON.parse(data.metadata),
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    youtubeId: data.youtubeId,
    thumbnailKey: data.thumbnailKey,
    errorMessage: data.errorMessage,
    attempts: Number(data.attempts ?? "0"),
    publishedAt: data.publishedAt
  };
}

export async function getUploadById(id: string): Promise<UploadRecord | null> {
  if (redis) {
    const data = await redis.hgetall<Record<string, string>>(`uploads:${id}`);
    return parseUploadRecord(id, data ?? undefined);
  }
  const db = await readJson();
  return db.videos.find((item) => item.id === id) ?? null;
}

export async function saveUpload(record: UploadRecord): Promise<void> {
  if (redis) {
    const payload: Record<string, string> = {
      id: record.id,
      sourceKey: record.sourceKey,
      bucket: record.bucket,
      status: record.status,
      scheduledAt: record.scheduledAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      metadata: JSON.stringify(record.metadata),
      attempts: String(record.attempts)
    };
    if (record.youtubeId) payload.youtubeId = record.youtubeId;
    if (record.thumbnailKey) payload.thumbnailKey = record.thumbnailKey;
    if (record.errorMessage) payload.errorMessage = record.errorMessage;
    if (record.publishedAt) payload.publishedAt = record.publishedAt;
    const pipeline = redis.pipeline();
    pipeline.zadd("uploads:index", { score: new Date(record.createdAt).getTime(), member: record.id });
    pipeline.hset(`uploads:${record.id}`, payload);
    await pipeline.exec();
    return;
  }
  const db = await readJson();
  const index = db.videos.findIndex((item) => item.id === record.id);
  if (index >= 0) {
    db.videos[index] = record;
  } else {
    db.videos.push(record);
  }
  await writeJson(db);
}

export async function upsertUpload(
  id: string,
  partial: Partial<UploadRecord>
): Promise<UploadRecord> {
  const existing = (await getUploadById(id)) ?? {
    id,
    sourceKey: partial.sourceKey ?? "",
    bucket: partial.bucket ?? "",
    status: (partial.status ?? "pending") as UploadStatus,
    scheduledAt: partial.scheduledAt ?? new Date().toISOString(),
    metadata: partial.metadata!,
    createdAt: partial.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    attempts: partial.attempts ?? 0
  };

  const merged: UploadRecord = {
    ...existing,
    ...partial,
    metadata: partial.metadata ?? existing.metadata,
    updatedAt: new Date().toISOString()
  };

  await saveUpload(merged);
  return merged;
}

export async function listPendingUploads(): Promise<UploadRecord[]> {
  const uploads = await listUploads();
  const now = new Date();
  return uploads
    .filter((upload) => ["pending", "scheduled", "failed"].includes(upload.status))
    .filter((upload) => new Date(upload.scheduledAt) <= now);
}

export async function logRun(summary: AgentRunSummary): Promise<void> {
  if (redis) {
    await redis.lpush("runs:history", JSON.stringify(summary));
    await redis.ltrim("runs:history", 0, 49);
    return;
  }
  const db = await readJson();
  db.runs.unshift(summary);
  db.runs = db.runs.slice(0, 50);
  await writeJson(db);
}

export async function listRecentRuns(): Promise<AgentRunSummary[]> {
  if (redis) {
    const rows = await redis.lrange<string>("runs:history", 0, 20);
    return rows.map((row) => JSON.parse(row) as AgentRunSummary);
  }
  const db = await readJson();
  return db.runs;
}

export async function nextScheduledTime(): Promise<Date | null> {
  const uploads = await listUploads();
  const future = uploads
    .map((u) => parseISO(u.scheduledAt))
    .filter((date) => date.getTime() > Date.now())
    .sort((a, b) => a.getTime() - b.getTime());
  return future[0] ?? null;
}
