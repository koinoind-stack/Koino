/**
 * Comic Bible multilingual redesign tests (2026-11-04).
 *
 * Spec: "Koino Bible — Complete Comic Bible Redesign and Multilingual
 * Implementation". Covers the five bug-class sources it eliminates:
 *   1. Silent English fallback — the reader used to show English narration
 *      with no way to switch (the reported "bible comic is not changing to
 *      telugu"). Now: per-language publish status, availability map, explicit
 *      fallback flags, an in-reader language selector, and "coming soon"
 *      notices instead of silent substitution.
 *   2. Language inheritance — comic content language inherits the saved
 *      Bible translation preference (cc_bible_version → catalogue → tag).
 *   3. Reader — two-page spread on desktop, single page + swipe on mobile,
 *      zoom, fullscreen, bookmark, keyboard arrows, page-based progress.
 *   4. Library — hero, All/OT/NT/For Kids tabs, search, kids badge.
 *   5. Admin CMS — kids/pageMode flags, per-language story translations with
 *      publish state, translation-completion matrix, page reordering, cover
 *      uploads; key-verse text fetched live from the Bible translation system.
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
  "prisma/migrations/20261104000000_comic_bible_multilingual/migration.sql"
);
const chapterApi = src("app", "api", "comic", "[bookId]", "[chapter]", "route.ts");
const listApi = src("app", "api", "comic", "list", "route.ts");
const adminChapterApi = src("app", "api", "admin", "comics", "[id]", "route.ts");
const adminTranslationsApi = src("app", "api", "admin", "comics", "[id]", "translations", "route.ts");
const reorderApi = src("app", "api", "admin", "comics", "[id]", "panels", "reorder", "route.ts");
const statusApi = src("app", "api", "admin", "comics", "translation-status", "route.ts");
const uploadApi = src("app", "api", "admin", "comics", "upload", "route.ts");
const comicLanguageLib = src("lib", "comic-language.ts");
const reader = src("components", "crosscrafted", "ComicView.tsx");
const library = src("components", "crosscrafted", "ComicLibraryView.tsx");
const admin = src("components", "crosscrafted", "BibleComicsAdmin.tsx");
const uploader = src("components", "crosscrafted", "ComicArtworkUploader.tsx");
const en = src("lib", "i18n", "en.ts");
const te = src("lib", "i18n", "te.ts");
const pkg = read("package.json");

// ─── 1. Schema + migration ───────────────────────────────────────────────────

test("CBM-1: schema adds kidsFriendly + pageMode to ComicChapter", () => {
  assert.match(schema, /model ComicChapter \{[\s\S]*?kidsFriendly\s+Boolean\s+@default\(false\)/);
  assert.match(schema, /model ComicChapter \{[\s\S]*?pageMode\s+String\s+@default\("individual"\)/);
});

test("CBM-2: schema adds per-language publish status to both translation models", () => {
  assert.match(schema, /model ComicPanelTranslation \{[\s\S]*?status\s+String\s+@default\("published"\)/);
  assert.match(schema, /model ComicChapterTranslation \{[\s\S]*?status\s+String\s+@default\("published"\)/);
});

test("CBM-3: schema adds localized story sections + structured key verse to ComicChapterTranslation", () => {
  assert.match(schema, /model ComicChapterTranslation \{[\s\S]*?introduction\s+String\?/);
  assert.match(schema, /model ComicChapterTranslation \{[\s\S]*?lesson\s+String\?/);
  assert.match(schema, /model ComicChapterTranslation \{[\s\S]*?prayer\s+String\?/);
  assert.match(schema, /model ComicChapterTranslation \{[\s\S]*?keyVerseBook\s+String\?/);
  assert.match(schema, /model ComicChapterTranslation \{[\s\S]*?keyVerseChapter\s+Int\?/);
  assert.match(schema, /model ComicChapterTranslation \{[\s\S]*?keyVerseStart\s+Int\?/);
  assert.match(schema, /model ComicChapterTranslation \{[\s\S]*?keyVerseEnd\s+Int\?/);
});

test("CBM-4: migration SQL is idempotent and defaults status to published (no content loss)", () => {
  assert.match(migration, /ADD COLUMN IF NOT EXISTS "kidsFriendly" BOOLEAN NOT NULL DEFAULT false/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS "pageMode" TEXT NOT NULL DEFAULT 'individual'/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'published'/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS "introduction" TEXT/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS "keyVerseBook" TEXT/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS "keyVerseEnd" INTEGER/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'published'/);
});

// ─── 2. Public read APIs ─────────────────────────────────────────────────────

test("CBM-5: public chapter API serves PUBLISHED translations only — drafts never leak", () => {
  assert.match(chapterApi, /status !== "published"[\s\S]{0,40}continue/);
  assert.match(chapterApi, /t\.lang === lang && t\.status === "published"/);
  assert.match(chapterApi, /t\.lang === "en" && t\.status === "published"/);
});

test("CBM-6: public chapter API returns an availability map + explicit langAvailable flag", () => {
  assert.match(chapterApi, /const languages = VALID_LANGS\.map/);
  assert.match(chapterApi, /langAvailable/);
  assert.match(chapterApi, /publishedPanelsByLang/);
  // English fallback is explicit, never silent
  assert.match(chapterApi, /isFallback: !panelTranslation && !!englishPanelTranslation && lang !== "en"/);
});

test("CBM-7: public chapter API returns story sections + pageMode + kidsFriendly", () => {
  assert.match(chapterApi, /kidsFriendly: comicChapter\.kidsFriendly/);
  assert.match(chapterApi, /pageMode: comicChapter\.pageMode === "spread" \? "spread" : "individual"/);
  assert.match(chapterApi, /introduction: activeChapterTranslation\?\.introduction \|\| null/);
  assert.match(chapterApi, /lesson: activeChapterTranslation\?\.lesson \|\| null/);
  assert.match(chapterApi, /prayer: activeChapterTranslation\?\.prayer \|\| null/);
  assert.match(chapterApi, /keyVerse,/);
});

test("CBM-8: public list API exposes kidsFriendly + pageMode for the library", () => {
  assert.match(listApi, /kidsFriendly: true/);
  assert.match(listApi, /pageMode: true/);
  assert.match(listApi, /kidsFriendly: ch\.kidsFriendly/);
  assert.match(listApi, /pageMode: ch\.pageMode/);
});

// ─── 3. Admin APIs ───────────────────────────────────────────────────────────

test("CBM-9: admin chapter PATCH accepts kidsFriendly + validated pageMode", () => {
  assert.match(adminChapterApi, /typeof body\.kidsFriendly === "boolean"/);
  assert.match(adminChapterApi, /pageMode must be "individual" or "spread"/);
  assert.match(adminChapterApi, /data\.pageMode = body\.pageMode/);
});

test("CBM-10: admin translations upsert persists status + story sections + validated key verse", () => {
  assert.match(adminTranslationsApi, /BIBLE_BOOKS\.some\(\(b\) => b\.id === kvBook\)/);
  assert.match(adminTranslationsApi, /keyVerse\.book must be a BIBLE_BOOKS id/);
  assert.match(adminTranslationsApi, /end >= start/);
  assert.match(adminTranslationsApi, /introduction,/);
  assert.match(adminTranslationsApi, /lesson,/);
  assert.match(adminTranslationsApi, /prayer,/);
  // New rows default to draft so unfinished translations cannot leak
  assert.match(adminTranslationsApi, /\? body\.status\n?\s*: "draft"/);
});

test("CBM-11: panel reorder endpoint is admin-gated and validates the full panel set", () => {
  assert.match(reorderApi, /export async function POST\(/);
  assert.match(reorderApi, /requireAdmin/);
  assert.match(reorderApi, /Admin access required/);
  assert.match(reorderApi, /orderedPanelIds must contain every panel of this chapter exactly once/);
  assert.match(reorderApi, /db\.\$transaction/);
});

test("CBM-12: translation-status matrix endpoint is admin-gated and reports per-language state", () => {
  assert.match(statusApi, /export async function GET\(/);
  assert.match(statusApi, /requireAdmin/);
  assert.match(statusApi, /status = "published"/);
  assert.match(statusApi, /status = "draft"/);
  assert.match(statusApi, /status = "missing"/);
});

test("CBM-13: upload endpoint supports target=cover persisted to ComicChapter.coverArtUrl", () => {
  assert.match(uploadApi, /target must be "panel" or "cover"/);
  assert.match(uploadApi, /const objectKey = target === "cover" \? "cover" : panelId/);
  assert.match(uploadApi, /comics\/\$\{bookId\}\/\$\{chapter\}\/\$\{objectKey\}\.webp/);
  assert.match(uploadApi, /data: \{ coverArtUrl: versionedUrl \}/);
});

// ─── 4. Language inheritance + reader ───────────────────────────────────────

test("CBM-14: comic language inherits the saved Bible version via the catalogue, with explicit override", () => {
  assert.match(comicLanguageLib, /VERSION_STORAGE_KEY/);
  assert.match(comicLanguageLib, /COMIC_LANG_STORAGE_KEY = "cc_comic_lang"/);
  assert.match(comicLanguageLib, /fetchVersionCatalog/);
  assert.match(comicLanguageLib, /resolveComicLanguage/);
  // explicit pick wins over inheritance
  const fn = comicLanguageLib.slice(comicLanguageLib.indexOf("export async function resolveComicLanguage"));
  assert.match(fn, /getSavedComicLanguage\(\)/);
});

test("CBM-15: reader has a language selector that keeps the page and marks unavailable languages", () => {
  assert.match(reader, /resolveComicLanguage/);
  assert.match(reader, /saveComicLanguage\(lang\)/);
  assert.match(reader, /setContentLang\(lang\); \/\/ refetch happens via loadComic dependency; page is kept/);
  assert.match(reader, /comingSoonLang/);
  assert.match(reader, /langAvailable/);
  // never silently substitutes: banner is shown when the requested language lacks coverage
  assert.match(reader, /!chapterData\.langAvailable && contentLang !== "en"/);
});

test("CBM-16: reader supports two-page spread on desktop, single page + swipe on mobile", () => {
  assert.match(reader, /\(min-width: 1024px\)/);
  assert.match(reader, /pagesPerView = spreadMode \? 2 : 1/);
  assert.match(reader, /onTouchStart=\{onTouchStart\}/);
  assert.match(reader, /onTouchEnd=\{onTouchEnd\}/);
});

test("CBM-17: reader supports keyboard navigation, zoom, fullscreen and bookmark", () => {
  assert.match(reader, /ArrowRight"\) goNext\(\)/);
  assert.match(reader, /ArrowLeft"\) goPrev\(\)/);
  assert.match(reader, /requestFullscreen/);
  assert.match(reader, /exitFullscreen/);
  assert.match(reader, /cc_comic_bookmarks/);
  assert.match(reader, /ZOOM_STEPS = \[1, 1\.5, 2, 2\.5\]/);
});

test("CBM-18: reader preserves original artwork aspect ratio and preloads the next view", () => {
  assert.match(reader, /object-contain/);
  assert.match(reader, /new Image\(\)/);
  assert.match(reader, /img\.src = panel\.artworkUrl/);
});

test("CBM-19: reader saves page-based progress and resumes from the last read page", () => {
  assert.match(reader, /saveComicProgress\(bookId, chapter, highestSeen, totalPanels\)/);
  assert.match(reader, /getComicProgress\(bookId, chapter\)/);
});

test("CBM-20: key-verse text is fetched live from the Bible translation system — never authored", () => {
  assert.match(reader, /fetchVersionCatalog/);
  assert.match(reader, /fetchChapterVersioned\(formatVersionRef\(version\), kv\.book, kv\.chapter\)/);
  // Urdu renders right-to-left
  assert.match(reader, /contentLang === "ur"/);
});

test("CBM-21: reader keeps TTS, share, quiz, video, prayer and chapter navigation", () => {
  assert.match(reader, /speechSynthesis/);
  assert.match(reader, /\/api\/comic\/quiz\//);
  assert.match(reader, /\/api\/videos\?book=/);
  assert.match(reader, /onPray\(prayerPrompt\)/);
  assert.match(reader, /shareLinks\.comic\(/);
  assert.match(reader, /getAdjacentChapter\("next"\)/);
});

// ─── 5. Library redesign ─────────────────────────────────────────────────────

test("CBM-22: library has hero, All/OT/NT/For Kids tabs, search and kids filter", () => {
  assert.match(library, /comics2\.heroTitle/);
  assert.match(library, /comics2\.heroSubtitle/);
  assert.match(library, /comics2\.heroDesc/);
  assert.match(library, /id: "kids", label: t\("comics2\.forKids"\)/);
  assert.match(library, /testament === "kids"[\s\S]{0,60}!ch\.kidsFriendly/);
  assert.match(library, /comics\.searchPlaceholder/);
  // kids badge on story cards
  assert.match(library, /comics\.kidsBadge/);
  // continue reading strip preserved
  assert.match(library, /comics\.continueReading/);
});

// ─── 6. Admin CMS ────────────────────────────────────────────────────────────

test("CBM-23: admin editor exposes kids flag, page mode, story translations and publish toggles", () => {
  assert.match(admin, /Kids Friendly/);
  assert.match(admin, /Page Mode \(reader layout\)/);
  assert.match(admin, /Story Translation/);
  assert.match(admin, /Draft — click to publish/);
  assert.match(admin, /StoryTranslationFields/);
});

test("CBM-24: admin has a translation-completion matrix wired to the status endpoint", () => {
  assert.match(admin, /TranslationStatusMatrix/);
  assert.match(admin, /fetch\("\/api\/admin\/comics\/translation-status"\)/);
  assert.match(admin, /Translation Completion/);
});

test("CBM-25: admin panels manager supports reordering reading order", () => {
  assert.match(admin, /panels\/reorder/);
  assert.match(admin, /orderedPanelIds: next/);
});

test("CBM-26: admin cover upload uses target=cover through ComicArtworkUploader", () => {
  assert.match(admin, /target="cover"/);
  assert.match(uploader, /target = "panel"/);
  assert.match(uploader, /formData\.append\("target", target\)/);
});

// ─── 7. i18n parity (en + te) ────────────────────────────────────────────────

const READ_I18N_KEYS = [
  "comics.kidsBadge",
  "comics2.heroTitle",
  "comics2.heroSubtitle",
  "comics2.heroDesc",
  "comics2.heroCta",
  "comics2.allStories",
  "comics2.forKids",
  "comicsReader.library",
  "comicsReader.pageOf",
  "comicsReader.prev",
  "comicsReader.next",
  "comicsReader.swipeHint",
  "comicsReader.languageAria",
  "comicsReader.languageHint",
  "comicsReader.soon",
  "comicsReader.comingSoonLang",
  "comicsReader.notAvailableTitle",
  "comicsReader.notAvailableDesc",
  "comicsReader.zoomInAria",
  "comicsReader.zoomOutAria",
  "comicsReader.fullscreenAria",
  "comicsReader.exitFullscreenAria",
  "comicsReader.fullscreenUnavailable",
  "comicsReader.bookmarkAria",
  "comicsReader.bookmarkRemoveAria",
  "comicsReader.bookmarkedToast",
  "comicsReader.bookmarkRemovedToast",
  "comicsReader.textSizeAria",
  "comicsReader.introductionHeading",
  "comicsReader.keyVerseHeading",
  "comicsReader.lessonHeading",
  "comicsReader.prayerHeading",
  "comicsReader.prayThis",
  "comicsReader.readInBible",
  "comicsReader.relatedHeading",
];

test("CBM-27: every new UI key exists in BOTH en.ts and te.ts", () => {
  const missing: string[] = [];
  for (const k of READ_I18N_KEYS) {
    if (!en.includes(`"${k}":`)) missing.push(`en:${k}`);
    if (!te.includes(`"${k}":`)) missing.push(`te:${k}`);
  }
  assert.deepEqual(missing, [], `missing keys: ${missing.join(", ")}`);
});

test("CBM-28: Telugu values are real Telugu (not copied English) for the new keys", () => {
  const mustDiffer = [
    "comics2.heroSubtitle",
    "comics2.heroDesc",
    "comics2.allStories",
    "comics2.forKids",
    "comicsReader.swipeHint",
    "comicsReader.notAvailableDesc",
    "comicsReader.introductionHeading",
    "comicsReader.keyVerseHeading",
    "comicsReader.lessonHeading",
    "comicsReader.prayerHeading",
  ];
  for (const k of mustDiffer) {
    const enV = en.match(new RegExp(`"${k}": "([^"]+)"`))?.[1];
    const teV = te.match(new RegExp(`"${k}": "([^"]+)"`))?.[1];
    assert.ok(enV && teV, `both dictionaries must define ${k}`);
    assert.notEqual(teV, enV, `te value for ${k} must be translated`);
    assert.match(teV, /[\u0C00-\u0C7F]/, `te value for ${k} must contain Telugu script`);
  }
});

test("CBM-29: placeholders are preserved in Telugu reader/library keys", () => {
  const withVars = [
    "comicsReader.pageOf",
    "comicsReader.comingSoonLang",
    "comicsReader.notAvailableTitle",
    "comicsReader.bookmarkedToast",
  ];
  for (const k of withVars) {
    const enVars: string[] = (en.match(new RegExp(`"${k}": "([^"]+)"`))?.[1] || "").match(/\{[^}]+\}/g) || [];
    const teVars: string[] = (te.match(new RegExp(`"${k}": "([^"]+)"`))?.[1] || "").match(/\{[^}]+\}/g) || [];
    for (const v of enVars) {
      assert.ok(teVars.includes(v), `te value for ${k} must keep ${v}`);
    }
  }
});

// ─── 8. Test wiring ──────────────────────────────────────────────────────────

test("CBM-30: this suite is wired into npm test", () => {
  assert.match(pkg, /tests\/comic-bible-multilingual\.test\.ts/);
});

// ─── CBM-26: publish validation requires a PUBLISHED English row ────────────
// Regression guard (QA audit 2026-11-04): the publish validator previously
// matched any English row regardless of publish status, so a story whose
// English panel text was saved as DRAFT could go live — readers then saw
// pages with narration: null, hasTranslation: false and isFallback: false
// (silent content loss, no fallback flag). The validator must only accept
// the published EN row and must point admins at the draft row explicitly.
test("CBM-26: publish validation requires a PUBLISHED English translation row", () => {
  const publishApi = src("app", "api", "admin", "comics", "[id]", "publish", "route.ts");
  assert.match(
    publishApi,
    /translations\.find\(\(t\) => t\.lang === "en" && t\.status === "published"\)/,
    "validator must select the published English row, not any English row"
  );
  assert.match(
    publishApi,
    /still a draft/,
    "validator must tell the admin when an English row exists but is still draft"
  );
  // The reader contract this protects: isFallback only turns true when the
  // published English row exists — so publish must never succeed without one.
  assert.match(
    src("app", "api", "comic", "[bookId]", "[chapter]", "route.ts"),
    /isFallback: !panelTranslation && !!englishPanelTranslation && lang !== "en"/,
  );
});
