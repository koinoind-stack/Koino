// ─── Unified Bible version model (client-safe, no secrets) ──────────────────
//
// ONE Bible reader, ONE version selector. Two internal providers:
//   • youversion — primary. Versions come live from the YouVersion Platform
//     catalogue (server-side; only versions Koino is licensed to use).
//   • koino      — fallback. The two public-domain English translations
//     served through bible-api.com (KJV, WEB). Used only when YouVersion is
//     disabled, fails, or cannot serve an equivalent version.
//
// Scripture language is decoupled from the Koino UI language: the selector
// lists English + Indian-language versions and the user picks freely — e.g.
// browse Koino in Telugu while reading the English KJV, or browse in English
// while reading a licensed Telugu Bible.
//
// SECURITY: this module must never import the YouVersion config (which holds
// the App Key). It contains data + pure helpers only, safe for client bundles.

import { TRANSLATIONS, BIBLE_LANGUAGES, type Translation } from "@/lib/bible-data";

export type BibleProvider = "youversion" | "koino";

/** A selectable Bible version shown in the unified selector. */
export type BibleVersion = {
  provider: BibleProvider;
  /** Provider-native id: YouVersion numeric bible_id (e.g. "3034"); koino: "kjv" | "web". */
  id: string;
  /** Full version name, e.g. "Berean Standard Bible". */
  label: string;
  /** Short abbreviation shown in chips/buttons, e.g. "BSB", "KJV". */
  abbr: string;
  /** BCP-47-style language tag from the provider catalogue, e.g. "en", "te". */
  languageTag: string;
  /** English name of the language, e.g. "Telugu". */
  languageLabel: string;
  /** Native script name of the language, e.g. "తెలుగు". */
  nativeLanguageLabel: string;
  /** Copyright/attribution text from the version metadata (displayed to users). */
  attribution: string | null;
  /**
   * Koino-fallback-only flag: an equivalent YouVersion version covers this
   * translation, so the fallback entry is hidden from the selector to avoid
   * duplicates. It stays resolvable as an emergency fallback path.
   */
  coveredByYouVersion?: boolean;
};

/** Wire format for a version reference: "youversion:3034" / "koino:kjv". */
export type VersionRef = string;

export const DEFAULT_VERSION_REF: VersionRef = "koino:kjv";
export const VERSION_STORAGE_KEY = "cc_bible_version";

export function formatVersionRef(v: Pick<BibleVersion, "provider" | "id">): VersionRef {
  return `${v.provider}:${v.id}`;
}

export function parseVersionRef(ref: string | null | undefined): { provider: BibleProvider; id: string } | null {
  if (!ref) return null;
  const idx = ref.indexOf(":");
  if (idx <= 0) return null;
  const provider = ref.slice(0, idx);
  const id = ref.slice(idx + 1);
  if (!id) return null;
  if (provider !== "youversion" && provider !== "koino") return null;
  return { provider, id };
}

// ─── Scripture languages (English + the 10 Indian languages Koino lists) ────
// Independent of the UI language selection: a reader can pick scripture in
// any of these languages regardless of the interface language.

export const SCRIPTURE_LANGUAGES = BIBLE_LANGUAGES.map((l) => ({
  tag: l.id,
  label: l.label,
  nativeLabel: l.nativeLabel,
}));

export function scriptureLanguage(tag: string): { tag: string; label: string; nativeLabel: string } {
  const found = SCRIPTURE_LANGUAGES.find((l) => l.tag === tag);
  if (found) return found;
  return { tag, label: tag.toUpperCase(), nativeLabel: tag };
}

// ─── Koino fallback versions (existing public-domain provider) ──────────────
// Built from the existing TRANSLATIONS list so the fallback stays defined in
// exactly one place. These are English-only; served via bible-api.com.

export const KOINO_FALLBACK_VERSIONS: BibleVersion[] = TRANSLATIONS.map((tr) => ({
  provider: "koino" as const,
  id: tr.id as Translation,
  label: tr.label,
  abbr: tr.abbr,
  languageTag: "en",
  languageLabel: "English",
  nativeLanguageLabel: "English",
  attribution: `${tr.label}. ${tr.description}. Public domain.`,
}));

export function findVersion(ref: VersionRef, versions: BibleVersion[]): BibleVersion | null {
  return versions.find((v) => formatVersionRef(v) === ref) || null;
}

/**
 * Resolve a version ref even if the live catalogue no longer contains it:
 * YouVersion refs fall back to a generic descriptor so the reader can show a
 * meaningful error instead of breaking; koino refs resolve from the static list.
 */
export function resolveVersionOrGeneric(ref: VersionRef, versions: BibleVersion[]): BibleVersion | null {
  const hit = findVersion(ref, versions);
  if (hit) return hit;
  const parsed = parseVersionRef(ref);
  if (!parsed) return null;
  if (parsed.provider === "koino") {
    return KOINO_FALLBACK_VERSIONS.find((v) => v.id === parsed.id) || null;
  }
  return {
    provider: "youversion",
    id: parsed.id,
    label: `YouVersion Bible #${parsed.id}`,
    abbr: "…",
    languageTag: "en",
    languageLabel: "English",
    nativeLanguageLabel: "English",
    attribution: null,
  };
}

// ─── Book code mapping: Koino slug → USFM book code (YouVersion) ────────────
// Koino uses bible-api.com slugs internally ("1corinthians", "song_of_solomon").
// YouVersion addresses books with 3-letter USFM codes ("1CO", "SNG").

export const SLUG_TO_USFM: Record<string, string> = {
  genesis: "GEN", exodus: "EXO", leviticus: "LEV", numbers: "NUM", deuteronomy: "DEU",
  joshua: "JOS", judges: "JDG", ruth: "RUT", "1samuel": "1SA", "2samuel": "2SA",
  "1kings": "1KI", "2kings": "2KI", "1chronicles": "1CH", "2chronicles": "2CH",
  ezra: "EZR", nehemiah: "NEH", esther: "EST", job: "JOB", psalms: "PSA",
  proverbs: "PRO", ecclesiastes: "ECC", song_of_solomon: "SNG", isaiah: "ISA",
  jeremiah: "JER", lamentations: "LAM", ezekiel: "EZK", daniel: "DAN", hosea: "HOS",
  joel: "JOL", amos: "AMO", obadiah: "OBA", jonah: "JON", micah: "MIC", nahum: "NAM",
  habakkuk: "HAB", zephaniah: "ZEP", haggai: "HAG", zechariah: "ZEC", malachi: "MAL",
  matthew: "MAT", mark: "MRK", luke: "LUK", john: "JHN", acts: "ACT", romans: "ROM",
  "1corinthians": "1CO", "2corinthians": "2CO", galatians: "GAL", ephesians: "EPH",
  philippians: "PHP", colossians: "COL", "1thessalonians": "1TH", "2thessalonians": "2TH",
  "1timothy": "1TI", "2timothy": "2TI", titus: "TIT", philemon: "PHM", hebrews: "HEB",
  james: "JAS", "1peter": "1PE", "2peter": "2PE", "1john": "1JN", "2john": "2JN",
  "3john": "3JN", jude: "JUD", revelation: "REV",
};

export function usfmChapterRef(bookSlug: string, chapter: number): string | null {
  const usfm = SLUG_TO_USFM[bookSlug];
  return usfm ? `${usfm}.${chapter}` : null;
}

export function usfmVerseRef(bookSlug: string, chapter: number, verse: number): string | null {
  const usfm = SLUG_TO_USFM[bookSlug];
  return usfm ? `${usfm}.${chapter}.${verse}` : null;
}

// ─── Duplicate suppression across providers ─────────────────────────────────
// A Koino fallback entry is "covered" when the YouVersion catalogue already
// provides an equivalent translation in the same language (matched by
// normalized abbreviation — KJV, WEB). The covered entry stays resolvable as
// a resilient fallback path but is hidden from the selector.

function normalizeAbbr(abbr: string): string {
  return abbr.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function markCoveredFallbacks(versions: BibleVersion[]): BibleVersion[] {
  const yv = versions.filter((v) => v.provider === "youversion");
  return versions.map((v) => {
    if (v.provider !== "koino") return v;
    const covered = yv.some(
      (y) =>
        y.languageTag === v.languageTag &&
        (normalizeAbbr(y.abbr) === normalizeAbbr(v.abbr) ||
          normalizeAbbr(y.label) === normalizeAbbr(v.label))
    );
    return covered ? { ...v, coveredByYouVersion: true } : v;
  });
}
