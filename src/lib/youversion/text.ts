// ─── YouVersion chapter-text → verse splitting (pure, testable) ─────────────
//
// The unified reader needs verse-by-verse text. YouVersion's chapter passage
// in `format=text` returns the chapter as flowing text with verse numbers
// inline (USFM style: "1 In the beginning ... 2 And the earth ...").
//
// The parser walks whitespace tokens; a token that is ALL DIGITS and equals
// the next expected verse number starts a new verse. This monotonic-expectation
// rule makes accidental splits from numbers inside the text (ages, measures)
// rare: a stray "2" only splits when verse 2 is exactly what we expect next.
//
// Fallback: if no markers are found (some versions start with unnumbered
// heading text), the whole chapter is returned as a single pseudo-verse (1).

const MAX_VERSES = 200; // Psalm 119 is the longest chapter (176); hard cap for safety

export type ParsedChapterText = {
  verses: { verse: number; text: string }[];
  /** true when no verse markers were detected and the chapter is one block */
  degraded: boolean;
};

export function parseVerseText(content: string, firstVerse = 1): ParsedChapterText {
  const text = (content || "").replace(/\s+/g, " ").trim();
  if (!text) return { verses: [], degraded: true };

  const tokens = text.split(" ");
  const verses: { verse: number; text: string }[] = [];
  let expected = firstVerse;
  let started = false;
  let current: { verse: number; parts: string[] } | null = null;

  for (const tok of tokens) {
    const num = /^\d{1,3}$/.test(tok) ? Number(tok) : NaN;
    // A token is a verse marker when it is a plausible verse number and it
    // matches the expected sequence — EXCEPT the very first numeric token,
    // which may start at any verse (partial/offset passages, e.g. JHN.3.16+).
    // Numbers > MAX_VERSES (e.g. years like "2024") are never markers.
    const isMarker =
      !Number.isNaN(num) &&
      num >= 1 &&
      num <= MAX_VERSES &&
      (started ? num === expected : true);
    if (isMarker) {
      if (current) verses.push({ verse: current.verse, text: current.parts.join(" ").trim() });
      current = { verse: num, parts: [] };
      expected = num + 1;
      started = true;
      continue;
    }
    if (!current) current = { verse: firstVerse, parts: [] };
    current.parts.push(tok);
  }
  if (current && current.parts.length > 0) {
    verses.push({ verse: current.verse, text: current.parts.join(" ").trim() });
  }

  if (verses.length === 0) {
    // no markers at all → single block
    return { verses: [{ verse: firstVerse, text }], degraded: true };
  }
  // degraded = the whole chapter came back as one un-numbered block
  return { verses, degraded: !started };
}
