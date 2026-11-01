// Static Telugu content pack for Bible Comics chapter metadata.
// Key: `${bookId}.${chapter}` — stable across environments (comic ids are cuids).
// Chapter titles/descriptions are application-owned creative content (NOT
// scripture text), so they are translated here at build time. Chapters missing
// from the pack fall back to the English DB values. No runtime translation,
// no production-DB writes.

import raw from "./comics-te.json";

export type ComicTeChapter = { title: string; description?: string };

const chapters = (raw as { chapters: Record<string, ComicTeChapter> }).chapters ?? {};

export function comicTeKey(bookId: string, chapter: number): string {
  return `${bookId}.${chapter}`;
}

export function getComicTeChapter(bookId: string, chapter: number): ComicTeChapter | undefined {
  return chapters[comicTeKey(bookId, chapter)];
}
