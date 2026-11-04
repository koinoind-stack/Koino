"use client";

/**
 * Client-safe formatting helpers for the social UI (Task 50).
 * No server imports — safe in client components.
 */

/** Compact count: 1,234 → 1.2K; 1,234,567 → 1.2M */
export function formatCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0).replace(/\.0$/, "")}K`;
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
}

/** Relative time: "now", "5m", "3h", "2d", else a short date. */
export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (isNaN(then)) return "";
  const diff = Date.now() - then;
  const s = Math.floor(diff / 1000);
  if (s < 45) return "now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export type CaptionToken =
  | { kind: "text"; value: string }
  | { kind: "hashtag"; value: string }
  | { kind: "mention"; value: string }
  | { kind: "bible"; value: string };

const BOOK_NAMES =
  "Genesis|Exodus|Leviticus|Numbers|Deuteronomy|Joshua|Judges|Ruth|Samuel|Kings|Chronicles|Ezra|Nehemiah|Esther|Job|Psalms?|Psalm|Proverbs|Ecclesiastes|Solomon|Isaiah|Jeremiah|Lamentations|Ezekiel|Daniel|Hosea|Joel|Amos|Obadiah|Jonah|Micah|Nahum|Habakkuk|Zephaniah|Haggai|Zechariah|Malachi|Matthew|Mark|Luke|John|Acts|Romans|Corinthians|Galatians|Ephesians|Philippians|Colossians|Thessalonians|Timothy|Titus|Philemon|Hebrews|James|Peter|Jude|Revelation";

/**
 * Tokenize a caption into clickable pieces:
 * hashtags (#word), mentions (@handle), and Bible references ("John 3:16",
 * "1 Corinthians 13:4-7", "Psalm 23"). Everything else is plain text.
 */
export function tokenizeCaption(text: string): CaptionToken[] {
  const pattern = new RegExp(
    `(#[\\p{L}\\p{N}_]{1,50})|((?:^|\\s)@[a-zA-Z0-9_.]{3,30})|((?:[1-3]\\s)?(?:${BOOK_NAMES})\\.?\\s\\d{1,3}(?::\\d{1,3}(?:[-–]\\d{1,3})?)?(?:,?\\s?\\d{1,3}(?::\\d{1,3})?)*)(?=$|\\s|[.,!?;:)]|[^\\p{L}\\p{N}])`,
    "gu",
  );
  const tokens: CaptionToken[] = [];
  let last = 0;
  for (const m of text.matchAll(pattern)) {
    const idx = m.index ?? 0;
    if (idx > last) tokens.push({ kind: "text", value: text.slice(last, idx) });
    if (m[1]) tokens.push({ kind: "hashtag", value: m[1] });
    else if (m[2]) tokens.push({ kind: "mention", value: m[2].trim() });
    else if (m[3]) tokens.push({ kind: "bible", value: m[3].trim() });
    last = idx + m[0].length;
  }
  if (last < text.length) tokens.push({ kind: "text", value: text.slice(last) });
  return tokens;
}

/**
 * Capture a poster frame from a local video File (client-side, no ffmpeg).
 * Returns a JPEG data URL, or null when capture fails. Used for upload
 * previews and video post thumbnails.
 */
export async function captureVideoPoster(file: File, atSeconds = 0.5): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const url = URL.createObjectURL(file);
      const video = document.createElement("video");
      video.muted = true;
      video.src = url;
      const cleanup = (result: string | null) => {
        URL.revokeObjectURL(url);
        resolve(result);
      };
      video.onloadeddata = () => {
        video.currentTime = Math.min(atSeconds, (video.duration || 1) / 3);
      };
      video.onseeked = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          if (!canvas.width || !canvas.height) return cleanup(null);
          const ctx = canvas.getContext("2d");
          if (!ctx) return cleanup(null);
          ctx.drawImage(video, 0, 0);
          cleanup(canvas.toDataURL("image/jpeg", 0.7));
        } catch {
          cleanup(null);
        }
      };
      video.onerror = () => cleanup(null);
      // Hard timeout — some codecs never fire events.
      setTimeout(() => cleanup(null), 6000);
    } catch {
      resolve(null);
    }
  });
}

/**
 * Probe a local video File for duration and intrinsic dimensions (client-side,
 * metadata only — the file is never uploaded). Used to enforce Reel/Video
 * duration limits and store a true aspectRatio on the post. Resolves null
 * when metadata can't be read (rare codecs) — callers fall back to defaults.
 */
export function probeVideo(file: File): Promise<{ duration: number; width: number; height: number } | null> {
  return new Promise((resolve) => {
    try {
      const url = URL.createObjectURL(file);
      const video = document.createElement("video");
      video.muted = true;
      video.preload = "metadata";
      const done = (result: { duration: number; width: number; height: number } | null) => {
        URL.revokeObjectURL(url);
        video.removeAttribute("src");
        resolve(result);
      };
      video.onloadedmetadata = () => {
        const duration = Number.isFinite(video.duration) ? video.duration : 0;
        const width = video.videoWidth || 0;
        const height = video.videoHeight || 0;
        if (duration <= 0 || !width || !height) return done(null);
        done({ duration: Math.round(duration * 10) / 10, width, height });
      };
      video.onerror = () => done(null);
      // Hard timeout — some codecs never fire loadedmetadata.
      setTimeout(() => done(null), 8000);
      video.src = url;
    } catch {
      resolve(null);
    }
  });
}

/**
 * Reduce width/height to a compact "w:h" ratio label (e.g. 1080×1920 → "9:16").
 * Falls back to "9:16" (portrait) or "16:9" (landscape) when inputs are unusable.
 */
export function aspectRatioLabel(width: number, height: number): string {
  if (!width || !height) return "9:16";
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  let w = Math.round(width / gcd(width, height));
  let h = Math.round(height / gcd(width, height));
  // Cap runaway parts (e.g. 360:779) — CSS aspect-ratio accepts these, but
  // very large numbers bloat the label for no visual benefit.
  const cap = 40;
  if (w > cap || h > cap) {
    const scale = Math.min(cap / w, cap / h);
    w = Math.max(1, Math.round(w * scale));
    h = Math.max(1, Math.round(h * scale));
  }
  return `${w}:${h}`;
}
