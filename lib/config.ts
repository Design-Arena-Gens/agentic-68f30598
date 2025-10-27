import { z } from "zod";

const targetSchema = z
  .object({
    type: z.enum(["email", "discord", "telegram"]),
    value: z.string()
  })
  .array();

const envSchema = z.object({
  AWS_REGION: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  S3_CONTENT_BUCKET: z.string().optional(),
  S3_CONTENT_PREFIX: z.string().optional(),
  TEMP_DIR: z.string().default("/tmp"),
  YOUTUBE_CLIENT_ID: z.string().optional(),
  YOUTUBE_CLIENT_SECRET: z.string().optional(),
  YOUTUBE_REFRESH_TOKEN: z.string().optional(),
  YOUTUBE_API_SCOPES: z
    .string()
    .default(
      [
        "https://www.googleapis.com/auth/youtube.upload",
        "https://www.googleapis.com/auth/youtube.readonly"
      ].join(" ")
    ),
  YOUTUBE_CATEGORY_ID: z.string().default("22"), // People & Blogs
  YOUTUBE_PRIVACY_STATUS: z.enum(["public", "private", "unlisted"]).default("private"),
  UPLOAD_WINDOWS: z.string().default("09:00,12:30,18:00"),
  UPLOAD_TIMEZONE: z.string().default("America/New_York"),
  MAX_UPLOADS_PER_RUN: z.coerce.number().default(3),
  OPENAI_API_KEY: z.string().optional(),
  FALLBACK_HASHTAGS: z.string().default("#Shorts,#Trending,#Viral"),
  NOTIFICATION_TARGETS: z
    .string()
    .optional()
    .transform((value) => {
      if (!value) return [];
      const raw = value.split(",").map((entry) => entry.trim());
      return raw
        .map((segment) => {
          const [type, ...rest] = segment.split(":");
          if (!type || rest.length === 0) return null;
          return { type: type.trim(), value: rest.join(":").trim() };
        })
        .filter(Boolean);
    })
    .pipe(targetSchema),
  EMAIL_FROM: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  DISCORD_BOT_TOKEN: z.string().optional(),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_CHAT_ID: z.string().optional(),
  YOUTUBE_REGION_CODE: z.string().default("US"),
  TRENDING_CACHE_TTL_MINUTES: z.coerce.number().default(180),
  MAX_RETRY_ATTEMPTS: z.coerce.number().default(3),
  AI_MODEL: z.string().default("gpt-4o-mini"),
  BRAND_COLOR: z.string().default("#6d8cff")
});

export type AppConfig = z.infer<typeof envSchema>;

let cachedConfig: AppConfig | null = null;

export function getConfig(): AppConfig {
  if (cachedConfig) return cachedConfig;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid environment configuration: ${parsed.error.message}`);
  }
  cachedConfig = parsed.data;
  return parsed.data;
}
