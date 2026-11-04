// ─── Bible Movies & Video Library (Part 5) — shared helpers ────────────────
// Pure TypeScript: safe to import from BOTH client components and API routes.
// No server-only imports allowed in this file.

// ─── Categories ─────────────────────────────────────────────────────────────
// Spec §1 — the ten browse categories. Stored as stable string codes so
// labels can be translated later without a data migration.

export const VIDEO_CATEGORIES = [
  { id: "bible_movies", label: "Bible Movies" },
  { id: "ot_stories", label: "Old Testament Stories" },
  { id: "nt_stories", label: "New Testament Stories" },
  { id: "jesus_gospels", label: "Jesus and the Gospels" },
  { id: "animated", label: "Animated Bible Stories" },
  { id: "christian_films", label: "Christian Films" },
  { id: "sermons", label: "Sermons and Bible Teachings" },
  { id: "worship", label: "Worship and Christian Music" },
  { id: "documentaries", label: "Documentaries and Christian History" },
  { id: "children", label: "Children's Bible Videos" },
] as const;

export type VideoCategoryId = (typeof VIDEO_CATEGORIES)[number]["id"];

export function isVideoCategory(v: string): v is VideoCategoryId {
  return VIDEO_CATEGORIES.some((c) => c.id === v);
}

export function categoryLabel(id: string): string {
  return VIDEO_CATEGORIES.find((c) => c.id === id)?.label || id;
}

// ─── Languages ──────────────────────────────────────────────────────────────
// Mirror of the 13 Koino UI languages (LanguageContext LANGUAGES) kept as a
// plain list here so server routes can validate codes without importing
// client React context files. Display uses nativeLabel everywhere.

export const VIDEO_LANGUAGES = [
  { code: "en", name: "English", nativeLabel: "English" },
  { code: "hi", name: "Hindi", nativeLabel: "हिन्दी" },
  { code: "bn", name: "Bengali", nativeLabel: "বাংলা" },
  { code: "te", name: "Telugu", nativeLabel: "తెలుగు" },
  { code: "mr", name: "Marathi", nativeLabel: "मराठी" },
  { code: "ta", name: "Tamil", nativeLabel: "தமிழ்" },
  { code: "gu", name: "Gujarati", nativeLabel: "ગુજરાતી" },
  { code: "ur", name: "Urdu", nativeLabel: "اردو" },
  { code: "kn", name: "Kannada", nativeLabel: "ಕನ್ನಡ" },
  { code: "or", name: "Odia", nativeLabel: "ଓଡ଼ିଆ" },
  { code: "ml", name: "Malayalam", nativeLabel: "മലയാളം" },
  { code: "pa", name: "Punjabi", nativeLabel: "ਪੰਜਾਬੀ" },
  { code: "as", name: "Assamese", nativeLabel: "অসমীয়া" },
] as const;

export function languageLabel(code: string | null | undefined): string {
  if (!code) return "";
  return VIDEO_LANGUAGES.find((l) => l.code === code)?.nativeLabel || code;
}

export function isVideoLanguage(code: string): boolean {
  return VIDEO_LANGUAGES.some((l) => l.code === code);
}

// ─── YouTube helpers ────────────────────────────────────────────────────────

/** Extract an 11-char YouTube video id from the URL forms admins will paste,
 *  or accept a bare 11-char id. Returns null for anything else.
 *  Supported: youtube.com/watch?v=, youtu.be/, /embed/, /shorts/, /live/,
 *  m.youtube.com, music.youtube.com, and plain ids. */
export function parseYouTubeId(input: string): string | null {
  const raw = (input || "").trim();
  if (!raw) return null;
  // Bare id
  if (/^[a-zA-Z0-9_-]{11}$/.test(raw)) return raw;
  try {
    const url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    const isYt =
      host === "youtube.com" ||
      host === "m.youtube.com" ||
      host === "music.youtube.com" ||
      host === "youtube-nocookie.com" ||
      host === "youtu.be";
    if (!isYt) return null;
    if (host === "youtu.be") {
      const id = url.pathname.slice(1).split("/")[0];
      return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }
    const v = url.searchParams.get("v");
    if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;
    const m = url.pathname.match(/^\/(embed|shorts|live|v)\/([a-zA-Z0-9_-]{11})/);
    if (m) return m[2];
    return null;
  } catch {
    return null;
  }
}

/** Standard watch URL for a YouTube id (used for "Watch on YouTube" links). */
export function youtubeWatchUrl(youtubeId: string): string {
  return `https://www.youtube.com/watch?v=${youtubeId}`;
}

/** Reliable poster image — hqdefault always exists for valid videos
 *  (maxresdefault is often missing). */
export function youtubeThumbnail(youtubeId: string): string {
  return `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`;
}

/** Privacy-enhanced official embed URL. `start` resumes playback at a
 *  position (seconds) for the Continue Watching feature. */
export function youtubeEmbedUrl(youtubeId: string, startSec = 0): string {
  const params = new URLSearchParams({ rel: "0", modestbranding: "1" });
  if (startSec > 0) params.set("start", String(Math.floor(startSec)));
  return `https://www.youtube-nocookie.com/embed/${youtubeId}?${params.toString()}`;
}

// ─── Duration formatting ────────────────────────────────────────────────────

export function formatDuration(sec: number | null | undefined): string {
  if (!sec || sec <= 0) return "";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Parse admin-entered duration "mm:ss" / "h:mm:ss" / "90" (minutes) → seconds. */
export function parseDurationInput(input: string): number | null {
  const raw = (input || "").trim();
  if (!raw) return null;
  if (/^\d+$/.test(raw)) return parseInt(raw, 10) * 60; // bare number = minutes
  const parts = raw.split(":").map((p) => parseInt(p, 10));
  if (parts.some((p) => Number.isNaN(p) || p < 0)) return null;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
}

// ─── Slugs ──────────────────────────────────────────────────────────────────

export function slugifyTitle(title: string): string {
  const base = (title || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60)
    .replace(/^-|-$/g, "");
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base || "video"}-${suffix}`;
}

// ─── Bible refs ─────────────────────────────────────────────────────────────
// Display helper. Book names are resolved by the caller passing a lookup
// function so this file does not need the (client-safe but large) BIBLE_BOOKS
// list — components import that directly.

export type BibleRefLike = {
  bookId: string;
  chapterStart: number;
  verseStart?: number | null;
  chapterEnd?: number | null;
  verseEnd?: number | null;
};

export function formatBibleRef(
  ref: BibleRefLike,
  bookName: (bookId: string) => string
): string {
  const name = bookName(ref.bookId) || ref.bookId;
  const startVerse = ref.verseStart ? `:${ref.verseStart}` : "";
  if (ref.chapterEnd && ref.chapterEnd !== ref.chapterStart) {
    return `${name} ${ref.chapterStart}${startVerse}–${ref.chapterEnd}${ref.verseEnd ? `:${ref.verseEnd}` : ""}`;
  }
  if (ref.verseEnd && ref.verseStart && ref.verseEnd !== ref.verseStart) {
    return `${name} ${ref.chapterStart}:${ref.verseStart}–${ref.verseEnd}`;
  }
  return `${name} ${ref.chapterStart}${startVerse}`;
}
