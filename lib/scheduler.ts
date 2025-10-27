import { addDays, set } from "date-fns";
import { getConfig } from "@/lib/config";

const cfg = getConfig();

function parseWindows(): string[] {
  return cfg.UPLOAD_WINDOWS.split(",").map((time) => time.trim());
}

export function computeNextSlot(after?: Date): Date {
  const windows = parseWindows();
  if (!windows.length) return after ?? new Date();
  const base = after && after.getTime() > Date.now() ? after : new Date();
  for (let dayOffset = 0; dayOffset < 14; dayOffset += 1) {
    const candidateDay = dayOffset === 0 ? base : addDays(base, dayOffset);
    for (const time of windows) {
      const [hour, minute] = time.split(":").map((v) => Number(v));
      const candidate = set(candidateDay, {
        hours: hour ?? 0,
        minutes: minute ?? 0,
        seconds: 0,
        milliseconds: 0
      });
      if (candidate.getTime() > base.getTime()) {
        return candidate;
      }
    }
  }
  return addDays(base, 1);
}
