// ─── Unified Bible fetching (CLIENT) ────────────────────────────────────────
//
// All scripture requests go through Koino's own API (/api/bible/*), so the
// YouVersion App Key stays on the server. The client never sees credentials
// and never talks to YouVersion directly.
//
// Caching mirrors the existing Koino reader behavior: chapter text is cached
// in localStorage for 30 days (offline reuse), keyed by provider version.

import type { BibleChapterResponse, SearchResult } from "@/lib/bible-data";
import { BIBLE_BOOKS } from "@/lib/bible-data";
import type { BibleVersion, VersionRef } from "@/lib/bible-versions";

export type UnifiedChapter = BibleChapterResponse & {
  provider: "youversion" | "koino";
  versionRef: VersionRef;
  versionAbbr: string;
  versionLabel: string;
  languageTag: string;
  attribution: string | null;
};

export type ChapterErrorKind =
  | "bad_request"
  | "disabled"
  | "unauthorized"
  | "unlicensed"
  | "not_found"
  | "rate_limited"
  | "empty"
  | "server"
  | "network";

export class BibleFetchError extends Error {
  kind: ChapterErrorKind;
  status: number;

  constructor(kind: ChapterErrorKind, status: number, message: string) {
    super(message);
    this.name = "BibleFetchError";
    this.kind = kind;
    this.status = status;
  }
}

// ─── Version catalogue (client-side short cache) ────────────────────────────

export type VersionCatalog = { enabled: boolean; versions: BibleVersion[] };

let catalogCache: { at: number; data: VersionCatalog } | null = null;
const CATALOG_TTL_MS = 5 * 60 * 1000;
let catalogInFlight: Promise<VersionCatalog> | null = null;

export async function fetchVersionCatalog(): Promise<VersionCatalog> {
  if (catalogCache && Date.now() - catalogCache.at < CATALOG_TTL_MS) return catalogCache.data;
  if (catalogInFlight) return catalogInFlight;

  catalogInFlight = (async () => {
    try {
      const res = await fetch("/api/bible/versions", { cache: "no-store" });
      if (!res.ok) throw new Error(`catalog ${res.status}`);
      const data = (await res.json()) as VersionCatalog;
      catalogCache = { at: Date.now(), data: data };
      return data;
    } finally {
      catalogInFlight = null;
    }
  })();
  return catalogInFlight;
}

export function invalidateVersionCatalog(): void {
  catalogCache = null;
}

// ─── Chapter fetch with localStorage cache (30-day TTL) ─────────────────────

const CH_CACHE_PREFIX = "cc_bible_ch_";
const CH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function chapterCacheKey(versionRef: string, bookId: string, chapter: number): string {
  return `${CH_CACHE_PREFIX}${versionRef}_${bookId}_${chapter}`;
}

export function getCachedChapterVersioned(
  versionRef: string,
  bookId: string,
  chapter: number
): UnifiedChapter | null {
  try {
    const raw = localStorage.getItem(chapterCacheKey(versionRef, bookId, chapter));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.cachedAt > CH_TTL_MS) {
      localStorage.removeItem(chapterCacheKey(versionRef, bookId, chapter));
      return null;
    }
    return parsed.data as UnifiedChapter;
  } catch {
    return null;
  }
}

export function cacheChapterVersioned(
  versionRef: string,
  bookId: string,
  chapter: number,
  data: UnifiedChapter
): void {
  try {
    localStorage.setItem(
      chapterCacheKey(versionRef, bookId, chapter),
      JSON.stringify({ cachedAt: Date.now(), data })
    );
  } catch {
    // localStorage full — ignore (same policy as the existing Koino cache)
  }
}

/** Fetch a chapter through Koino's unified Bible API (localStorage cache first). */
export async function fetchChapterVersioned(
  versionRef: string,
  bookId: string,
  chapter: number
): Promise<UnifiedChapter> {
  const cached = getCachedChapterVersioned(versionRef, bookId, chapter);
  if (cached) return cached;

  const params = new URLSearchParams({ version: versionRef, book: bookId, chapter: String(chapter) });
  let res: Response;
  try {
    res = await fetch(`/api/bible/chapter?${params.toString()}`, { cache: "no-store" });
  } catch {
    throw new BibleFetchError("network", 0, "Network request failed");
  }

  if (!res.ok) {
    let kind: ChapterErrorKind = "network";
    try {
      const body = await res.json();
      kind = body?.error?.kind || "network";
    } catch {
      // keep default kind
    }
    throw new BibleFetchError(kind, res.status, `Chapter fetch failed (${kind})`);
  }

  const data = (await res.json()) as UnifiedChapter;
  cacheChapterVersioned(versionRef, bookId, chapter, data);
  return data;
}

// ─── Reference lookup through the selected version ──────────────────────────
// "John 3:16" / "1 Cor 13:4-7" → resolves the book, loads the chapter through
// the unified API (YouVersion primary / Koino fallback) and extracts the
// verse(s). One lookup path for every version — no provider-specific branch
// in the UI.

const REF_RE = /^([\d]?\s?[A-Za-z]+)\s+(\d+):(\d+)(?:-(\d+))?$/;

export async function lookupReferenceVersioned(
  query: string,
  versionRef: string
): Promise<SearchResult | null> {
  const m = query.trim().match(REF_RE);
  if (!m) return null;
  const bookText = m[1].replace(/\s+/g, "").toLowerCase();
  const chapter = Number(m[2]);
  const verseStart = Number(m[3]);
  const verseEnd = m[4] ? Number(m[4]) : verseStart;

  const book = BIBLE_BOOKS.find((b) => {
    const norm = b.name.toLowerCase().replace(/\s+/g, "");
    return norm === bookText || b.id === bookText || b.abbr.toLowerCase() === bookText;
  });
  if (!book || chapter < 1 || chapter > book.chapters || verseStart < 1) return null;

  try {
    const data = await fetchChapterVersioned(versionRef, book.id, chapter);
    const verses = data.verses.filter((v) => v.verse >= verseStart && v.verse <= verseEnd);
    if (!verses.length) return null;
    return {
      bookId: book.id,
      bookName: book.name,
      chapter,
      verse: verseStart,
      text: verses.map((v) => `${v.verse} ${v.text.trim()}`).join(" "),
    };
  } catch {
    // unavailable version / network issue — treated as "not found" by callers
    return null;
  }
}
