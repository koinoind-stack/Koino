// ─────────────────────────────────────────────────────────────────────────────
// Bible language auto-selection — BIDIRECTIONAL regression suite.
//
// Pins:
//   • the registry resolver findTeluguVersion + the BIBLE_AUTOSELECT_LANGUAGE
//     constant ("te");
//   • the existing English default DEFAULT_VERSION_REF ("koino:kjv") is the
//     target when the site language is English;
//   • the reader's bidirectional guard ladder:
//       - Telugu → auto-select the licensed Telugu Bible from the catalogue;
//       - English → auto-select DEFAULT_VERSION_REF;
//       - other languages → no-op (retain previous);
//       - manual pick preserved within the same website language;
//       - website-language change triggers a fresh auto-selection;
//       - persisted preference respected on refresh (no auto-select on mount
//         when a saved cc_bible_version exists);
//       - first mount without a persisted preference → auto-select fires;
//       - catalogue unavailable or lists no Telugu version → retain previous,
//         no crash;
//   • persistence through the EXISTING cc_bible_version preference only
//     (no new storage surface; single write path shared with the selector);
//   • NO hardcoded YouVersion id — the catalogue stays the source of truth;
//   • the manual version selector remains fully wired.
//
// No network, no database: pure units + source contracts (repo convention).
// ─────────────────────────────────────────────────────────────────────────────

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  BIBLE_AUTOSELECT_LANGUAGE,
  DEFAULT_VERSION_REF,
  VERSION_STORAGE_KEY,
  findTeluguVersion,
  formatVersionRef,
  type BibleVersion,
} from "../src/lib/bible-versions";
import { SCRIPTURE_LANGUAGES } from "../src/lib/bible-versions";

// ─── Fixtures (mirror the live production catalogue shape) ───────────────────

const TE_VERSION: BibleVersion = {
  provider: "youversion",
  id: "1895", // fixture value mirroring today's production catalogue entry
  label: "Indian Revised Version (IRV) - Telugu - 2019",
  abbr: "IRVTel",
  languageTag: "te",
  languageLabel: "Telugu",
  nativeLanguageLabel: "తెలుగు",
  attribution: "Indian Revised Version (IRV)",
};

const KJV_VERSION: BibleVersion = {
  provider: "koino",
  id: "kjv",
  label: "King James Version",
  abbr: "KJV",
  languageTag: "en",
  languageLabel: "English",
  nativeLanguageLabel: "English",
  attribution: "Public domain.",
};

const BSB_EN_VERSION: BibleVersion = {
  provider: "youversion",
  id: "3034",
  label: "Berean Standard Bible",
  abbr: "BSB",
  languageTag: "en",
  languageLabel: "English",
  nativeLanguageLabel: "English",
  attribution: null,
};

function src(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

/** Source with comments stripped — contracts must judge CODE, not docs. */
function codeOf(rel: string): string {
  return src(rel)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
}

// ─── Registry units ───────────────────────────────────────────────────────────

test("TB-1: Telugu is the auto-selection language and is in the scripture registry", () => {
  assert.equal(BIBLE_AUTOSELECT_LANGUAGE, "te");
  assert.ok(
    SCRIPTURE_LANGUAGES.some((l) => l.tag === "te"),
    "SCRIPTURE_LANGUAGES must include the te tag"
  );
});

test("TB-2: findTeluguVersion resolves the licensed Telugu Bible from the catalogue", () => {
  const found = findTeluguVersion([BSB_EN_VERSION, TE_VERSION, KJV_VERSION]);
  assert.ok(found, "te version must be found");
  assert.equal(found.provider, "youversion");
  assert.equal(found.languageTag, "te");
  assert.equal(found.abbr, "IRVTel");
  assert.equal(formatVersionRef(found), `youversion:${TE_VERSION.id}`);
});

test("TB-3: catalogue without a Telugu Bible → null (caller must retain the previous version)", () => {
  assert.equal(findTeluguVersion([KJV_VERSION, BSB_EN_VERSION]), null);
});

test("TB-4: an empty/unavailable catalogue → null (graceful retention)", () => {
  assert.equal(findTeluguVersion([]), null);
});

test("TB-5: covered Telugu entries are never auto-selected", () => {
  const covered: BibleVersion = { ...TE_VERSION, coveredByYouVersion: true };
  assert.equal(findTeluguVersion([covered]), null);
  assert.equal(findTeluguVersion([covered, TE_VERSION]), TE_VERSION);
});

test("TB-6: multiple Telugu versions resolve deterministically (first catalogue entry)", () => {
  const second: BibleVersion = { ...TE_VERSION, id: "9999", abbr: "TE2" };
  assert.equal(findTeluguVersion([second, TE_VERSION]), second);
  assert.equal(findTeluguVersion([TE_VERSION, second]), TE_VERSION);
});

test("TB-7: the default version is the English fallback (koino:kjv)", () => {
  assert.equal(DEFAULT_VERSION_REF, "koino:kjv");
});

// ─── Reader source contracts (src/components/crosscrafted/BibleView.tsx) ────

const BIBLE_VIEW = src("src/components/crosscrafted/BibleView.tsx");

test("TB-8: the auto-selection handles BOTH Telugu and English (bidirectional)", () => {
  // Telugu branch: resolve from the catalogue via findTeluguVersion
  assert.ok(
    BIBLE_VIEW.includes("lang === BIBLE_AUTOSELECT_LANGUAGE"),
    "Telugu must be one of the auto-select branches"
  );
  // English branch: revert to the existing default
  assert.ok(
    BIBLE_VIEW.includes('lang === "en"'),
    "English must be the other auto-select branch"
  );
  assert.ok(
    BIBLE_VIEW.includes("targetRef = DEFAULT_VERSION_REF"),
    "English auto-select must target the existing DEFAULT_VERSION_REF"
  );
  // No other locale may be special-cased as a trigger.
  assert.ok(
    !/lang\s*(===|!==)\s*["'](hi|ta|mr|kn|ml|bn|gu|ur|pa|or|as)["']/.test(BIBLE_VIEW),
    "no other language may appear as a trigger comparison"
  );
});

test("TB-9: a manual selector pick is remembered for the CURRENT language only", () => {
  assert.ok(
    BIBLE_VIEW.includes("userPickedForLangRef.current = lang"),
    "manual picks must record the current UI language, not a boolean"
  );
  assert.ok(
    BIBLE_VIEW.includes("userPickedForLangRef.current === lang"),
    "auto-select must be suppressed only while the user stays in the same language"
  );
});

test("TB-10: a website-language change resets the manual-pick tracking and re-arms auto-select", () => {
  assert.ok(
    BIBLE_VIEW.includes("userPickedForLangRef.current = null"),
    "a language change must clear the manual-pick tracking"
  );
  assert.ok(
    BIBLE_VIEW.includes("autoSelectPendingRef.current = true"),
    "a language change must re-arm auto-select for the new language"
  );
  assert.ok(
    BIBLE_VIEW.includes("prevLangRef.current = lang;"),
    "the previous language must be tracked to detect transitions"
  );
  assert.ok(
    BIBLE_VIEW.includes("const isLanguageChange = prevLang !== null && prevLang !== lang"),
    "language change is detected by comparing prev and current lang"
  );
});

test("TB-11: unavailable catalogue or missing Telugu version → previous selection retained", () => {
  // The Telugu branch only resolves when catalog.enabled AND findTeluguVersion
  // returns a version. If either fails, targetRef stays null and the effect
  // bails without changing the version.
  assert.ok(
    BIBLE_VIEW.includes("if (targetRef === null) return;"),
    "when no target can be resolved, the effect must retain the previous version"
  );
  assert.ok(
    BIBLE_VIEW.includes("if (catalog.enabled)"),
    "the catalogue must be checked before resolving a Telugu version"
  );
});

test("TB-12: already reading the target translation → no write (refresh + navigation retention)", () => {
  assert.ok(
    BIBLE_VIEW.includes("if (versionRef === targetRef) return;"),
    "if the reader is already on the target, no write should happen"
  );
});

test("TB-13: other languages (not te, not en) → no-op, retain previous", () => {
  assert.ok(
    BIBLE_VIEW.includes("autoSelectPendingRef.current = false;\n      return;"),
    "other languages must clear pending and return without changing the version"
  );
});

test("TB-14: first mount — persisted pref respected ONLY if in the current UI language; overridden if in a different language", () => {
  assert.ok(
    BIBLE_VIEW.includes("persistedLoadedRef"),
    "a persisted-preference flag must exist to distinguish refresh from first visit"
  );
  assert.ok(
    BIBLE_VIEW.includes("prevLang === null && persistedLoadedRef.current"),
    "on first mount with a saved preference, the language-match check must run"
  );
  assert.ok(
    BIBLE_VIEW.includes("inferredLang === lang"),
    "the saved pref's language must be compared to the current UI language"
  );
  assert.ok(
    BIBLE_VIEW.includes("userPickedForLangRef.current = lang"),
    "when the saved pref matches the current language, it must be respected (treated as a manual pick)"
  );
  // The critical fix: a saved pref in a DIFFERENT language must NOT block
  // auto-select. This covers the BibleView remount scenario (user switches
  // language, then navigates to the Bible view — BibleView mounts fresh with
  // the old saved pref, but the new language should win).
  assert.ok(
    BIBLE_VIEW.includes("Saved pref is in a different language"),
    "when the saved pref is in a different language, auto-select must fall through"
  );
});

test("TB-15: persistence rides the EXISTING cc_bible_version preference — single write path", () => {
  assert.ok(
    BIBLE_VIEW.includes("localStorage.setItem(VERSION_STORAGE_KEY, ref);"),
    "the existing preference key must remain the only persistence target"
  );
  assert.ok(
    BIBLE_VIEW.includes("applyVersionRef(formatVersionRef(v));"),
    "manual selection must use the shared applyVersionRef path"
  );
  const setItemCalls = [...BIBLE_VIEW.matchAll(/localStorage\.setItem\(\s*([A-Za-z_$][\w$]*)/g)].map(
    (m) => m[1]
  );
  assert.deepEqual(setItemCalls, ["VERSION_STORAGE_KEY"]);
  const literalKeys = [
    ...BIBLE_VIEW.matchAll(/localStorage\.setItem\(\s*["']([^"']+)["']/g),
  ].map((m) => m[1]);
  assert.deepEqual(literalKeys, [], "no new literal storage keys may be added");
});

test("TB-16: NO hardcoded YouVersion id — the catalogue owns the concrete Telugu id", () => {
  for (const rel of [
    "src/components/crosscrafted/BibleView.tsx",
    "src/lib/bible-versions.ts",
  ]) {
    const code = codeOf(rel);
    assert.ok(
      !/youversion:\s*["'`]?\d+/.test(code),
      `${rel} must not contain a literal youversion:<numeric id> ref in code`
    );
    assert.ok(
      !/\.id\s*={2,3}\s*["']\d+["']/.test(code),
      `${rel} must not compare a version id against a numeric literal in code`
    );
  }
});

test("TB-17: the manual version selector remains fully wired", () => {
  assert.ok(
    BIBLE_VIEW.includes("onSelect={selectVersion}"),
    "VersionMenu must keep its manual onSelect wiring"
  );
  assert.ok(
    BIBLE_VIEW.includes("setVersionMenuOpen(true)"),
    "the version chip must still open the selector"
  );
});

test("TB-18: cross-surface mirror stays on the shared preference (HomeApp follows the switch)", () => {
  const home = src("src/components/home/HomeApp.tsx");
  assert.ok(
    home.includes("sanitizeSavedVersionRef(localStorage.getItem(VERSION_STORAGE_KEY))"),
    "HomeApp reading-plan previews must keep following the saved version"
  );
  assert.ok(
    home.includes("e.key === VERSION_STORAGE_KEY"),
    "the cross-tab storage mirror must keep listening to the shared key"
  );
});

test("TB-19: the resolver filters by the auto-selection language, not by a copied literal", () => {
  const lib = src("src/lib/bible-versions.ts");
  assert.ok(
    lib.includes("v.languageTag === BIBLE_AUTOSELECT_LANGUAGE"),
    "findTeluguVersion must filter on the shared constant"
  );
});
