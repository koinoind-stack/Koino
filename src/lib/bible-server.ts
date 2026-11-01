// ─── Unified chapter resolution — server-side core (SERVER-ONLY) ────────────
//
// ONE chapter endpoint backs the ONE reader:
//   GET /api/bible/chapter?version=<provider:id>&book=<slug>&chapter=<n>
//
// Resolution order (YouVersion primary, Koino fallback):
//   • koino:<id>       → bible-api.com (public-domain KJV/WEB transport)
//   • youversion:<id>  → YouVersion Platform passage API (format=text),
//                        verse-split server-side, attribution attached
//
// Graceful degradation:
//   • YouVersion disabled → koino refs keep working; youversion refs return a
//     structured error the reader turns into a friendly unavailable state.
//   • YouVersion failures (403 unlicensed / 429 / 5xx / network) → structured
//     error; KJV/WEB equivalents also fall back to the koino transport when
//     their YouVersion copy fails, so the two public-domain translations
//     remain reachable through the existing provider.
//
// Caching: chapter text is immutable → in-memory cache (24h TTL, LRU-capped)
// for both providers. No user data, no keys in cached content.
//
// SECURITY: App Key never leaves the server; errors never embed keys/headers.

import { BIBLE_BOOKS, type BibleChapterResponse } from "@/lib/bible-data";
import {
  parseVersionRef,
  usfmChapterRef,
  KOINO_FALLBACK_VERSIONS,
  type BibleVersion,
} from "@/lib/bible-versions";
import { getPassage, YouVersionError } from "@/lib/youversion/client";
import { getYouVersionBibleVersion } from "@/lib/youversion/catalog";
import { parseVerseText } from "@/lib/youversion/text";

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

export type ChapterResult =
  | {
      ok: true;
      data: BibleChapterResponse & {
        provider: "youversion" | "koino";
        versionRef: string;
        versionAbbr: string;
        versionLabel: string;
        languageTag: string;
        attribution: string | null;
      };
    }
  | { ok: false; kind: ChapterErrorKind; status: number; message: string };

// ─── in-memory chapter cache (immutable text) ───────────────────────────────
const CHAPTER_TTL_MS = 24 * 60 * 60 * 1000;
const CHAPTER_CACHE_MAX = 2000;
const chapterCache = new Map<string, { at: number; value: ChapterResult }>();

function cacheGet(key: string): ChapterResult | null {
  const hit = chapterCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CHAPTER_TTL_MS) {
    chapterCache.delete(key);
    return null;
  }
  return hit.value;
}

function cacheSet(key: string, value: ChapterResult): void {
  if (chapterCache.size >= CHAPTER_CACHE_MAX) {
    // drop the oldest entry (insertion-order map = simple FIFO eviction)
    const oldest = chapterCache.keys().next().value;
    if (oldest !== undefined) chapterCache.delete(oldest);
  }
  chapterCache.set(key, { at: Date.now(), value });
}

export function __resetBibleServerCachesForTests(): void {
  chapterCache.clear();
}

// ─── Koino fallback transport (bible-api.com, public domain) ────────────────

const KOINO_TTL_MS = 24 * 60 * 60 * 1000;
const koinoCache = new Map<string, { at: number; data: BibleChapterResponse | null }>();

export async function fetchKoinoChapter(
  bookSlug: string,
  chapter: number,
  translation: "kjv" | "web"
): Promise<BibleChapterResponse | null> {
  const key = `${translation}/${bookSlug}/${chapter}`;
  const cached = koinoCache.get(key);
  if (cached && Date.now() - cached.at < KOINO_TTL_MS) return cached.data;

  const book = BIBLE_BOOKS.find((b) => b.id === bookSlug);
  const reference = `${book?.name || bookSlug} ${chapter}`;
  try {
    const res = await fetch(
      `https://bible-api.com/${encodeURIComponent(reference)}?translation=${translation}`,
      { cache: "no-store", signal: AbortSignal.timeout(15000) }
    );
    if (!res.ok) {
      koinoCache.set(key, { at: Date.now(), data: null });
      return null;
    }
    const data = (await res.json()) as BibleChapterResponse;
    koinoCache.set(key, { at: Date.now(), data });
    return data;
  } catch {
    koinoCache.set(key, { at: Date.now(), data: null });
    return null;
  }
}

// ─── YouVersion chapter transport ───────────────────────────────────────────

async function fetchYouVersionChapter(
  versionId: string,
  bookSlug: string,
  chapter: number
): Promise<ChapterResult> {
  const ref = usfmChapterRef(bookSlug, chapter);
  if (!ref) {
    return { ok: false, kind: "bad_request", status: 400, message: `Unknown book: ${bookSlug}` };
  }

  const version: BibleVersion | null = await getYouVersionBibleVersion(versionId);

  try {
    const passage = await getPassage(versionId, ref, { format: "text" });
    const parsed = parseVerseText(passage.content);
    const book = BIBLE_BOOKS.find((b) => b.id === bookSlug);

    return {
      ok: true,
      data: {
        reference: passage.reference || `${book?.name || bookSlug} ${chapter}`,
        verses: parsed.verses.map((v) => ({
          book_id: bookSlug,
          book_name: book?.name || bookSlug,
          chapter,
          verse: v.verse,
          text: v.text,
        })),
        translation_id: version?.abbr || String(versionId),
        translation_name: version?.label || `YouVersion Bible ${versionId}`,
        translation_note: parsed.degraded
          ? "Chapter text served as a single block (verse markers unavailable)."
          : "",
        provider: "youversion",
        versionRef: `youversion:${versionId}`,
        versionAbbr: version?.abbr || String(versionId),
        versionLabel: version?.label || `YouVersion Bible ${versionId}`,
        languageTag: version?.languageTag || "en",
        attribution: version?.attribution ?? null,
      },
    };
  } catch (err) {
    if (err instanceof YouVersionError) {
      const status =
        err.kind === "unauthorized" ? 502
        : err.kind === "unlicensed" ? 403
        : err.kind === "not_found" ? 404
        : err.kind === "rate_limited" ? 429
        : err.kind === "empty" ? 404
        : 502;
      return { ok: false, kind: err.kind, status, message: err.message };
    }
    return { ok: false, kind: "server", status: 502, message: "YouVersion passage fetch failed" };
  }
}

// ─── Unified resolution ──────────────────────────────────────────────────────

export async function resolveChapter(
  versionRefRaw: string | null,
  bookSlug: string | null,
  chapterRaw: string | null
): Promise<ChapterResult> {
  const parsed = parseVersionRef(versionRefRaw);
  const book = BIBLE_BOOKS.find((b) => b.id === bookSlug);
  const chapter = Number(chapterRaw);

  if (!parsed || !book || !Number.isInteger(chapter) || chapter < 1 || chapter > book.chapters) {
    return { ok: false, kind: "bad_request", status: 400, message: "Invalid version, book, or chapter" };
  }

  const cacheKey = `${parsed.provider}:${parsed.id}/${book.id}/${chapter}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  let result: ChapterResult;

  if (parsed.provider === "koino") {
    const translation = parsed.id === "web" ? "web" : "kjv";
    const data = await fetchKoinoChapter(book.id, chapter, translation);
    if (!data || !Array.isArray(data.verses) || data.verses.length === 0) {
      result = { ok: false, kind: "network", status: 502, message: "Bible text is temporarily unavailable" };
    } else {
      const fallback = KOINO_FALLBACK_VERSIONS.find((v) => v.id === translation);
      result = {
        ok: true,
        data: {
          ...data,
          provider: "koino",
          versionRef: `koino:${translation}`,
          versionAbbr: fallback?.abbr || translation.toUpperCase(),
          versionLabel: fallback?.label || translation.toUpperCase(),
          languageTag: "en",
          attribution: fallback?.attribution ?? null,
        },
      };
    }
  } else {
    result = await fetchYouVersionChapter(parsed.id, book.id, chapter);

    // Resilient fallback for the two public-domain English translations: if
    // their YouVersion copy is unavailable, serve the same translation via
    // the existing Koino transport instead of failing the reader.
    if (!result.ok && (parsed.id === "kjv" || parsed.id === "web")) {
      const translation = parsed.id === "web" ? "web" : "kjv";
      const data = await fetchKoinoChapter(book.id, chapter, translation);
      if (data && Array.isArray(data.verses) && data.verses.length > 0) {
        const fallback = KOINO_FALLBACK_VERSIONS.find((v) => v.id === translation);
        result = {
          ok: true,
          data: {
            ...data,
            provider: "koino",
            versionRef: `koino:${translation}`,
            versionAbbr: fallback?.abbr || translation.toUpperCase(),
            versionLabel: fallback?.label || translation.toUpperCase(),
            languageTag: "en",
            attribution: fallback?.attribution ?? null,
          },
        };
      }
    }
  }

  // cache failures briefly too (10 min) so an outage doesn't hammer upstreams
  if (result.ok) {
    cacheSet(cacheKey, result);
  } else if (result.kind !== "bad_request") {
    chapterCache.set(cacheKey, { at: Date.now() - CHAPTER_TTL_MS + 10 * 60 * 1000, value: result });
  }

  return result;
}
