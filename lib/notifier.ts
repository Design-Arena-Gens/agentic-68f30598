import axios from "axios";
import nodemailer from "nodemailer";
import { getConfig } from "@/lib/config";

const cfg = getConfig();

interface SummaryPayload {
  title: string;
  youtubeId: string;
  scheduledAt: Date;
  publishedAt?: Date;
  description: string;
  hashtags: string[];
  attempts: number;
}

export async function sendSummaryNotification(payload: SummaryPayload): Promise<void> {
  const tasks = cfg.NOTIFICATION_TARGETS.map((target) => {
    if (target.type === "email") return notifyEmail(target.value, payload);
    if (target.type === "discord") return notifyDiscord(target.value, payload);
    if (target.type === "telegram") return notifyTelegram(target.value, payload);
    return Promise.resolve();
  });
  await Promise.all(tasks);
}

async function notifyEmail(address: string, payload: SummaryPayload) {
  if (!cfg.SMTP_HOST || !cfg.SMTP_PORT || !cfg.EMAIL_FROM || !cfg.SMTP_USER || !cfg.SMTP_PASSWORD) return;
  const transporter = nodemailer.createTransport({
    host: cfg.SMTP_HOST,
    port: cfg.SMTP_PORT,
    secure: cfg.SMTP_PORT === 465,
    auth: {
      user: cfg.SMTP_USER,
      pass: cfg.SMTP_PASSWORD
    }
  });
  await transporter.sendMail({
    from: cfg.EMAIL_FROM,
    to: address,
    subject: `Short uploaded: ${payload.title}`,
    html: `<strong>${payload.title}</strong><br/>
      Attempts: ${payload.attempts}<br/>
      Scheduled: ${payload.scheduledAt.toISOString()}<br/>
      Published: ${payload.publishedAt?.toISOString() ?? "pending"}<br/>
      <a href="https://www.youtube.com/watch?v=${payload.youtubeId}">Watch on YouTube</a><br/>
      <pre>${payload.description}</pre>
      <p>${payload.hashtags.join(" ")}</p>`
  });
}

async function notifyDiscord(webhook: string, payload: SummaryPayload) {
  await axios.post(webhook, {
    embeds: [
      {
        title: payload.title,
        url: `https://www.youtube.com/watch?v=${payload.youtubeId}`,
        description: payload.description,
        color: 6983882,
        fields: [
          { name: "Scheduled", value: payload.scheduledAt.toISOString(), inline: true },
          {
            name: "Status",
            value: payload.publishedAt ? "Published" : "Queued",
            inline: true
          },
          { name: "Attempts", value: String(payload.attempts), inline: true },
          { name: "Hashtags", value: payload.hashtags.join(" ") }
        ]
      }
    ]
  });
}

async function notifyTelegram(chatId: string, payload: SummaryPayload) {
  if (!cfg.TELEGRAM_BOT_TOKEN) return;
  const message = [
    `🎬 <b>${escapeHtml(payload.title)}</b>`,
    `🔗 https://www.youtube.com/watch?v=${payload.youtubeId}`,
    `⏱ Scheduled: ${payload.scheduledAt.toISOString()}`,
    payload.publishedAt ? `✅ Published: ${payload.publishedAt.toISOString()}` : `🕒 Pending publish`,
    `🏷 ${payload.hashtags.join(" ")}`,
    `📄 ${escapeHtml(payload.description)}`
  ].join("\n");
  await axios.post(`https://api.telegram.org/bot${cfg.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    chat_id: chatId,
    text: message,
    parse_mode: "HTML",
    disable_web_page_preview: true
  });
}

function escapeHtml(input: string): string {
  return input.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
