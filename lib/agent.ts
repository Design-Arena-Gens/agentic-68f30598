import { unlink } from "fs/promises";
import path from "path";
import { getConfig } from "@/lib/config";
import { buildMetadata, buildUploadId } from "@/lib/metadata";
import { generateThumbnail } from "@/lib/thumbnail";
import { listVideoAssets, downloadVideoToTempFile, archiveAsset } from "@/lib/storage";
import {
  listPendingUploads,
  listUploads,
  logRun,
  saveUpload,
  upsertUpload
} from "@/lib/db";
import { computeNextSlot } from "@/lib/scheduler";
import { sendSummaryNotification } from "@/lib/notifier";
import { uploadShort } from "@/lib/youtube";
import { AgentRunSummary, UploadRecord } from "@/lib/types";

const cfg = getConfig();

export async function runAgent(): Promise<AgentRunSummary> {
  const discoveredAssets = await listVideoAssets();
  const uploads = await listUploads();
  const discovered = await Promise.all(
    discoveredAssets.map(async (asset) => {
      const id = buildUploadId(asset);
      const existing = uploads.find((upload) => upload.id === id);
      if (existing) return null;
      const metadata = await buildMetadata(asset);
      const scheduledAt = computeNextSlot();
      const record: UploadRecord = {
        id,
        sourceKey: asset.key,
        bucket: asset.bucket,
        status: "scheduled",
        scheduledAt: scheduledAt.toISOString(),
        metadata,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        attempts: 0
      };
      await saveUpload(record);
      return record;
    })
  );
  const newItems = discovered.filter(Boolean) as UploadRecord[];

  const pending = (await listPendingUploads()).slice(0, cfg.MAX_UPLOADS_PER_RUN);

  const results: AgentRunSummary["details"] = [];
  let uploaded = 0;
  let failed = 0;

  for (const job of pending) {
    try {
      await upsertUpload(job.id, { status: "uploading" });
      const videoPath = await downloadVideoToTempFile(job.sourceKey);
      const thumbnailPath = await generateThumbnail(job.metadata, job.id);
      const youtubeId = await uploadShort({
        filePath: videoPath,
        metadata: job.metadata,
        scheduledAt: new Date(job.scheduledAt),
        thumbnailPath
      });
      await upsertUpload(job.id, {
        status: "uploaded",
        youtubeId,
        thumbnailKey: path.basename(thumbnailPath),
        attempts: job.attempts + 1,
        publishedAt:
          cfg.YOUTUBE_PRIVACY_STATUS === "public" ? new Date().toISOString() : job.scheduledAt
      });
      await archiveAsset(job.sourceKey);
      uploaded += 1;
      results.push({
        id: job.id,
        status: "uploaded",
        message: `Uploaded as ${youtubeId}`
      });
      if (cfg.NOTIFICATION_TARGETS.length > 0) {
        await sendSummaryNotification({
          title: job.metadata.title,
          youtubeId,
          scheduledAt: new Date(job.scheduledAt),
          publishedAt: cfg.YOUTUBE_PRIVACY_STATUS === "public" ? new Date() : undefined,
          description: job.metadata.description,
          hashtags: job.metadata.hashtags,
          attempts: job.attempts + 1
        });
      }
      await unlink(videoPath).catch(() => undefined);
      await unlink(path.join(process.cwd(), "data", "thumbnails", `${job.id}.jpg`)).catch(() => undefined);
    } catch (error: any) {
      failed += 1;
      results.push({
        id: job.id,
        status: "failed",
        message: error?.message ?? "Unknown error"
      });
      await upsertUpload(job.id, {
        status: job.attempts + 1 >= cfg.MAX_RETRY_ATTEMPTS ? "failed" : "pending",
        attempts: job.attempts + 1,
        errorMessage: error?.message ?? "Unknown error"
      });
    }
  }

  const summary: AgentRunSummary = {
    discovered: newItems.length,
    scheduled: newItems.length,
    uploaded,
    failed,
    timestamp: new Date().toISOString(),
    details: results
  };
  await logRun(summary);
  return summary;
}
