/**
 * Regression tests — Phase 2 follow-up: Articles & Knowledge navigation
 * unification and knowledge surfacing (post-PR #22 production fixes).
 *
 * Basis commit a4d9edb (current main, post PR #22). Pins:
 *
 *   1. Service worker — the ROOT CAUSE of "clicking Articles & Knowledge
 *      returns to Home": the v1 navigation fallback served the cached Home
 *      app shell for ANY failed navigation, so a flaky network rendered the
 *      signed-in Home feed under the /knowledge URL. v2 must only fall back
 *      for the app root itself, and must bump the cache name so every v1
 *      cache is purged on activate.
 *   2. Sidebar unification — Grow carries exactly one written-content entry
 *      (knowledge); standalone apologetics (Grow) and blog (More) entries
 *      are gone from the desktop sidebar AND the mobile More sheet, while
 *      the routes, pseudo-view handling and deep links all keep working.
 *   3. Content-type routing — all six types resolve to a real destination;
 *      the /knowledge landing has no "Coming soon" card; the
 *      /knowledge/browse listing is a read-only surface over the EXISTING
 *      KoinoArticle model (status + schedule gates, taxonomy filters).
 *   4. Apologetics Q&A — still rendered by the SPA view, still deep-linkable
 *      (?view=apologetics), and one hop away from the public Apologetics
 *      page after the sidebar entry removal.
 *   5. Deployment prerequisites — the seed script command surface and the
 *      unified_taxonomy migration artifact stay in place (owner-run; the
 *      suite never touches a database).
 *
 * Technique: Node's built-in test runner (node:test) + tsx. Pure source
 * contracts (fs.readFileSync + assertions) and pure unit tests on the
 * content-taxonomy module — no network, no database, no production contact.
 * The YouVersion/Bible stack is never imported by any module under test.
 *
 * Run: npm test
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  CONTENT_TYPES,
  CONTENT_TYPE_LABELS,
  CONTENT_TYPE_DESCRIPTIONS,
  CONTENT_TYPE_ROUTES,
} from "../src/lib/content-taxonomy";

const read = (path: string) => fs.readFileSync(path, "utf8");

/** Extract a stable slice of a source file between two string anchors. */
function slice(src: string, startAnchor: string, endAnchor: string): string {
  const start = src.indexOf(startAnchor);
  assert.ok(start !== -1, `anchor not found: ${startAnchor}`);
  const end = src.indexOf(endAnchor, start + startAnchor.length);
  assert.ok(end !== -1, `end anchor not found: ${endAnchor}`);
  return src.slice(start, end);
}

// ─── 1. Service worker — root cause of the Home bounce ──────────────────────

test("P2FIX-SW-1: navigation fallback may serve the cached Home shell for '/' only", () => {
  const sw = read("public/sw.js");
  const navigateBranch = slice(sw, 'event.request.mode === "navigate"', "// For static assets");
  // The guard exists INSIDE the navigation branch…
  assert.match(navigateBranch, /url\.pathname === "\/"/);
  // …the fallback for non-root paths is an exact-URL cache hit or a real
  // network error — never the Home shell…
  assert.match(navigateBranch, /caches\.match\(event\.request\)\.then\(\(cached\) => cached \|\| Response\.error\(\)\)/);
  // …and the old unconditional fallback is gone from the whole file.
  assert.doesNotMatch(sw, /catch\(\(\) => caches\.match\("\/"\)\s*\)/);
});

test("P2FIX-SW-2: cache name bumped to v2 so every v1 cache is purged on activate", () => {
  const sw = read("public/sw.js");
  assert.match(sw, /const CACHE_NAME = "koino-v2"/);
  assert.doesNotMatch(sw, /koino-v1/);
  // activate() still purges every cache it does not own.
  assert.match(sw, /caches\.keys\(\)\.then\(\(keys\) =>/);
});

// ─── 2. Sidebar unification (desktop + mobile) ──────────────────────────────

test("P2FIX-NAV-1: Grow carries knowledge as its single written-content entry, no standalone apologetics", () => {
  const home = read("src/components/home/HomeApp.tsx");
  const grow = slice(home, 'labelKey: "side.cat.grow"', 'labelKey: "side.cat.community"');
  assert.match(grow, /id: "knowledge"/);
  assert.doesNotMatch(grow, /id: "apologetics"/);
  assert.doesNotMatch(grow, /id: "blog"/);
});

test("P2FIX-NAV-2: More category keeps support + admin, no standalone blog", () => {
  const home = read("src/components/home/HomeApp.tsx");
  const more = slice(home, 'labelKey: "side.cat.more"', "];");
  assert.match(more, /id: "support"/);
  assert.match(more, /id: "admin"/);
  assert.doesNotMatch(more, /id: "blog"/);
});

test("P2FIX-NAV-3: mobile More sheet matches the desktop — no standalone apologetics/blog", () => {
  const home = read("src/components/home/HomeApp.tsx");
  const sheet = slice(home, "const MOBILE_MORE_VIEWS", "];");
  assert.match(sheet, /id: "knowledge"/);
  assert.doesNotMatch(sheet, /id: "apologetics"/);
  assert.doesNotMatch(sheet, /id: "blog"/);
});

test("P2FIX-NAV-4: pseudo-view routing still covers every external route — nothing orphaned", () => {
  const home = read("src/components/home/HomeApp.tsx");
  // Entries removed from nav lists, but the ROUTES keep working: the
  // goView branch must still send blog/support/memorials/videos/knowledge
  // to their public App Router pages.
  const goViewBranch = slice(home, "const goView = (v: View)", "navigate(v);");
  for (const v of ["blog", "support", "memorials", "videos", "knowledge"]) {
    assert.match(goViewBranch, new RegExp(`"${v}"`), `goView must handle ${v}`);
  }
  assert.match(goViewBranch, /window\.location\.href/);
  // The analytics event for the knowledge click stays wired.
  assert.match(home, /knowledge_nav_click/);
});

test("P2FIX-NAV-5: /?view=knowledge deep links land on /knowledge, not an unknown SPA view", () => {
  const home = read("src/components/home/HomeApp.tsx");
  assert.match(home, /deepView === "knowledge"[\s\S]{0,120}window\.location\.replace\("\/knowledge"\)/);
});

test("P2FIX-NAV-6: Q&A surface preserved — ApologeticsView still renders and deep-links", () => {
  const home = read("src/components/home/HomeApp.tsx");
  // The SPA view still renders (share links + notifications target it)…
  assert.match(home, /view === "apologetics" && <ApologeticsView/);
  // …the ?view= deep-link whitelist still accepts apologetics…
  const validViews = slice(home, "const validViews: View[]", "];");
  assert.match(validViews, /"apologetics"/);
  // …and the ?question= share-param branch is intact.
  assert.match(home, /deepView === "apologetics"/);
  assert.match(home, /setDeepLinkedQuestionId/);
});

test("P2FIX-NAV-7: no unused icon imports left behind (lint guard)", () => {
  const home = read("src/components/home/HomeApp.tsx");
  assert.doesNotMatch(home, /FileText/);
  assert.doesNotMatch(home, /ListChecks/);
});

// ─── 3. Content-type routing — every type has a real destination ────────────

test("P2FIX-CT-1: CONTENT_TYPE_ROUTES covers all six types with real routes", () => {
  assert.deepEqual(
    Object.keys(CONTENT_TYPE_ROUTES).sort(),
    [...CONTENT_TYPES].sort()
  );
  assert.equal(CONTENT_TYPE_ROUTES.BLOG, "/blog");
  assert.equal(CONTENT_TYPE_ROUTES.APOLOGETICS, "/apologetics");
  for (const type of ["ARTICLE", "BIBLE_STUDY", "DEVOTIONAL", "TESTIMONY"] as const) {
    assert.equal(
      CONTENT_TYPE_ROUTES[type],
      `/knowledge/browse?type=${type}`
    );
  }
});

test("P2FIX-CT-2: labels and descriptions cover all six types (landing card contract)", () => {
  for (const type of CONTENT_TYPES) {
    assert.ok(CONTENT_TYPE_LABELS[type], `label missing for ${type}`);
    assert.ok(
      CONTENT_TYPE_DESCRIPTIONS[type],
      `description missing for ${type}`
    );
  }
});

test("P2FIX-CT-3: the /knowledge landing has no dead 'Coming soon' card", () => {
  const page = read("src/app/knowledge/page.tsx");
  assert.doesNotMatch(page, /Coming soon/);
  assert.match(page, /CONTENT_TYPE_ROUTES\[type\]/);
  assert.match(page, /CONTENT_TYPE_DESCRIPTIONS\[type\]/);
  // Card grid renders ALL six types as links.
  assert.match(page, /CONTENT_TYPES\.map\(\(type\) =>/);
});

test("P2FIX-CT-4: /knowledge/browse is a read-only listing over the existing KoinoArticle model", () => {
  const page = read("src/app/knowledge/browse/page.tsx");
  // Fresh, public, schedule-aware…
  assert.match(page, /export const dynamic = "force-dynamic"/);
  assert.match(page, /status: "published"/);
  assert.match(page, /scheduledAt: \{ lte: now \}/);
  // …type parameter validated against the fixed six…
  assert.match(page, /isContentType\(raw\.type\)/);
  // …Blog/Apologetics keep their canonical listings…
  assert.match(page, /redirect\("\/blog"\)/);
  assert.match(page, /redirect\("\/apologetics"\)/);
  // …taxonomy filters ride the Phase 2 associations (slug + isActive)…
  assert.match(page, /taxonomyCategory: \{ slug: categorySlug, isActive: true \}/);
  assert.match(page, /topics: \{ some: \{ topic: \{ slug: topicSlug, isActive: true \} \} \}/);
  // …and an unseeded/unmigrated database can never 500 the page.
  assert.match(page, /\.catch\(\(\) => \[\]\)/);
  assert.match(page, /\.catch\(\(\) => 0\)/);
});

test("P2FIX-CT-5: browse detail links stay inside existing surfaces", () => {
  const page = read("src/app/knowledge/browse/page.tsx");
  // Blog and Apologetics never render here — they redirect to their
  // canonical listings; the remaining types only link out via an explicit
  // canonicalUrl (no invented detail system).
  assert.match(page, /redirect\("\/apologetics"\)/);
  assert.match(page, /const href = a\.canonicalUrl \|\| null/);
  assert.doesNotMatch(page, /\/apologetics\/\$\{a\.slug\}/);
});

// ─── 4. Apologetics Q&A accessibility ───────────────────────────────────────

test("P2FIX-QA-1: the public Apologetics page links the member Q&A (/?view=apologetics)", () => {
  const page = read("src/app/apologetics/page.tsx");
  assert.match(page, /href="\/\?view=apologetics"/);
  assert.match(page, /Questions &amp; Answers/);
});

// ─── 5. Deployment prerequisites (owner-run; never executed here) ───────────

test("P2FIX-SEED-1: seed script stays wired — npm script + migration header docs", () => {
  const pkg = JSON.parse(read("package.json")) as {
    scripts: Record<string, string>;
  };
  assert.equal(
    pkg.scripts["db:seed-taxonomy"],
    "tsx prisma/scripts/seed-taxonomy.ts"
  );
  const seed = read("prisma/scripts/seed-taxonomy.ts");
  assert.match(seed, /Run AFTER the 20261103000000_unified_taxonomy migration/);
  assert.match(seed, /npx tsx prisma\/scripts\/seed-taxonomy\.ts/);
  // Idempotency contract — safe to re-run, creates nothing twice.
  assert.match(seed, /upsert by slug|kept\+\+|category kept/);
});

test("P2FIX-SEED-2: unified taxonomy migration artifact exists with the three tables", () => {
  const sql = read(
    "prisma/migrations/20261103000000_unified_taxonomy/migration.sql"
  );
  assert.match(sql, /CREATE TABLE "Category"/);
  assert.match(sql, /CREATE TABLE "Topic"/);
  assert.match(sql, /CREATE TABLE "ArticleTopic"/);
});

test("P2FIX-SEED-3: this suite is registered in the npm test list", () => {
  const pkg = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
  assert.match(pkg.scripts.test, /tests\/navigation-knowledge\.test\.ts/);
});
