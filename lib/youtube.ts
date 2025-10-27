import { createReadStream } from "fs";
import { google, youtube_v3 } from "googleapis";
import { getConfig } from "@/lib/config";
import { VideoMetadata } from "@/lib/types";

const cfg = getConfig();

let cachedClient: youtube_v3.Youtube | null = null;

function getYoutubeClient(): youtube_v3.Youtube {
  if (!cfg.YOUTUBE_CLIENT_ID || !cfg.YOUTUBE_CLIENT_SECRET || !cfg.YOUTUBE_REFRESH_TOKEN) {
    throw new Error("YouTube credentials are not configured");
  }
  if (cachedClient) return cachedClient;
  const oauth2Client = new google.auth.OAuth2(
    cfg.YOUTUBE_CLIENT_ID,
    cfg.YOUTUBE_CLIENT_SECRET,
    "urn:ietf:wg:oauth:2.0:oob"
  );
  oauth2Client.setCredentials({
    refresh_token: cfg.YOUTUBE_REFRESH_TOKEN
  });
  cachedClient = google.youtube({
    version: "v3",
    auth: oauth2Client
  });
  return cachedClient;
}

interface UploadPayload {
  filePath: string;
  metadata: VideoMetadata;
  scheduledAt: Date;
  thumbnailPath: string;
}

export async function uploadShort(payload: UploadPayload) {
  const { filePath, metadata, scheduledAt, thumbnailPath } = payload;
  const youtube = getYoutubeClient();
  const insertResponse = await youtube.videos.insert({
    part: ["snippet", "status"],
    requestBody: {
      snippet: {
        title: metadata.title,
        description: `${metadata.description}\n\n${metadata.hashtags.join(" ")}`,
        tags: metadata.tags,
        categoryId: cfg.YOUTUBE_CATEGORY_ID,
        defaultLanguage: metadata.language
      },
      status: {
        privacyStatus: cfg.YOUTUBE_PRIVACY_STATUS,
        selfDeclaredMadeForKids: false,
        publishAt: cfg.YOUTUBE_PRIVACY_STATUS === "private" ? scheduledAt.toISOString() : undefined
      }
    },
    media: {
      body: createReadStream(filePath)
    }
  });

  const videoId = insertResponse.data.id;
  if (!videoId) {
    throw new Error("Failed to upload video");
  }

  if (thumbnailPath) {
    await youtube.thumbnails.set({
      videoId,
      media: {
        body: createReadStream(thumbnailPath)
      }
    });
  }

  return videoId;
}
