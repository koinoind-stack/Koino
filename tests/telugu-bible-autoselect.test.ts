// ─────────────────────────────────────────────────────────────────────────────
// Telugu Bible auto-selection — regression suite (Telugu ONLY, by explicit
// product decision; no other UI language may switch the Bible version).
//
// Pins:
//   • the registry resolver findTeluguVersion + the BIBLE_AUTOSELECT_LANGUAGE
//     constant ("te" — the single auto-selection language);
//   • the reader's guard ladder: Telugu-only trigger, manual-pick suppression
//     with re-arm on re-entry, catalogue-unavailable retention, already-
//     Telugu retention (refresh / navigation), graceful no-op when the
//     catalogue lists no Telugu Bible;
//   • persistence through the EXISTING cc_bible_version preference only
//     (no new storage surface; single write path shared with the selector);
//   • NO hardcoded YouVersion id — the catalogue stays the source of truth
//     for the concrete Telugu translation id;
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

test("TB-1: Telugu is the ONE auto-selection language and is in the scripture registry", () => {
  assert.equal(BIBLE_AUTOSELECT_LANGUAGE, "te");
  // The registry the selector and the resolver both use must actually list
  // Telugu — otherwise no catalogue could ever carry a te version.
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

test("TB-7: the default version is not Telugu — a fresh Telugu-site reader has switching work to do", () => {
  assert.equal(DEFAULT_VERSION_REF, "koino:kjv");
});

// ─── Reader source contracts (src/components/crosscrafted/BibleView.tsx) ────

const BIBLE_VIEW = src("src/components/crosscrafted/BibleView.tsx");

test("TB-8: the auto-selection trigger is guarded to Telugu ONLY", () => {
  assert.ok(
    BIBLE_VIEW.includes("if (lang !== BIBLE_AUTOSELECT_LANGUAGE) return;"),
    "every other UI language must no-op before any switch logic runs"
  );
  // No other locale may be special-cased anywhere in the reader.
  assert.ok(
    !/lang\s*(===|!==)\s*["'](hi|ta|mr|kn|ml|bn|gu|ur|pa|or|as)["']/.test(BIBLE_VIEW),
    "no other language may appear as a trigger comparison"
  );
});

test("TB-9: a manual selector pick suppresses the auto-selection", () => {
  assert.ok(
    BIBLE_VIEW.includes("userPickedRef.current = true"),
    "manual picks must set the suppression flag"
  );
  assert.ok(
    BIBLE_VIEW.includes("if (userPickedRef.current) return;"),
    "the auto-selection must no-op while a manual pick is active"
  );
});

test("TB-10: re-selecting Telugu as the site language re-arms the auto-selection", () => {
  assert.ok(
    BIBLE_VIEW.includes("userPickedRef.current = false"),
    "the transition into Telugu must clear a stale manual suppression"
  );
  assert.ok(
    BIBLE_VIEW.includes("prevLangRef.current = lang;"),
    "the previous language must be tracked to detect the transition"
  );
});

test("TB-11: unavailable catalogue or missing Telugu Bible → previous version retained", () => {
  assert.ok(
    BIBLE_VIEW.includes("if (!catalog.enabled) return;"),
    "disabled/failed catalogue must never switch the version"
  );
  assert.ok(
    BIBLE_VIEW.includes("if (!teVersion) return;"),
    "a catalogue without a te entry must never switch the version"
  );
});

test("TB-12: already reading a Telugu version → no-op (refresh + navigation retention)", () => {
  assert.ok(
    BIBLE_VIEW.includes("if (versionRef === teRef) return;"),
    "the exact auto-selected ref must short-circuit"
  );
  assert.ok(
    BIBLE_VIEW.includes("current.languageTag === BIBLE_AUTOSELECT_LANGUAGE"),
    "a different manual Telugu pick must be kept"
  );
});

test("TB-13: persistence rides the EXISTING cc_bible_version preference — single write path", () => {
  // The shared write helper persists through the existing key.
  assert.ok(
    BIBLE_VIEW.includes("localStorage.setItem(VERSION_STORAGE_KEY, ref);"),
    "the existing preference key must remain the only persistence target"
  );
  // The manual selector routes through the same write helper.
  assert.ok(
    BIBLE_VIEW.includes("applyVersionRef(formatVersionRef(v));"),
    "manual selection must use the shared applyVersionRef path"
  );
  // Exactly ONE setItem exists in the whole reader, and it uses the shared key
  // (the regex captures the identifier, not the key's runtime value).
  const setItemCalls = [...BIBLE_VIEW.matchAll(/localStorage\.setItem\(\s*([A-Za-z_$][\w$]*)/g)].map(
    (m) => m[1]
  );
  assert.deepEqual(setItemCalls, ["VERSION_STORAGE_KEY"]);
  // No new storage key was introduced anywhere in the reader.
  const literalKeys = [
    ...BIBLE_VIEW.matchAll(/localStorage\.setItem\(\s*["']([^"']+)["']/g),
  ].map((m) => m[1]);
  assert.deepEqual(literalKeys, [], "no new literal storage keys may be added");
});

test("TB-14: NO hardcoded YouVersion id — the catalogue owns the concrete Telugu id", () => {
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

test("TB-15: the manual version selector remains fully wired", () => {
  assert.ok(
    BIBLE_VIEW.includes("onSelect={selectVersion}"),
    "VersionMenu must keep its manual onSelect wiring"
  );
  assert.ok(
    BIBLE_VIEW.includes("setVersionMenuOpen(true)"),
    "the version chip must still open the selector"
  );
});

test("TB-16: cross-surface mirror stays on the shared preference (HomeApp follows the switch)", () => {
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

test("TB-17: the resolver filters by the auto-selection language, not by a copied literal", () => {
  const lib = src("src/lib/bible-versions.ts");
  assert.ok(
    lib.includes("v.languageTag === BIBLE_AUTOSELECT_LANGUAGE"),
    "findTeluguVersion must filter on the shared constant"
  );
});
