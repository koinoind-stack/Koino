/**
 * YouTube URL parsing + display helpers shared by the memorial UI and the
 * server-side validation. Pure functions only — safe to import anywhere.
 *
 * Only public YouTube watch pages are accepted. The raw URL is never trusted:
 * we extract the 11-character video id and rebuild every embed/thumbnail link
 * ourselves, so arbitrary iframe HTML or scripts can never get through.
 */

export const MEMORIAL_VIDEO_CATEGORIES = [
  { id: "life_story", label: "Life Story" },
  { id: "testimony", label: "Personal Testimony" },
  { id: "funeral", label: "Funeral or Memorial Service" },
  { id: "family", label: "Family Memories" },
  { id: "worship", label: "Worship" },
  { id: "other", label: "Other" },
] as const;

export type MemorialVideoCategory = (typeof MEMORIAL_VIDEO_CATEGORIES)[number]["id"];

export function isMemorialVideoCategory(v: string): v is MemorialVideoCategory {
  return MEMORIAL_VIDEO_CATEGORIES.some((c) => c.id === v);
}

/**
 * Extracts the YouTube video id from any of:
 *   youtube.com/watch?v=VIDEO_ID (+ extra params)
 *   m.youtube.com/watch?v=VIDEO_ID
 *   music.youtube.com/watch?v=VIDEO_ID
 *   youtu.be/VIDEO_ID
 *   youtube.com/shorts/VIDEO_ID
 *   youtube.com/embed/VIDEO_ID
 *   youtube.com/live/VIDEO_ID
 * Returns null for anything else (including wrapped playlists or IDs that are
 * not exactly 11 characters of [A-Za-z0-9_-]).
 */
export function extractYouTubeId(rawUrl: string): string | null {
  const url = rawUrl.trim();
  if (!url) return null;

  let parsed: URL;
  try {
    // Accept bare youtu.be/ID without protocol for convenience.
    parsed = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`);
  } catch {
    return null;
  }

  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  const isYouTubeHost =
    host === "youtube.com" ||
    host === "m.youtube.com" ||
    host === "music.youtube.com" ||
    host === "youtu.be";
  if (!isYouTubeHost) return null;

  let id: string | null = null;
  if (host === "youtu.be") {
    id = parsed.pathname.split("/")[1] || null;
  } else if (parsed.pathname === "/watch" || parsed.pathname.startsWith("/watch/")) {
    id = parsed.searchParams.get("v");
  } else {
    const segments = parsed.pathname.split("/").filter(Boolean); // shorts/embed/live/<id>
    if (segments.length === 2 && ["shorts", "embed", "live"].includes(segments[0])) {
      id = segments[1];
    }
  }

  if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id)) return null;
  return id;
}

/** Privacy-enhanced embed URL (youtube-nocookie.com). */
export function youtubeEmbedUrl(videoId: string): string {
  return `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1`;
}

/** Public watch page — the "Open on YouTube" fallback. */
export function youtubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

/** Thumbnail (hqdefault always exists, even for unembeddable videos). */
export function youtubeThumbUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}
