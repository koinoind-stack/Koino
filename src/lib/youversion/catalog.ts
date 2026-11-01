// ─── YouVersion version catalogue — server-side, cached (SERVER-ONLY) ───────
//
// Retrieves the ACTUAL catalogue of Bible versions Koino's App Key may use
// (GET /v1/bibles with all_available unset → the platform only returns
// versions the app is licensed for). Nothing publicly listed is assumed to
// be licensed: this call is the single source of truth.
//
// YouVersion's multi-language-range query is first-match-wins, so the
// catalogue is built by querying each Koino scripture language separately
// (English + 12 Indian languages, incl. Urdu and Assamese) and merging.
//
// Cache: in-memory, 6-hour TTL with stale-on-error (a previous good catalogue
// keeps serving if the API starts failing — graceful degradation).

import { listBiblesForLanguage, getBibleMeta, YouVersionError } from "./client";
import { getYouVersionConfig } from "./config";
import {
  SCRIPTURE_LANGUAGES,
  type BibleVersion,
} from "@/lib/bible-versions";

const CATALOG_TTL_MS = 6 * 60 * 60 * 1000;
const META_TTL_MS = 6 * 60 * 60 * 1000;

type CatalogState = { at: number; versions: BibleVersion[] };
let catalogCache: CatalogState | null = null;
const metaCache = new Map<string, { at: number; meta: BibleVersion }>();

function toBibleVersion(b: {
  id: number;
  abbreviation?: string;
  localized_abbreviation?: string;
  title?: string;
  localized_title?: string;
  language_tag?: string;
  copyright?: string;
  promotional_content?: string;
}): BibleVersion | null {
  if (typeof b?.id !== "number") return null;
  const lang = (b.language_tag || "").trim().toLowerCase();
  if (!lang) return null;
  const sl = scriptureLanguage(lang);
  return {
    provider: "youversion",
    id: String(b.id),
    label: b.localized_title || b.title || `Bible ${b.id}`,
    abbr: b.localized_abbreviation || b.abbreviation || `YV${b.id}`,
    languageTag: lang,
    languageLabel: sl.label,
    nativeLanguageLabel: sl.nativeLabel,
    attribution: (b.copyright || b.promotional_content || "").trim() || null,
  };
}

function scriptureLanguage(tag: string): { tag: string; label: string; nativeLabel: string } {
  const found = SCRIPTURE_LANGUAGES.find((l) => l.tag === tag);
  if (found) return found;
  return { tag, label: tag.toUpperCase(), nativeLabel: tag };
}

/**
 * Build the merged catalogue across all Koino scripture languages.
 * Dedupes by provider id (a version listed under two ranges stays once).
 * Order: catalogue order (en first, then Indian languages).
 * NEVER throws — failures return [] so callers fall back to Koino versions.
 */
export async function getYouVersionCatalog(forceRefresh = false): Promise<BibleVersion[]> {
  const cfg = getYouVersionConfig();
  if (!cfg.enabled) return [];

  const fresh = catalogCache && Date.now() - catalogCache.at < CATALOG_TTL_MS;
  if (fresh && !forceRefresh) return catalogCache!.versions;

  try {
    const merged: BibleVersion[] = [];
    const seen = new Set<string>();
    for (const lang of SCRIPTURE_LANGUAGES) {
      let bibles;
      try {
        bibles = await listBiblesForLanguage(lang.tag);
      } catch (err) {
        // one language failing must not take down the whole catalogue
        logCatalogIssue("language", lang.tag, err);
        continue;
      }
      for (const b of bibles) {
        const v = toBibleVersion(b);
        if (!v || seen.has(v.id)) continue;
        seen.add(v.id);
        merged.push(v);
      }
    }
    if (merged.length === 0 && catalogCache) {
      // upstream returned nothing usable — keep serving the stale catalogue
      logCatalogIssue("catalog", "empty-refresh", new Error("empty catalogue; keeping stale"));
      return catalogCache.versions;
    }
    catalogCache = { at: Date.now(), versions: merged };
    return merged;
  } catch (err) {
    logCatalogIssue("catalog", "refresh", err);
    // stale-on-error
    if (catalogCache) return catalogCache.versions;
    return [];
  }
}

/** Attribution metadata for one YouVersion bible_id (catalogue hit or API). */
export async function getYouVersionBibleVersion(id: string): Promise<BibleVersion | null> {
  // fast path: the cached catalogue
  if (catalogCache) {
    const hit = catalogCache.versions.find((v) => v.id === id);
    if (hit && Date.now() - catalogCache.at < META_TTL_MS) return hit;
  }

  const cached = metaCache.get(id);
  if (cached && Date.now() - cached.at < META_TTL_MS) return cached.meta;

  try {
    const meta = await getBibleMeta(id);
    const v = toBibleVersion(meta);
    if (!v) return null;
    metaCache.set(id, { at: Date.now(), meta: v });
    return v;
  } catch (err) {
    logCatalogIssue("meta", id, err);
    // fall back to the (possibly stale) catalogue entry
    if (catalogCache) return catalogCache.versions.find((v) => v.id === id) || null;
    return null;
  }
}

function logCatalogIssue(scope: string, key: string, err: unknown): void {
  // Server-side log only; NEVER logs the App Key or raw headers.
  const kind = err instanceof YouVersionError ? err.kind : "error";
  console.error(`[youversion-catalog] ${scope}=${key} kind=${kind}`);
}

/** Test hook: reset module caches. */
export function __resetYouVersionCatalogForTests(): void {
  catalogCache = null;
  metaCache.clear();
}
