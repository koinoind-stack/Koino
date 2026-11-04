/**
 * Comic chapter list language support tests (2026-11-04).
 *
 * Admin reported: "bible comic is not changing to telugu" (screenshot: site
 * chrome fully Telugu, comic panels + titles English). Root cause was
 * missing translation ROWS (fixed by a data SQL — see
 * download/comic-telugu-translations.sql), but the chapter LIST endpoint
 * also ignored the site language entirely: GET /api/comic/list always
 * returned the base English title, so the library grid, book chapter
 * counts and the Continue Reading strip stayed English even once Telugu
 * rows exist.
 *
 * Contract under test:
 *   1. GET /api/comic/list?lang=te returns the Telugu chapter title when a
 *      ComicChapterTranslation row exists, else English fallback with
 *      titleIsFallback=true.
 *   2. The library (ComicLibraryView) passes the current site language and
 *      refetches when it changes.
 *   3. The reader (ComicView) keeps passing lang to the chapter API — the
 *      per-panel translation contract that drives the actual story text.
 *
 * Technique: Node's built-in test runner (node:test) + tsx. Pure source
 * contracts — no network, no database.
 *
 * Run: npm test
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const read = (p: string) => fs.readFileSync(p, "utf8");
const src = (...p: string[]) => read(path.join("src", ...p));

const listApi = src("app", "api", "comic", "list", "route.ts");
const chapterApi = src("app", "api", "comic", "[bookId]", "[chapter]", "route.ts");
const library = src("components", "crosscrafted", "ComicLibraryView.tsx");
const reader = src("components", "crosscrafted", "ComicView.tsx");
const pkg = read("package.json");

// ─── 1. List endpoint: language handling ────────────────────────────────────

test("CL-1: GET /api/comic/list accepts ?lang=, validates against the shared comic language set", () => {
  assert.match(listApi, /export async function GET\(req: NextRequest\)/);
  assert.match(listApi, /url\.searchParams\.get\("lang"\) \|\| "en"/);
  // Same canonical set as the chapter reader + admin translations endpoints
  assert.match(
    listApi,
    /\["en", "hi", "bn", "te", "mr", "ta", "gu", "ur", "kn", "or", "ml", "pa", "as"\]/
  );
  assert.match(listApi, /\{ status: 400 \}/);
});

test("CL-2: list returns translated titles with English fallback + titleIsFallback flag", () => {
  // Translations joined in the same query (no N+1)
  assert.match(listApi, /translations: \{ select: \{ lang: true, title: true \} \}/);
  // Preference order: requested lang → English → base CMS title
  assert.match(
    listApi,
    /const langTitle = ch\.translations\.find\(\(tr\) => tr\.lang === lang\)\?\.title;/
  );
  assert.match(
    listApi,
    /const englishTitle = ch\.translations\.find\(\(tr\) => tr\.lang === "en"\)\?\.title;/
  );
  assert.match(listApi, /const title = langTitle \|\| englishTitle \|\| ch\.title;/);
  // Fallback flag mirrors the reader's isFallback semantics
  assert.match(listApi, /titleIsFallback: !langTitle && lang !== "en"/);
});

// ─── 2. Library: fetch follows the site language ────────────────────────────

test("CL-3: ComicLibraryView fetches the list with the current language and refetches on change", () => {
  assert.match(library, /useLanguage/);
  assert.match(library, /const \{ lang \} = useLanguage\(\);/);
  assert.match(library, /fetch\(`\/api\/comic\/list\?lang=\$\{lang\}`\)/);
  // The load effect must re-run when the language changes
  assert.match(library, /\}, \[lang\]\);/);
});

// ─── 3. Reader: per-panel translation contract (regression guard) ───────────

test("CL-4: ComicView reader passes lang to the chapter API (existing contract)", () => {
  assert.match(reader, /fetch\(`\/api\/comic\/\$\{bookId\}\/\$\{chapter\}\?lang=\$\{lang\}`\)/);
  // The reader consumes the per-panel fallback flags the API provides
  assert.match(reader, /hasTranslation: boolean/);
  assert.match(reader, /isFallback: boolean/);
  // Chapter API picks translations per panel with English fallback
  assert.match(chapterApi, /const activeTranslation = panelTranslation \|\| englishPanelTranslation;/);
});

// ─── 4. Wiring ──────────────────────────────────────────────────────────────

test("CL-5: test suite is wired into npm test", () => {
  assert.match(pkg, /tests\/comic-list-lang\.test\.ts/);
});
