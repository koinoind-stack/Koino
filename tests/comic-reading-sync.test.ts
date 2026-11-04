/**
 * Comic Bible server-side reading sync tests (2026-11-04).
 *
 * Spec: "KOINO — COMIC BIBLE IMPLEMENTATION (PART 2 OF 2)" §4 (progress +
 * bookmarks), §3 (kids age groups), §5 (narration audio readiness).
 *
 * Covers:
 *   1. Schema: ComicReadingProgress + ComicBookmark models with ONE row per
 *      (user, story) — duplicate records impossible by construction.
 *   2. Idempotent migration SQL (tables, unique indexes, cascading FKs).
 *   3. Public APIs: auth-gated GET/PUT/DELETE progress + GET/PUT bookmarks,
 *      server-computed completion, never-regressing lastPanel, published-only.
 *   4. Reader: server merge on resume, fire-and-forget push, bookmark sync,
 *      reset progress control, narration audio with TTS fallback.
 *   5. Library: merged progress (cross-device), story bookmark toggles.
 *   6. Kids age group end-to-end (schema → list API → admin UI → PATCH).
 *   7. i18n parity (en + te) for every new UI string.
 *
 * Technique: Node's built-in test runner (node:test) + tsx. Pure source
 * contracts — no network, no database, no production contact.
 *
 * Run: npm test
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const read = (p: string) => fs.readFileSync(p, "utf8");
const src = (...p: string[]) => read(path.join("src", ...p));

const schema = read("prisma/schema.prisma");
const migration = read(
  "prisma/migrations/20261104100000_comic_reading_sync/migration.sql"
);
const progressApi = src("app", "api", "comic", "progress", "route.ts");
const bookmarksApi = src("app", "api", "comic", "bookmarks", "route.ts");
const syncLib = src("lib", "comic-sync.ts");
const bibleData = src("lib", "bible-data.ts");
const reader = src("components", "crosscrafted", "ComicView.tsx");
const library = src("components", "crosscrafted", "ComicLibraryView.tsx");
const listApi = src("app", "api", "comic", "list", "route.ts");
const adminChapterApi = src("app", "api", "admin", "comics", "[id]", "route.ts");
const admin = src("components", "crosscrafted", "BibleComicsAdmin.tsx");
const en = src("lib", "i18n", "en.ts");
const te = src("lib", "i18n", "te.ts");
const pkg = read("package.json");

// ─── 1. Schema: one row per (user, story) ────────────────────────────────────

test("CRS-1: ComicReadingProgress model — unique per user+story, cascade deletes", () => {
  assert.match(schema, /model ComicReadingProgress \{[\s\S]*?@@unique\(\[userId, comicChapterId\]\)/);
  assert.match(schema, /model ComicReadingProgress \{[\s\S]*?onDelete: Cascade/);
  assert.match(schema, /model ComicReadingProgress \{[\s\S]*?completed\s+Boolean\s+@default\(false\)/);
});

test("CRS-2: ComicBookmark model — unique per user+story, JSON page list", () => {
  assert.match(schema, /model ComicBookmark \{[\s\S]*?pages\s+String\s+@default\("\[\]"\)/);
  assert.match(schema, /model ComicBookmark \{[\s\S]*?@@unique\(\[userId, comicChapterId\]\)/);
  // ComicChapter carries the back-relations
  assert.match(schema, /model ComicChapter \{[\s\S]*?readingProgress\s+ComicReadingProgress\[\]/);
  assert.match(schema, /model ComicChapter \{[\s\S]*?bookmarks\s+ComicBookmark\[\]/);
});

test("CRS-3: kidsAgeGroup is an optional validated string on ComicChapter", () => {
  assert.match(schema, /model ComicChapter \{[\s\S]*?kidsAgeGroup\s+String\?/);
});

// ─── 2. Migration SQL ────────────────────────────────────────────────────────

test("CRS-4: migration is idempotent — IF NOT EXISTS on tables, indexes and columns", () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS "ComicReadingProgress"/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS "ComicBookmark"/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS "kidsAgeGroup" TEXT/);
  assert.match(
    migration,
    /CREATE UNIQUE INDEX IF NOT EXISTS "ComicReadingProgress_userId_comicChapterId_key"/
  );
  assert.match(
    migration,
    /CREATE UNIQUE INDEX IF NOT EXISTS "ComicBookmark_userId_comicChapterId_key"/
  );
});

test("CRS-5: migration FKs cascade to User and ComicChapter", () => {
  assert.match(migration, /"ComicReadingProgress_userId_fkey"[\s\S]*?REFERENCES "User"\("id"\) ON DELETE CASCADE/);
  assert.match(migration, /"ComicReadingProgress_comicChapterId_fkey"[\s\S]*?REFERENCES "ComicChapter"\("id"\) ON DELETE CASCADE/);
  assert.match(migration, /"ComicBookmark_userId_fkey"[\s\S]*?REFERENCES "User"\("id"\) ON DELETE CASCADE/);
  assert.match(migration, /"ComicBookmark_comicChapterId_fkey"[\s\S]*?REFERENCES "ComicChapter"\("id"\) ON DELETE CASCADE/);
});

// ─── 3. Public progress API ──────────────────────────────────────────────────

test("CRS-6: progress API is auth-gated on every method", () => {
  const gets = (f: string) => (f.match(/await getAuthUser\(\)/g) || []).length;
  assert.ok(gets(progressApi) >= 3, "GET/PUT/DELETE must each check auth");
  assert.match(progressApi, /"Authentication required"[\s\S]{0,40}status: 401/);
});

test("CRS-7: progress PUT validates the book against BIBLE_BOOKS and chapter range", () => {
  assert.match(progressApi, /BIBLE_BOOKS\.some\(\(b\) => b\.id === bookId\)/);
  assert.match(progressApi, /chapter must be between 1 and \$\{book\.chapters\} for \$\{bookId\}/);
});

test("CRS-8: progress PUT only targets PUBLISHED stories and computes completed server-side", () => {
  assert.match(progressApi, /status !== "published"/);
  assert.match(progressApi, /const completed = totalPanels > 0 && lastPanel >= totalPanels;/);
});

test("CRS-9: progress never regresses — stored lastPanel is the highest ever seen", () => {
  assert.match(progressApi, /Math\.max\(incomingLastPanel, existing\?\.lastPanel \?\? 0\)/);
});

test("CRS-10: progress PUT is a true upsert — duplicate records are impossible", () => {
  assert.match(progressApi, /userId_comicChapterId: \{ userId: user\.id, comicChapterId: comicChapter\.id \}/);
  assert.match(progressApi, /upsert\(/);
});

test("CRS-11: progress DELETE resets one story (?bookId=&chapter=) or everything", () => {
  assert.match(progressApi, /deleteMany\(\{\s*where: \{ userId: user\.id, comicChapterId: comicChapter\.id \},?\s*\}\)/);
  assert.match(progressApi, /deleteMany\(\{ where: \{ userId: user\.id \} \}\)/);
});

// ─── 4. Bookmarks API ────────────────────────────────────────────────────────

test("CRS-12: bookmarks API is auth-gated, validates pages, published-only stories", () => {
  assert.match(bookmarksApi, /"Authentication required"/);
  assert.match(bookmarksApi, /pages must be an array of page numbers/);
  assert.match(bookmarksApi, /status !== "published"/);
});

test("CRS-13: bookmark PUT — reader replace semantics; storyLevel keeps empty rows", () => {
  // reader path: empty page list removes the row
  assert.match(bookmarksApi, /if \(pages\.length === 0 && !storyLevel\)/);
  // story path: storyLevel + empty pages still creates the row
  assert.match(bookmarksApi, /upsert\(/);
});

// ─── 5. Client sync helper ───────────────────────────────────────────────────

test("CRS-14: sync helper is fail-silent and never blocks reading", () => {
  assert.match(syncLib, /READ_TIMEOUT_MS = 2500/);
  assert.match(syncLib, /keepalive: true/);
  assert.ok(!/\bthrow\b/.test(syncLib.replace(/\/\*[\s\S]*?\*\//g, "")), "must not throw across module boundary");
});

test("CRS-15: sync helper exports the full contract used by reader + library", () => {
  assert.match(syncLib, /export async function fetchServerComicProgress/);
  assert.match(syncLib, /export function pushComicProgress/);
  assert.match(syncLib, /export function resetServerComicProgress/);
  assert.match(syncLib, /export async function fetchServerComicBookmarks/);
  assert.match(syncLib, /export function pushComicBookmarks/);
});

test("CRS-16: local progress store gained a per-story reset helper", () => {
  assert.match(bibleData, /export function resetComicProgress\(bookId: string, chapter: number\): void/);
});

// ─── 6. Reader integration ───────────────────────────────────────────────────

test("CRS-17: reader resumes from the HIGHEST of local and server progress", () => {
  assert.match(reader, /const best = candidates\.sort\(\(a, b\) => b\.lastPanel - a\.lastPanel\)\[0\]/);
  assert.match(reader, /fetchServerComicProgress\(\)/);
});

test("CRS-18: reader pushes progress fire-and-forget and keeps the session cache fresh", () => {
  assert.match(reader, /pushComicProgress\(bookId, chapter, highestSeen, totalPanels\)/);
  assert.match(reader, /serverProgressRef\.current\[comicKey\] = \{/);
});

test("CRS-19: reader merges server bookmarks once and pushes toggles", () => {
  assert.match(reader, /fetchServerComicBookmarks\(\)/);
  assert.match(reader, /if \(isAuthenticated\) pushComicBookmarks\(bookId, chapter, pages\)/);
});

test("CRS-20: reader has a reset-progress control clearing local AND server state", () => {
  assert.match(reader, /resetComicProgress\(bookId, chapter\)/);
  assert.match(reader, /if \(isAuthenticated\) resetServerComicProgress\(bookId, chapter\)/);
  assert.match(reader, /comicsReader\.resetProgressAria/);
  assert.match(reader, /comicsReader\.resetProgressDone/);
});

test("CRS-21: narration prefers CMS audio clips with play/pause/resume, TTS fallback kept", () => {
  assert.match(reader, /p\.audioUrl/);
  assert.match(reader, /new Audio\(url\)/);
  assert.match(reader, /window\.speechSynthesis\.pause\(\)/);
  assert.match(reader, /window\.speechSynthesis\.resume\(\)/);
  assert.match(reader, /speechSynthesis\.speak/); // fallback still present
  assert.match(reader, /comicsReader\.narrationPause/);
  assert.match(reader, /comicsReader\.narrationResume/);
});

test("CRS-22: narration stops on story/language change and unmount", () => {
  assert.match(reader, /useEffect\(\(\) => \{\s*stopNarration\(\);\s*\}, \[bookId, chapter, contentLang, stopNarration\]\)/);
});

// ─── 7. Library integration ──────────────────────────────────────────────────

test("CRS-23: library merges server progress (cross-device) with highest-wins policy", () => {
  assert.match(library, /fetchServerComicProgress\(\)/);
  assert.match(library, /mergedProgress/);
});

test("CRS-24: library cards toggle story bookmarks with sign-in for guests", () => {
  assert.match(library, /fetchServerComicBookmarks\(\)/);
  assert.match(library, /pushComicBookmarks\(ch\.bookId, ch\.chapter, \[\], \{ storyLevel: !isOn \}\)/);
  assert.match(library, /comics2\.bookmarkSignIn/);
  assert.match(library, /comics2\.bookmarkAddAria/);
  // nested interactive control — card root must not be a <button>
  assert.match(library, /div \(not button\): the card hosts a nested bookmark control/);
  assert.match(library, /e\.stopPropagation\(\)/);
});

// ─── 8. Kids age group end-to-end ────────────────────────────────────────────

test("CRS-25: list API exposes kidsAgeGroup; admin PATCH validates it; admin UI edits it", () => {
  assert.match(listApi, /kidsAgeGroup: true/);
  assert.match(listApi, /kidsAgeGroup: ch\.kidsAgeGroup/);
  assert.match(adminChapterApi, /kidsAgeGroup must be null\/empty or one of: "3-5", "6-8", "9-12"/);
  assert.match(admin, /Kids Age Group/);
  assert.match(admin, /<option value="3-5">Ages 3–5<\/option>/);
  assert.match(admin, /<option value="6-8">Ages 6–8<\/option>/);
  assert.match(admin, /<option value="9-12">Ages 9–12<\/option>/);
});

test("CRS-26: library shows the age band chip only on kids-friendly stories", () => {
  assert.match(library, /chapter\.kidsFriendly && chapter\.kidsAgeGroup/);
  assert.match(library, /comics2\.agesChip/);
});

// ─── 9. i18n parity (en + te) ────────────────────────────────────────────────

const SYNC_I18N_KEYS = [
  "comics2.agesChip",
  "comics2.bookmarkAddAria",
  "comics2.bookmarkRemoveAria",
  "comics2.bookmarkSignIn",
  "comicsReader.narrationPause",
  "comicsReader.narrationResume",
  "comicsReader.resetProgressAria",
  "comicsReader.resetProgressDone",
];

test("CRS-27: every new sync UI key exists in BOTH en.ts and te.ts", () => {
  const missing: string[] = [];
  for (const k of SYNC_I18N_KEYS) {
    if (!en.includes(`"${k}":`)) missing.push(`en:${k}`);
    if (!te.includes(`"${k}":`)) missing.push(`te:${k}`);
  }
  assert.deepEqual(missing, [], `missing keys: ${missing.join(", ")}`);
});

test("CRS-28: Telugu values are real Telugu (not copied English)", () => {
  for (const k of SYNC_I18N_KEYS) {
    const enV = en.match(new RegExp(`"${k}": "([^"]+)"`))?.[1];
    const teV = te.match(new RegExp(`"${k}": "([^"]+)"`))?.[1];
    assert.ok(enV && teV, `both dictionaries must define ${k}`);
    assert.notEqual(teV, enV, `te value for ${k} must be translated`);
    assert.match(teV, /[\u0C00-\u0C7F]/, `te value for ${k} must contain Telugu script`);
  }
});

test("CRS-29: placeholders are preserved in Telugu synced keys", () => {
  for (const k of ["comics2.agesChip"]) {
    const enVars: string[] = (en.match(new RegExp(`"${k}": "([^"]+)"`))?.[1] || "").match(/\{[^}]+\}/g) || [];
    const teVars: string[] = (te.match(new RegExp(`"${k}": "([^"]+)"`))?.[1] || "").match(/\{[^}]+\}/g) || [];
    for (const v of enVars) {
      assert.ok(teVars.includes(v), `te value for ${k} must keep ${v}`);
    }
  }
});

// ─── 10. Test wiring ─────────────────────────────────────────────────────────

test("CRS-30: this suite is wired into npm test", () => {
  assert.match(pkg, /tests\/comic-reading-sync\.test\.ts/);
});
