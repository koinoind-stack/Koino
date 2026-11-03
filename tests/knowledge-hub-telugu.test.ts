// ─────────────────────────────────────────────────────────────────────────────
// Articles & Knowledge hub + browse listing — Telugu localization regression
// suite.
//
// User report (screenshot, UI in Telugu): the /knowledge hub page rendered
// "Articles & Knowledge", "By content type", the six content-type cards,
// "Browse →", "By category" and the taxonomy "warming up" notice in English —
// every visible string was hardcoded inside a DB-backed SERVER component,
// which cannot use the client-side LanguageContext. The page also had no
// back affordance (only the logo, which goes home).
//
// Fix pattern: server pages keep DB queries + redirects + English SEO
// metadata and delegate ALL visible chrome to client components
// (KnowledgeHubContent / KnowledgeBrowseContent) that render through the
// i18n dictionaries; BackButton adds router.back() navigation.
//
// Pins (source contracts + dictionary data, no network/DB):
//   • server pages no longer contain the hardcoded English render strings;
//   • the client components are "use client" and wire every visible string
//     through t();
//   • en.ts and te.ts carry the full knowledge.* key set with Telugu values
//     and matching {placeholders};
//   • all six content types have localized label/description keys;
//   • BackButton uses router.back() with a direct-visit fallback.
// ─────────────────────────────────────────────────────────────────────────────

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import en from "../src/lib/i18n/en";
import te from "../src/lib/i18n/te";
import { CONTENT_TYPES } from "../src/lib/content-taxonomy";
import { KNOWLEDGE_TYPE_KEYS } from "../src/components/crosscrafted/knowledge-i18n";

function src(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

const HUB_PAGE = src("src/app/knowledge/page.tsx");
const BROWSE_PAGE = src("src/app/knowledge/browse/page.tsx");
const HUB_CLIENT = src("src/components/crosscrafted/KnowledgeHubContent.tsx");
const BROWSE_CLIENT = src("src/components/crosscrafted/KnowledgeBrowseContent.tsx");
const BACK_BUTTON = src("src/components/crosscrafted/BackButton.tsx");

const TELUGU = /[\u0C00-\u0C7F]/;

test("KH-1: hub server page delegates chrome to the client component (no hardcoded English)", () => {
  assert.ok(
    HUB_PAGE.includes("KnowledgeHubContent"),
    "the hub page must render KnowledgeHubContent"
  );
  for (const literal of [
    "One home for the written word",
    "By content type",
    "By category",
    "Browse →",
    "Category navigation is warming up",
    "No topics yet.",
  ]) {
    assert.ok(
      !HUB_PAGE.includes(literal),
      `hub page must no longer hardcode "${literal}"`
    );
  }
});

test("KH-2: KnowledgeHubContent wires every visible string through t()", () => {
  assert.ok(HUB_CLIENT.includes('"use client"'), "must be a client component");
  for (const key of [
    "knowledge.badge",
    "knowledge.title",
    "knowledge.subtitle",
    "knowledge.byType",
    "knowledge.byCategory",
    "knowledge.browse",
    "knowledge.warmingTitle",
    "knowledge.warmingBody",
    "knowledge.noTopics",
    "knowledge.aria.contentTypes",
    "knowledge.aria.categories",
  ]) {
    assert.ok(HUB_CLIENT.includes(`"${key}"`), `hub client must use ${key}`);
  }
  assert.ok(
    HUB_CLIENT.includes("KNOWLEDGE_TYPE_KEYS[type].label") &&
      HUB_CLIENT.includes("KNOWLEDGE_TYPE_KEYS[type].desc"),
    "content-type cards must render localized labels and descriptions"
  );
  assert.ok(
    HUB_CLIENT.includes("BackButton"),
    "the hub must render the BackButton"
  );
});

test("KH-3: browse server page delegates chrome to the client component", () => {
  assert.ok(
    BROWSE_PAGE.includes("KnowledgeBrowseContent"),
    "the browse page must render KnowledgeBrowseContent"
  );
  for (const literal of [
    "Everything published in this content type",
    "Nothing matches this filter yet",
    "min read",
    "Previous",
    "Next",
    "Other content types",
    "Featured",
    ">All<",
  ]) {
    assert.ok(
      !BROWSE_PAGE.includes(literal),
      `browse page must no longer hardcode "${literal}"`
    );
  }
  // Server keeps: DB queries, redirect gates, pagination math, metadata.
  assert.ok(BROWSE_PAGE.includes('redirect("/blog")'), "blog redirect must remain server-side");
  assert.ok(
    BROWSE_PAGE.includes('redirect("/apologetics")'),
    "apologetics redirect must remain server-side"
  );
  assert.ok(
    BROWSE_PAGE.includes("scheduledAt"),
    "the schedule-aware visibility gate must remain server-side"
  );
});

test("KH-4: KnowledgeBrowseContent wires every visible string through t()", () => {
  assert.ok(BROWSE_CLIENT.includes('"use client"'), "must be a client component");
  for (const key of [
    "knowledge.title",
    "knowledge.list.everything",
    "knowledge.list.topic",
    "knowledge.list.category",
    "knowledge.list.all",
    "knowledge.list.featured",
    "knowledge.list.minRead",
    "knowledge.list.emptyFiltered",
    "knowledge.list.emptyType",
    "knowledge.list.emptyHintPre",
    "knowledge.list.emptyHintPost",
    "knowledge.list.prev",
    "knowledge.list.next",
    "knowledge.list.pageOf",
    "knowledge.list.otherTypes",
  ]) {
    assert.ok(BROWSE_CLIENT.includes(`"${key}"`), `browse client must use ${key}`);
  }
  // Pagination variables survive translation ({page}/{total} placeholders).
  assert.ok(
    BROWSE_CLIENT.includes('t("knowledge.list.pageOf", { page, total: totalPages })'),
    "pageOf must receive page + total variables"
  );
});

test("KH-5: en + te dictionaries carry the full knowledge.* key set, te values in Telugu", () => {
  const knowledgeKeys = Object.keys(en).filter((k) => k.startsWith("knowledge."));
  assert.ok(knowledgeKeys.length >= 38, `expected the full knowledge.* key set, got ${knowledgeKeys.length}`);
  for (const key of knowledgeKeys) {
    assert.ok(key in te, `te.ts missing ${key}`);
    assert.equal(typeof te[key], "string");
    assert.ok((te[key] as string).length > 0, `te.${key} is empty`);
  }
  // Telugu quality: every te value is Telugu script — except the bare "."
  // sentence-terminator token, which is legitimately language-neutral.
  const untranslated = knowledgeKeys.filter(
    (k) => !TELUGU.test(te[k] as string) && te[k] !== "."
  );
  assert.deepEqual(untranslated, [], `te values not in Telugu: ${untranslated.join(", ")}`);
  // Placeholder parity: every {var} in en must appear in te.
  const phMismatch = knowledgeKeys.filter((k) => {
    const enVars: string[] = en[k].match(/\{[^}]+\}/g) || [];
    const teVars: string[] = ((te[k] as string) || "").match(/\{[^}]+\}/g) || [];
    return enVars.some((v) => !teVars.includes(v));
  });
  assert.deepEqual(phMismatch, [], `placeholder mismatches: ${phMismatch.join(", ")}`);
});

test("KH-6: all six content types have localized label + description keys", () => {
  assert.deepEqual(
    Object.keys(KNOWLEDGE_TYPE_KEYS).sort(),
    [...CONTENT_TYPES].sort(),
    "KNOWLEDGE_TYPE_KEYS must cover exactly the unified CONTENT_TYPES"
  );
  for (const type of CONTENT_TYPES) {
    const { label, desc } = KNOWLEDGE_TYPE_KEYS[type];
    assert.ok(label in en && desc in en, `en.ts missing ${label} / ${desc}`);
    assert.ok(label in te && desc in te, `te.ts missing ${label} / ${desc}`);
    assert.ok(TELUGU.test(te[label] as string), `te.${label} must be Telugu`);
    assert.ok(TELUGU.test(te[desc] as string), `te.${desc} must be Telugu`);
  }
});

test("KH-7: BackButton navigates back with a direct-visit fallback", () => {
  assert.ok(BACK_BUTTON.includes('"use client"'), "must be a client component");
  assert.ok(BACK_BUTTON.includes("useRouter"), "must use the app router");
  assert.ok(BACK_BUTTON.includes("router.back()"), "must call router.back()");
  assert.ok(
    BACK_BUTTON.includes("window.history.length > 1") && BACK_BUTTON.includes("fallbackHref"),
    "direct visits (no history) must fall back to fallbackHref"
  );
  assert.ok(
    BACK_BUTTON.includes('t("knowledge.back")'),
    "label must be localized"
  );
});
