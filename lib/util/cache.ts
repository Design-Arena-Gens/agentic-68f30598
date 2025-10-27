import { Redis } from "@upstash/redis";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

const dataDir = path.join(process.cwd(), "data", "cache");
const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN
      })
    : null;

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

async function readLocal<T>(key: string): Promise<CacheEntry<T> | null> {
  try {
    await mkdir(dataDir, { recursive: true });
    const file = path.join(dataDir, `${key.replace(/[:/]/g, "_")}.json`);
    const raw = await readFile(file, "utf-8");
    return JSON.parse(raw) as CacheEntry<T>;
  } catch {
    return null;
  }
}

async function writeLocal<T>(key: string, entry: CacheEntry<T>): Promise<void> {
  await mkdir(dataDir, { recursive: true });
  const file = path.join(dataDir, `${key.replace(/[:/]/g, "_")}.json`);
  await writeFile(file, JSON.stringify(entry, null, 2), "utf-8");
}

export async function getCache<T>(key: string): Promise<T | null> {
  if (redis) {
    const payload = await redis.get<CacheEntry<T>>(`cache:${key}`);
    if (!payload) return null;
    if (payload.expiresAt < Date.now()) {
      await redis.del(`cache:${key}`);
      return null;
    }
    return payload.value;
  }
  const entry = await readLocal<T>(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) return null;
  return entry.value;
}

export async function setCache<T>(key: string, value: T, ttlMinutes: number): Promise<void> {
  const entry: CacheEntry<T> = {
    value,
    expiresAt: Date.now() + ttlMinutes * 60 * 1000
  };
  if (redis) {
    await redis.set(`cache:${key}`, entry, { ex: ttlMinutes * 60 });
    return;
  }
  await writeLocal(key, entry);
}
