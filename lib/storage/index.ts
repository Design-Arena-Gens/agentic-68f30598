import { getConfig } from "@/lib/config";
import { VideoAsset } from "@/lib/types";
import {
  listVideoAssets as listS3Assets,
  downloadVideoToTempFile as downloadS3,
  getMetadataContent as getS3Metadata,
  archiveObject as archiveS3,
  objectExists as s3ObjectExists
} from "@/lib/storage/s3";
import {
  listVideoAssetsLocal,
  downloadLocalToTemp,
  fetchMetadataLocal,
  archiveLocal
} from "@/lib/storage/local";

const cfg = getConfig();

const useS3 = Boolean(cfg.S3_CONTENT_BUCKET && cfg.AWS_ACCESS_KEY_ID && cfg.AWS_SECRET_ACCESS_KEY);

export async function listVideoAssets(): Promise<VideoAsset[]> {
  return useS3 ? listS3Assets() : listVideoAssetsLocal();
}

export async function downloadVideoToTempFile(key: string): Promise<string> {
  return useS3 ? downloadS3(key) : downloadLocalToTemp(key);
}

export async function readMetadataContent(path: string | undefined): Promise<string | null> {
  if (!path) return null;
  return useS3 ? getS3Metadata(path) : fetchMetadataLocal(path);
}

export async function archiveAsset(key: string): Promise<void> {
  if (useS3) {
    await archiveS3(key);
    const base = key.replace(/\.(mp4|mov)$/i, "");
    const companions = [".json", ".txt", ".md"].map((ext) => `${base}${ext}`);
    for (const companion of companions) {
      if (await s3ObjectExists(companion)) {
        await archiveS3(companion);
      }
    }
  } else {
    await archiveLocal(key);
  }
}
