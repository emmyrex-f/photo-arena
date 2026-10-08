/** Studio Video Content block on /services. Stored as `services.video`. Package rows stay on the catalogue. */

export type ServiceVideoContent = {
  eyebrow: string;
  title: string;
  paragraphs: string[];
  notes: string[];
};

export const DEFAULT_SERVICE_VIDEO_CONTENT: ServiceVideoContent = {
  eyebrow: "Video content",
  title: "Studio Video Content Sessions",
  paragraphs: [
    "At Photo Arena, we offer crisp & clean in-studio video shoots that complement your personality, add motion to the occasion & allow you to express your vibe.",
    "Do well to book one of our sessions.",
  ],
  notes: ["Delivery: within 72 hours", "24-hour delivery: express fee 50% of bill"],
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function textList(value: unknown, max: number): string[] | null {
  if (!Array.isArray(value)) return null;
  const items = value.map(text).filter(Boolean);
  if (!items.length || items.length > max) return null;
  return items;
}

function parseServiceVideoContent(value: unknown): ServiceVideoContent | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const eyebrow = text(row.eyebrow);
  const title = text(row.title);
  const paragraphs = textList(row.paragraphs, 6);
  const notes = Array.isArray(row.notes) ? row.notes.map(text).filter(Boolean).slice(0, 4) : null;
  if (!eyebrow || !title || !paragraphs || !notes) return null;
  return { eyebrow, title, paragraphs, notes };
}

export function readServiceVideoContent(raw: string): ServiceVideoContent {
  if (!raw.trim()) return DEFAULT_SERVICE_VIDEO_CONTENT;
  try {
    return parseServiceVideoContent(JSON.parse(raw)) ?? DEFAULT_SERVICE_VIDEO_CONTENT;
  } catch {
    return DEFAULT_SERVICE_VIDEO_CONTENT;
  }
}
