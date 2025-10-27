# Agentic Shorts Autopilot

Autonomous Next.js application that scans a content bucket for new short-form videos, curates SEO metadata, schedules uploads, and publishes directly to YouTube Shorts with rich notifications and logging.

## Features

- S3 content ingestion with metadata extraction or AI generation (OpenAI support)
- Automatic scheduling based on configurable upload windows
- YouTube Data API upload pipeline with OAuth refresh token flow
- Branded thumbnail generation via Sharp
- Trending keyword enrichment from YouTube most popular feed
- Persistent queue and run history (Upstash Redis or JSON fallback)
- Email, Discord, and Telegram summary notifications
- Dashboard monitoring for queue, history, and pipeline health

## Required Environment

| Variable | Description |
| --- | --- |
| `YOUTUBE_CLIENT_ID` | OAuth client ID from Google Cloud console |
| `YOUTUBE_CLIENT_SECRET` | OAuth secret |
| `YOUTUBE_REFRESH_TOKEN` | Refresh token with YouTube upload scopes |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_REGION` | Credentials for S3-compatible storage |
| `S3_CONTENT_BUCKET` | Bucket containing video assets |
| `S3_CONTENT_PREFIX` | Optional prefix within the bucket |

Optional configuration covers OpenAI metadata, Upstash Redis, SMTP, Discord/Telegram webhooks, and scheduling knobs (`UPLOAD_WINDOWS`, `MAX_UPLOADS_PER_RUN`, `FALLBACK_HASHTAGS`, etc.).

## Development

```bash
npm install
npm run dev
```

Local agent run:

```bash
npm run agent:run
```

Deploy with Vercel including a cron pointing at `/api/cron` to trigger ingestion.

## Structure

```
app/                 Next.js App Router UI and API routes
lib/                 Agent orchestration, storage, metadata, upload, notification helpers
scripts/run-agent.ts Manual CLI trigger with dotenv support
data/                Local JSON persistence (auto-created)
```

## Cron Setup

```json
{
  "crons": [
    {
      "path": "/api/cron",
      "schedule": "0 * * * *"
    }
  ]
}
```

Configure `vercel.json` or Vercel dashboard accordingly.
