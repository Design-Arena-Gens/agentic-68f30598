import { mkdir } from "fs/promises";
import path from "path";
import sharp from "sharp";
import { getConfig } from "@/lib/config";
import { VideoMetadata } from "@/lib/types";

const cfg = getConfig();

export async function generateThumbnail(metadata: VideoMetadata, baseName: string): Promise<string> {
  const dir = path.join(process.cwd(), "data", "thumbnails");
  await mkdir(dir, { recursive: true });
  const filePath = path.join(dir, `${baseName}.jpg`);

  const gradient = Buffer.from(
    `<svg width="720" height="1280" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${cfg.BRAND_COLOR}"/>
          <stop offset="100%" stop-color="#131728"/>
        </linearGradient>
      </defs>
      <rect width="720" height="1280" fill="url(#grad)"/>
    </svg>`
  );

  const overlay = Buffer.from(
    `<svg width="720" height="1280" xmlns="http://www.w3.org/2000/svg">
      <style>
        .title { font-family: 'Inter', sans-serif; font-weight: 800; fill: #ffffff; font-size: 72px; }
        .subtitle { font-family: 'Inter', sans-serif; font-weight: 500; fill: rgba(255,255,255,0.85); font-size: 32px; }
      </style>
      <text x="360" y="360" text-anchor="middle" class="subtitle">YouTube Shorts</text>
      <foreignObject x="60" y="440" width="600" height="600">
        <div xmlns="http://www.w3.org/1999/xhtml"
            style="font-family: 'Inter', sans-serif; font-weight:800; color:#fff; font-size:64px; text-align:center; line-height:1.1">
          ${sanitizeText(metadata.title.toUpperCase())}
        </div>
      </foreignObject>
      <foreignObject x="110" y="1080" width="500" height="120">
        <div xmlns="http://www.w3.org/1999/xhtml"
            style="font-family:'Inter', sans-serif; font-weight:600; color:rgba(255,255,255,0.8); font-size:36px; text-align:center;">
          ${sanitizeText(metadata.hashtags.slice(0, 3).join(" "))}
        </div>
      </foreignObject>
    </svg>`
  );

  await sharp(gradient)
    .composite([{ input: overlay, top: 0, left: 0 }])
    .jpeg({ quality: 90 })
    .toFile(filePath);

  return filePath;
}

function sanitizeText(input: string): string {
  return input.replace(/[<>&"]/g, "");
}
