// ─── Comic Bible content language ─────────────────────────────────────────────
// The Comic Bible presents SELECTED Bible stories in the 13 Koino scripture
// languages. Its content language is deliberately decoupled from the UI
// language (cookie believ_lang) and derived from the user's EXISTING Bible
// translation preference (localStorage cc_bible_version → version →
// languageTag), exactly as the Comic Bible spec requires:
//
//   1. DEFAULT (inheritance): the saved Bible version's language. Resolved
//      through the live version catalogue — never hardcoded per version id.
//   2. OVERRIDES: an explicit pick made inside the Comic Bible reader
//      (cc_comic_lang). It wins until the member changes it again.
//   3. FALLBACKS: saved Bible version unknown/unresolvable → the UI language
//      when it is one of the 13 scripture languages → "en".
//
// Changing language NEVER resets the reading position: the reader re-fetches
// the same story/page with the new lang (see ComicView).

import { SCRIPTURE_LANGUAGES } from "@/lib/bible-versions";
import { sanitizeSavedVersionRef, VERSION_STORAGE_KEY, parseVersionRef } from "@/lib/bible-versions";
import type { BibleVersion } from "@/lib/bible-versions";

export const COMIC_LANG_STORAGE_KEY = "cc_comic_lang";

export type ComicLang = string; // one of the 13 scripture-language tags

export function isComicLang(value: unknown): value is ComicLang {
  return typeof value === "string" && SCRIPTURE_LANGUAGES.some((l) => l.tag === value);
}

/** The explicitly saved comic content language, or null when none was picked. */
export function getSavedComicLanguage(): ComicLang | null {
  try {
    const raw = localStorage.getItem(COMIC_LANG_STORAGE_KEY);
    return isComicLang(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function saveComicLanguage(lang: ComicLang): void {
  try {
    localStorage.setItem(COMIC_LANG_STORAGE_KEY, lang);
  } catch {
    /* storage unavailable — the pick simply won't persist */
  }
}

/** The saved Bible version ref (VersionRef), or null. */
export function getSavedBibleVersionRef(): string | null {
  try {
    const raw = localStorage.getItem(VERSION_STORAGE_KEY);
    return raw ? sanitizeSavedVersionRef(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Synchronous best-effort language (used for the FIRST render before the
 * catalogue resolves): the explicit comic pick, else the UI language when it
 * is a scripture language, else English.
 */
export function getComicLanguageSync(uiLang: string): ComicLang {
  return getSavedComicLanguage() || (isComicLang(uiLang) ? uiLang : "en");
}

/**
 * Resolve the effective comic content language (async, used by the reader
 * before fetching story data):
 *   explicit pick → saved Bible version's language → UI language → "en".
 *
 * The catalogue lookup is wrapped in a hard timeout so a slow/dead versions
 * endpoint can never block the reader from opening — it just falls through
 * to the synchronous fallbacks.
 */
export async function resolveComicLanguage(uiLang: string): Promise<ComicLang> {
  const explicit = getSavedComicLanguage();
  if (explicit) return explicit;

  const versionRef = getSavedBibleVersionRef();
  if (versionRef) {
    try {
      const catalog = await Promise.race([
        import("@/lib/bible-fetch").then((m) => m.fetchVersionCatalog()),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500)),
      ]);
      const versions: BibleVersion[] | null = catalog?.versions ?? null;
      if (versions) {
        const parsed = parseVersionRef(versionRef);
        const version = parsed
          ? versions.find((v) => v.provider === parsed.provider && v.id === parsed.id)
          : null;
        if (version && isComicLang(version.languageTag)) return version.languageTag;
      }
    } catch {
      /* catalogue unavailable — fall through */
    }
  }

  return isComicLang(uiLang) ? uiLang : "en";
}

/** Native label for a scripture-language tag (e.g. "te" → "తెలుగు"). */
export function comicLanguageLabel(tag: string): { label: string; nativeLabel: string } {
  const found = SCRIPTURE_LANGUAGES.find((l) => l.tag === tag);
  if (found) return { label: found.label, nativeLabel: found.nativeLabel };
  return { label: tag.toUpperCase(), nativeLabel: tag };
}
