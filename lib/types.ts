export type UploadStatus = "pending" | "scheduled" | "uploading" | "uploaded" | "failed";

export interface VideoAsset {
  key: string;
  bucket: string;
  etag?: string;
  size: number;
  lastModified: string;
  metadataPath?: string;
}

export interface VideoMetadata {
  title: string;
  description: string;
  hashtags: string[];
  tags: string[];
  language?: string;
  source?: "file" | "ai";
}

export interface UploadRecord {
  id: string;
  sourceKey: string;
  bucket: string;
  status: UploadStatus;
  scheduledAt: string;
  metadata: VideoMetadata;
  createdAt: string;
  updatedAt: string;
  youtubeId?: string;
  thumbnailKey?: string;
  errorMessage?: string;
  attempts: number;
  publishedAt?: string;
}

export interface AgentRunSummary {
  discovered: number;
  scheduled: number;
  uploaded: number;
  failed: number;
  timestamp: string;
  details: {
    id: string;
    status: UploadStatus;
    message: string;
  }[];
}
