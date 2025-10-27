import { copyFile, mkdir, readdir, readFile, rename, stat } from "fs/promises";
import path from "path";
import { tmpdir } from "os";
import { getConfig } from "@/lib/config";
import { VideoAsset } from "@/lib/types";

const cfg = getConfig();
const rootDir = process.env.CONTENT_DIR ?? path.join(process.cwd(), "content");
const archiveDir = path.join(rootDir, "processed");

async function ensureDir(dir: string) {
  await mkdir(dir, { recursive: true });
}

export async function listVideoAssetsLocal(): Promise<VideoAsset[]> {
  await ensureDir(rootDir);
  const files = await readdir(rootDir);
  const videos = files.filter((file) => /\.(mp4|mov)$/i.test(file));
  const assets: VideoAsset[] = [];
  for (const file of videos) {
    const filePath = path.join(rootDir, file);
    const stats = await stat(filePath);
    const metadataPath = await findMetadataPathLocal(filePath);
    assets.push({
      key: filePath,
      bucket: "local",
      size: stats.size,
      lastModified: stats.mtime.toISOString(),
      metadataPath: metadataPath ?? undefined
    });
  }
  return assets;
}

async function findMetadataPathLocal(filePath: string): Promise<string | null> {
  const base = filePath.replace(/\.(mp4|mov)$/i, "");
  const candidates = [".json", ".txt", ".md"].map((ext) => `${base}${ext}`);
  for (const candidate of candidates) {
    try {
      await stat(candidate);
      return candidate;
    } catch {
      continue;
    }
  }
  return null;
}

export async function fetchMetadataLocal(filePath: string): Promise<string | null> {
  try {
    const data = await readFile(filePath, "utf-8");
    return data;
  } catch {
    return null;
  }
}

export async function downloadLocalToTemp(filePath: string): Promise<string> {
  const dir = path.join(cfg.TEMP_DIR ?? tmpdir(), "agentic-shorts");
  await ensureDir(dir);
  const destination = path.join(dir, path.basename(filePath));
  await copyFile(filePath, destination);
  return destination;
}

export async function archiveLocal(filePath: string): Promise<void> {
  await ensureDir(archiveDir);
  const destination = path.join(archiveDir, path.basename(filePath));
  await rename(filePath, destination);
  const base = filePath.replace(/\.(mp4|mov)$/i, "");
  const companionExtensions = [".json", ".txt", ".md"];
  for (const ext of companionExtensions) {
    const source = `${base}${ext}`;
    try {
      await rename(source, path.join(archiveDir, path.basename(source)));
    } catch {
      continue;
    }
  }
}
