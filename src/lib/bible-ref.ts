// ─── Bible reference parsing / formatting / validation ──────────────────────
//
// PART 2 shared library for the apologetics CMS. Canonicalizes user input into
// display strings like "John 1:1–3" (en dash), validates them against the
// Koino canon (BIBLE_BOOKS — 66 books with chapter counts), and builds deep
// links into the existing Bible reader (/?view=bible&book=<id>&chapter=<n>).
//
// NO Bible text is stored or fetched here — references link to the existing
// reader, which fetches from bible-api.com (KJV/WEB) like everywhere else.
//
// Canonical storage format: plain display strings inside the existing
// KoinoArticle.bibleRefs / UserQuestion.bibleRefs JSON arrays, e.g.
//   ["John 20:1–29", "1 Corinthians 15:3–8", "Psalms 119"]
// so every existing consumer (cards, article page, share cards) keeps working.

import { BIBLE_BOOKS, type BibleBook } from "./bible-data";

export type ParsedBibleRef = {
  bookId: string; // bible-api slug, e.g. "1corinthians"
  bookName: string; // display name, e.g. "1 Corinthians"
  chapter: number;
  verseStart: number | null;
  verseEnd: number | null;
  singleChapter?: boolean; // one-chapter books (Jude, Obadiah…) referenced by verse
};

// ─── Book-name resolution ────────────────────────────────────────────────────

// Common abbreviations beyond the official `abbr` field. Keys are normalized
// (lowercase, no spaces/dots).
const EXTRA_BOOK_ALIASES: Record<string, string> = {
  gen: "genesis",
  ge: "genesis",
  ex: "exodus",
  exo: "exodus",
  lev: "leviticus",
  lv: "leviticus",
  num: "numbers",
  nm: "numbers",
  deut: "deuteronomy",
  dt: "deuteronomy",
  josh: "joshua",
  jsh: "joshua",
  judg: "judges",
  jdg: "judges",
  "1sm": "1samuel",
  "2sm": "2samuel",
  "1kgs": "1kings",
  "2kgs": "2kings",
  "1chr": "1chronicles",
  "2chr": "2chronicles",
  ps: "psalms",
  psalm: "psalms",
  psalms: "psalms",
  psl: "psalms",
  prov: "proverbs",
  pr: "proverbs",
  eccl: "ecclesiastes",
  ecc: "ecclesiastes",
  sos: "song_of_solomon",
  song: "song_of_solomon",
  isa: "isaiah",
  jer: "jeremiah",
  lam: "lamentations",
  eze: "ezekiel",
  ezk: "ezekiel",
  dan: "daniel",
  hos: "hosea",
  joel: "joel",
  amos: "amos",
  oba: "obadiah",
  jon: "jonah",
  mic: "micah",
  nah: "nahum",
  hab: "habakkuk",
  zeph: "zephaniah",
  hag: "haggai",
  zech: "zechariah",
  mal: "malachi",
  matt: "matthew",
  mt: "matthew",
  mk: "mark",
  lk: "luke",
  jn: "john",
  act: "acts",
  rom: "romans",
  rm: "romans",
  "1co": "1corinthians",
  "2co": "2corinthians",
  gal: "galatians",
  eph: "ephesians",
  php: "philippians",
  phil: "philippians",
  col: "colossians",
  "1th": "1thessalonians",
  "1thess": "1thessalonians",
  "2th": "2thessalonians",
  "2thess": "2thessalonians",
  "1tim": "1timothy",
  "2tim": "2timothy",
  tit: "titus",
  phm: "philemon",
  heb: "hebrews",
  jas: "james",
  "1pe": "1peter",
  "1pet": "1peter",
  "2pe": "2peter",
  "2pet": "2peter",
  "1jn": "1john",
  "1john": "1john",
  "2jn": "2john",
  "3jn": "3john",
  jud: "jude",
  rev: "revelation",
  reve: "revelation",
};

function normalizeToken(s: string): string {
  return s.toLowerCase().replace(/[\s.]+/g, "");
}

// Lookup table built once at module load.
const BOOK_LOOKUP: Record<string, BibleBook> = {};
for (const b of BIBLE_BOOKS) {
  BOOK_LOOKUP[normalizeToken(b.name)] = b;
  BOOK_LOOKUP[normalizeToken(b.abbr)] = b;
  BOOK_LOOKUP[normalizeToken(b.id)] = b;
}
for (const [alias, bookId] of Object.entries(EXTRA_BOOK_ALIASES)) {
  const book = BIBLE_BOOKS.find((b) => b.id === bookId);
  if (book && !BOOK_LOOKUP[alias]) BOOK_LOOKUP[alias] = book;
}

export function resolveBook(token: string): BibleBook | null {
  const norm = normalizeToken(token);
  if (!norm) return null;
  const direct = BOOK_LOOKUP[norm];
  if (direct) return direct;
  // Prefix fallback so "1cor" matches "1 Corinthians", "gene" matches
  // "Genesis", etc. Only a UNIQUE prefix match resolves — ambiguous tokens
  // ("jo" → Job/Joel/Jonah/John/Joshua/Jonah…) return null.
  const candidates = BIBLE_BOOKS.filter(
    (b) =>
      normalizeToken(b.name).startsWith(norm) ||
      normalizeToken(b.abbr).startsWith(norm) ||
      normalizeToken(b.id).startsWith(norm)
  );
  return candidates.length === 1 ? candidates[0] : null;
}

// ─── Parsing ─────────────────────────────────────────────────────────────────
//
// Accepts: "John 20", "John 20:1", "John 20:1-29", "John 20:1–29" (en/em dash),
// "1 Cor 15:3-8", "1 Corinthians 15:3-8", "Ps 119:105", "Psalm 23",
// "Song of Solomon 8:6", "1 John 1:9". Case-insensitive; book and numbers may
// be separated by spaces and/or dots.

const REF_RE =
  /^\s*([1-3]?\s*[A-Za-z][A-Za-z\s.]*?)\.?\s+(\d{1,3})(?:\s*[:.]\s*(\d{1,3})(?:\s*[–—-]\s*(\d{1,3}))?)?\s*$/;

export type ParseResult =
  | { ok: true; ref: ParsedBibleRef }
  | { ok: false; error: string };

export function parseBibleRef(raw: string): ParseResult {
  const s = (raw ?? "").trim();
  if (!s) return { ok: false, error: "Enter a reference like John 3:16." };

  const m = REF_RE.exec(s);
  if (!m) {
    return {
      ok: false,
      error: "Could not read that reference. Use the form Book Chapter[:Verse[–Verse]], e.g. John 3:16 or 1 Cor 15:3–8.",
    };
  }

  const book = resolveBook(m[1]);
  if (!book) {
    return { ok: false, error: `Unknown Bible book "${m[1].trim()}".` };
  }

  let chapter = parseInt(m[2], 10);
  let verseStart = m[3] ? parseInt(m[3], 10) : null;
  let verseEnd = m[4] ? parseInt(m[4], 10) : null;
  let singleChapter = book.chapters === 1;

  // Single-chapter books (Jude, Obadiah, Philemon, 2/3 John…) are conventionally
  // referenced by verse: "Jude 2" means verse 2, not chapter 2.
  if (singleChapter && chapter > 1) {
    verseEnd = verseStart; // the number after the book is the verse start
    verseStart = chapter;
    chapter = 1;
  }

  if (chapter < 1 || chapter > book.chapters) {
    return {
      ok: false,
      error: `${book.name} has only ${book.chapters} chapter${book.chapters === 1 ? "" : "s"} (got chapter ${chapter}).`,
    };
  }

  verseStart = verseStart ?? null;
  verseEnd = verseEnd ?? null;

  if (verseStart != null && verseStart < 1) {
    return { ok: false, error: "Verses start at 1." };
  }
  // Sanity cap: the longest chapters in the canon are ~176 verses
  // (Psalms 119). Anything above is a typo, not a real verse number.
  const MAX_VERSES = 200;
  if (verseStart != null && verseStart > MAX_VERSES) {
    return { ok: false, error: `Verse ${verseStart} looks too large — chapters max out around ${MAX_VERSES} verses.` };
  }
  if (verseEnd != null && verseStart != null && verseEnd < verseStart) {
    return { ok: false, error: `End verse (${verseEnd}) can't be before the start verse (${verseStart}).` };
  }
  if (verseEnd != null && verseEnd > MAX_VERSES) {
    return { ok: false, error: `Verse ${verseEnd} looks too large — chapters max out around ${MAX_VERSES} verses.` };
  }

  return {
    ok: true,
    ref: {
      bookId: book.id,
      bookName: book.name,
      chapter,
      verseStart,
      verseEnd,
      singleChapter,
    },
  };
}

// ─── Formatting ──────────────────────────────────────────────────────────────

// Canonical display: "John 20:1–29" (en dash), "John 20:1", "John 20".
// Single-chapter books keep the conventional verse-only form: "Jude 2".
export function formatBibleRef(ref: ParsedBibleRef): string {
  if (ref.singleChapter) {
    if (ref.verseStart != null && ref.verseEnd != null && ref.verseEnd !== ref.verseStart) {
      return `${ref.bookName} ${ref.verseStart}–${ref.verseEnd}`;
    }
    if (ref.verseStart != null) return `${ref.bookName} ${ref.verseStart}`;
  }
  const base = `${ref.bookName} ${ref.chapter}`;
  if (ref.verseStart != null && ref.verseEnd != null && ref.verseEnd !== ref.verseStart) {
    return `${base}:${ref.verseStart}–${ref.verseEnd}`;
  }
  if (ref.verseStart != null) {
    return `${base}:${ref.verseStart}`;
  }
  return base;
}

// ─── Validation + canonicalization (used by API routes) ─────────────────────

export function validateBibleRef(
  ref: ParsedBibleRef
): { ok: true } | { ok: false; error: string } {
  const book = BIBLE_BOOKS.find((b) => b.id === ref.bookId);
  if (!book) return { ok: false, error: `Unknown book id "${ref.bookId}".` };
  if (ref.chapter < 1 || ref.chapter > book.chapters) {
    return { ok: false, error: `${book.name} has only ${book.chapters} chapters.` };
  }
  if (ref.verseStart != null && ref.verseStart < 1) {
    return { ok: false, error: "Verses start at 1." };
  }
  if (ref.verseEnd != null && ref.verseStart != null && ref.verseEnd < ref.verseStart) {
    return { ok: false, error: "End verse is before start verse." };
  }
  return { ok: true };
}

/**
 * Parse + validate + format in one step. Returns the canonical display string
 * ("John 1:1–3") on success — this is what gets stored in the DB JSON arrays.
 */
export function canonicalizeBibleRef(raw: string): { canonical: string; ref: ParsedBibleRef } | { error: string } {
  const parsed = parseBibleRef(raw);
  if (!parsed.ok) return { error: parsed.error };
  return { canonical: formatBibleRef(parsed.ref), ref: parsed.ref };
}

// ─── Deep links into the existing reader ─────────────────────────────────────

/**
 * Link for the Bible reader deep target handled by HomeApp:
 *   /?view=bible&book=<bookId>&chapter=<n>&verse=<v>
 * (shareLinks.bible format — same contract the share system uses).
 */
export function bibleRefHref(ref: ParsedBibleRef): string {
  const verse = ref.verseStart ?? null;
  return `/?view=bible&book=${encodeURIComponent(ref.bookId)}&chapter=${ref.chapter}${verse ? `&verse=${verse}` : ""}`;
}

/**
 * Parse an already-canonical stored string ("John 1:1–3", "Psalms 119") back
 * into a ParsedBibleRef for building links on public pages. Returns null for
 * legacy/free-text entries that don't parse — callers render those as plain
 * (non-clickable) chips.
 */
export function bibleRefFromDisplay(display: string): ParsedBibleRef | null {
  const parsed = parseBibleRef(display);
  return parsed.ok ? parsed.ref : null;
}
