import { mkdir, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import {
  GetObjectCommand,
  ListObjectsV2Command,
  CopyObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";
import { getConfig } from "@/lib/config";
import { VideoAsset } from "@/lib/types";

const cfg = getConfig();

let s3Client: S3Client | null =
  cfg.S3_CONTENT_BUCKET && cfg.AWS_ACCESS_KEY_ID && cfg.AWS_SECRET_ACCESS_KEY
    ? new S3Client({
        region: cfg.AWS_REGION,
        credentials: {
          accessKeyId: cfg.AWS_ACCESS_KEY_ID,
          secretAccessKey: cfg.AWS_SECRET_ACCESS_KEY
        }
      })
    : null;

function getClient(): S3Client {
  if (!s3Client || !cfg.S3_CONTENT_BUCKET) {
    throw new Error("S3 storage is not configured. Set AWS and S3_CONTENT_BUCKET env vars.");
  }
  return s3Client;
}

export async function listVideoAssets(): Promise<VideoAsset[]> {
  const command = new ListObjectsV2Command({
    Bucket: cfg.S3_CONTENT_BUCKET,
    Prefix: cfg.S3_CONTENT_PREFIX
  });
  const client = getClient();
  const response = await client.send(command);
  const contents = response.Contents ?? [];

  return contents
    .filter((item) => item.Key && /\.(mp4|mov)$/i.test(item.Key))
    .map((item) => ({
      key: item.Key!,
      bucket: cfg.S3_CONTENT_BUCKET!,
      etag: item.ETag,
      size: item.Size ?? 0,
      lastModified: item.LastModified?.toISOString() ?? new Date().toISOString(),
      metadataPath: findMetadataPath(item.Key!)
    }));
}

function findMetadataPath(videoKey: string): string | undefined {
  const base = videoKey.replace(/\.(mp4|mov)$/i, "");
  const candidates = [".json", ".txt", ".md"];
  return candidates.map((ext) => `${base}${ext}`).find(Boolean);
}

export async function fetchObjectBuffer(key: string): Promise<Buffer> {
  const client = getClient();
  const res = await client.send(
    new GetObjectCommand({
      Bucket: cfg.S3_CONTENT_BUCKET,
      Key: key
    })
  );
  const arrayBuffer = await res.Body?.transformToByteArray();
  if (!arrayBuffer) {
    throw new Error(`Unable to download object ${key}`);
  }
  return Buffer.from(arrayBuffer);
}

export async function downloadVideoToTempFile(key: string): Promise<string> {
  const buffer = await fetchObjectBuffer(key);
  const dir = path.join(cfg.TEMP_DIR ?? tmpdir(), "agentic-shorts");
  await mkdir(dir, { recursive: true });
  const fileName = path.basename(key);
  const filePath = path.join(dir, fileName);
  await writeFile(filePath, buffer);
  return filePath;
}

export async function getMetadataContent(key: string): Promise<string | null> {
  if (!key) return null;
  try {
    const buffer = await fetchObjectBuffer(key);
    return buffer.toString("utf-8");
  } catch (err) {
    return null;
  }
}

export async function archiveObject(originalKey: string, destinationPrefix = "processed"): Promise<void> {
  const sanitized = destinationPrefix.replace(/\/$/, "");
  const destinationKey = `${sanitized}/${path.basename(originalKey)}`;
  const client = getClient();
  await client.send(
    new CopyObjectCommand({
      Bucket: cfg.S3_CONTENT_BUCKET,
      CopySource: `${cfg.S3_CONTENT_BUCKET}/${originalKey}`,
      Key: destinationKey
    })
  );
  await client.send(
    new DeleteObjectCommand({
      Bucket: cfg.S3_CONTENT_BUCKET,
      Key: originalKey
    })
  );
}

export async function objectExists(key: string): Promise<boolean> {
  const client = getClient();
  try {
    await client.send(
      new HeadObjectCommand({
        Bucket: cfg.S3_CONTENT_BUCKET,
        Key: key
      })
    );
    return true;
  } catch {
    return false;
  }
}
