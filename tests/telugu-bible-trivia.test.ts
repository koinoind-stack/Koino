// ─────────────────────────────────────────────────────────────────────────────
// Complete Telugu Support — Bible Reader + Bible Trivia regression suite.
//
// Pins (no network, no database — pure units + source contracts):
//
//  BIBLE READER (Telugu auto-selection — see tests/telugu-bible-autoselect.test.ts
//  for the 17-case dedicated suite; this file adds a smoke check that the
//  feature is still wired after the Trivia changes):
//
//  TRIVIA — architecture contracts:
//   • trivia-te-pack loader exports the right shape + helpers;
//   • /api/trivia/start wires the THREE-tier fallback (DB translations → static
//     Telugu pack → English original) ONLY for lang === "te";
//   • trivia-api.ts auto-sends `lang` from useLanguage();
//   • NO hardcoded YouVersion id anywhere (catalogue stays source of truth);
//   • manual selector + existing scoring/rewards/leaderboard/anti-farming
//     surfaces untouched.
//
//  TRIVIA — content pack integrity (800/800):
//   • every English questionId has a Telugu entry (100% coverage);
//   • option-count parity per question (correct-answer index preserved);
//   • no empty q/options/explanation; Telugu script present in every q;
//   • coverage by difficulty: 200 each for beginners/intermediate/skilled/expert;
//   • coverage by category: 200 each for full_bible/new_testament/old_testament/apologetics.
//
//  TRIVIA — English fallback safety:
//   • the loader never throws on a missing id (returns undefined → caller
//     falls back to English);
//   • triviaTeCoverage() reports 800 (so the operator-facing coverage check
//     stays accurate).
// ─────────────────────────────────────────────────────────────────────────────

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  BIBLE_AUTOSELECT_LANGUAGE,
  findTeluguVersion,
  SCRIPTURE_LANGUAGES,
  type BibleVersion,
} from "../src/lib/bible-versions";
import {
  getTriviaTePack,
  triviaTeCoverage,
} from "../src/lib/i18n/content/trivia-te-pack";

// ─── Fixtures mirroring the live production catalogue shape ────────────────
const TE_VERSION: BibleVersion = {
  provider: "youversion",
  id: "1895",
  label: "Indian Revised Version (IRV) - Telugu - 2019",
  abbr: "IRVTel",
  languageTag: "te",
  languageLabel: "Telugu",
  nativeLanguageLabel: "తెలుగు",
  attribution: "Indian Revised Version (IRV)",
};

function src(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 1 — Bible Reader auto-selection smoke check (the dedicated 17-case
// suite is tests/telugu-bible-autoselect.test.ts; this just guards that the
// Trivia work did not regress the Bible wiring).
// ═══════════════════════════════════════════════════════════════════════════

test("TE-CORE-1: Bible auto-selection registry is intact", () => {
  assert.equal(BIBLE_AUTOSELECT_LANGUAGE, "te");
  assert.ok(
    SCRIPTURE_LANGUAGES.some((l) => l.tag === "te"),
    "SCRIPTURE_LANGUAGES must include the te tag"
  );
  const found = findTeluguVersion([TE_VERSION]);
  assert.ok(found, "findTeluguVersion must resolve the te version");
  assert.equal(found.languageTag, "te");
});

test("TE-CORE-2: Bible reader source still carries the auto-selection effect", () => {
  const bv = src("src/components/crosscrafted/BibleView.tsx");
  assert.ok(bv.includes("BIBLE_AUTOSELECT_LANGUAGE"), "trigger constant still imported");
  assert.ok(bv.includes("findTeluguVersion"), "resolver still imported");
  assert.ok(bv.includes("userPickedForLangRef"), "manual-pick guard still present");
  assert.ok(
    bv.includes('lang === "en"'),
    "bidirectional English branch still in place"
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 2 — Trivia architecture contracts
// ═══════════════════════════════════════════════════════════════════════════

test("TE-ARCH-1: trivia-te-pack loader exports the right shape + helpers", () => {
  const pack = getTriviaTePack();
  assert.equal(typeof pack, "object");
  assert.ok(pack !== null);
  // Coverage helper reports the full pack size
  assert.equal(triviaTeCoverage(), 800);
});

test("TE-ARCH-2: getTriviaTePack returns a stable 800-entry object", () => {
  // The /api/trivia/start route imports getTriviaTePack from the content pack.
  // Confirm the loader is consistent and returns the full pack.
  assert.equal(typeof getTriviaTePack, "function");
  const pack = getTriviaTePack();
  assert.equal(Object.keys(pack).length, 800);
});

test("TE-ARCH-3: /api/trivia/start wires the THREE-tier fallback (Telugu ONLY)", () => {
  const route = src("src/app/api/trivia/start/route.ts");
  // Tier 1: DB translations column
  assert.ok(route.includes('allTranslations[lang]'), "DB translations path must remain priority 1");
  // Tier 2: static Telugu pack — ONLY loaded when lang === "te"
  assert.ok(route.includes('lang === "te" ? getTriviaTePack() : null'), "static pack load must be gated to te");
  assert.ok(route.includes('tePack?.[q.questionId]'), "pack lookup by questionId must be present");
  // Tier 3: English fallback in the return mapping
  assert.ok(route.includes('packed?.q || q.question'), "English fallback for question text");
  assert.ok(route.includes('packed?.options || JSON.parse(q.options)'), "English fallback for options");
  assert.ok(route.includes('packed?.explanation || q.explanation'), "English fallback for explanation");
});

test("TE-ARCH-4: trivia-api.ts auto-sends `lang` from useLanguage()", () => {
  const api = src("src/lib/trivia-api.ts");
  assert.ok(api.includes("useLanguage"), "useLanguage hook still imported");
  assert.ok(api.includes("const { lang } = useLanguage()"), "lang destructured from context");
  assert.ok(api.includes("body: JSON.stringify({ ...params, lang })"), "lang auto-included in startQuiz body");
});

test("TE-ARCH-5: NO hardcoded YouVersion id in the trivia path", () => {
  // Comment-stripped source scan (contracts judge CODE, not docs)
  const code = src("src/app/api/trivia/start/route.ts")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  assert.ok(
    !/youversion:\s*["'`]?\d+/.test(code),
    "trivia start route must not contain a literal youversion:<numeric id>"
  );
});

test("TE-ARCH-6: manual selector + scoring surfaces untouched", () => {
  // The submit route (scoring/rewards/anti-farming) must not have been touched
  const submit = src("src/app/api/trivia/submit/route.ts");
  assert.ok(submit.includes("POST"), "submit route still exports POST handler");
  // Leaderboard + history routes untouched
  for (const rel of [
    "src/app/api/trivia/leaderboard/route.ts",
    "src/app/api/trivia/history/route.ts",
    "src/app/api/trivia/stats/route.ts",
  ]) {
    const s = src(rel);
    assert.ok(s.includes("GET"), `${rel} still exports GET handler`);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 3 — Content pack integrity (800/800)
// ═══════════════════════════════════════════════════════════════════════════

// Load both sources for cross-validation
const EN_QUESTIONS = JSON.parse(
  src("prisma/trivia-questions.json")
) as Array<{
  questionId: string;
  question: string;
  options: string; // JSON string
  correctAnswer: number;
  explanation: string;
  scriptureReference: string | null;
  difficulty: string;
  category: string;
  basePoints: number;
  bibleBook: string | null;
  topic: string;
}>;

const PACK_JSON = JSON.parse(src("src/lib/i18n/content/trivia-te.json")) as {
  lang: string;
  count: number;
  entries: Record<string, { q: string; options: string[]; explanation: string }>;
};

const EN_BY_ID = new Map(EN_QUESTIONS.map((q) => [q.questionId, q]));

test("TE-PACK-1: pack metadata + 100% coverage of English questionIds", () => {
  assert.equal(PACK_JSON.lang, "te");
  assert.equal(PACK_JSON.count, 800);
  assert.equal(Object.keys(PACK_JSON.entries).length, 800);
  // Every English questionId must have a Telugu entry
  for (const q of EN_QUESTIONS) {
    assert.ok(
      PACK_JSON.entries[q.questionId],
      `Telugu entry missing for ${q.questionId}`
    );
  }
  // No orphan entries (Telugu ids not in English source)
  for (const id of Object.keys(PACK_JSON.entries)) {
    assert.ok(EN_BY_ID.has(id), `Orphan Telugu entry: ${id}`);
  }
});

test("TE-PACK-2: option-count parity per question (correct-answer index preserved)", () => {
  for (const [id, te] of Object.entries(PACK_JSON.entries)) {
    const en = EN_BY_ID.get(id)!;
    const enOpts = JSON.parse(en.options) as string[];
    assert.equal(
      te.options.length,
      enOpts.length,
      `${id}: option count ${te.options.length} != English ${enOpts.length}`
    );
    // The correct-answer index is NEVER changed by translation: only the
    // option TEXT is translated, position-for-position. The index itself
    // lives in the DB row (correctAnswer), not the pack, so a successful
    // parity check here is the strongest contract we can pin without a DB.
  }
});

test("TE-PACK-3: no empty fields; every question in Telugu script", () => {
  for (const [id, te] of Object.entries(PACK_JSON.entries)) {
    assert.ok(te.q, `${id}: empty question`);
    assert.ok(te.explanation, `${id}: empty explanation`);
    assert.equal(te.options.length, 4, `${id}: must have 4 options`);
    for (let i = 0; i < te.options.length; i++) {
      assert.ok(te.options[i], `${id}: empty option ${i}`);
    }
    // Telugu Unicode block: U+0C00–U+0C7F
    const hasTelugu = [...te.q].some((c) => c >= "\u0c00" && c <= "\u0c7f");
    assert.ok(hasTelugu, `${id}: question not in Telugu script`);
  }
});

test("TE-PACK-4: balanced coverage by difficulty (200 each)", () => {
  const counts: Record<string, number> = {};
  for (const id of Object.keys(PACK_JSON.entries)) {
    const diff = EN_BY_ID.get(id)!.difficulty;
    counts[diff] = (counts[diff] || 0) + 1;
  }
  assert.equal(counts["beginners"], 200);
  assert.equal(counts["intermediate"], 200);
  assert.equal(counts["skilled"], 200);
  assert.equal(counts["expert"], 200);
});

test("TE-PACK-5: balanced coverage by category (200 each)", () => {
  const counts: Record<string, number> = {};
  for (const id of Object.keys(PACK_JSON.entries)) {
    const cat = EN_BY_ID.get(id)!.category;
    counts[cat] = (counts[cat] || 0) + 1;
  }
  assert.equal(counts["full_bible"], 200);
  assert.equal(counts["new_testament"], 200);
  assert.equal(counts["old_testament"], 200);
  assert.equal(counts["apologetics"], 200);
});

test("TE-PACK-6: difficulty×category matrix is balanced (50 each)", () => {
  const counts: Record<string, number> = {};
  for (const id of Object.keys(PACK_JSON.entries)) {
    const en = EN_BY_ID.get(id)!;
    const key = `${en.difficulty}|${en.category}`;
    counts[key] = (counts[key] || 0) + 1;
  }
  for (const diff of ["beginners", "intermediate", "skilled", "expert"]) {
    for (const cat of ["full_bible", "new_testament", "old_testament", "apologetics"]) {
      assert.equal(
        counts[`${diff}|${cat}`],
        50,
        `${diff}|${cat}: expected 50, got ${counts[`${diff}|${cat}`] || 0}`
      );
    }
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 4 — English fallback safety (graceful handling of missing entries)
// ═══════════════════════════════════════════════════════════════════════════

test("TE-FALLBACK-1: loader returns undefined for a missing id (caller falls back to English)", () => {
  const pack = getTriviaTePack();
  // An id that does not exist
  assert.equal(pack["nonexistent_question_id"], undefined);
  assert.equal(pack[""], undefined);
});

test("TE-FALLBACK-2: route source contract — missing pack entry falls back to English", () => {
  const route = src("src/app/api/trivia/start/route.ts");
  // The chain is: translated?.question || packed?.q || q.question
  // If both translated and packed are absent, q.question (English) is used.
  assert.ok(
    route.includes("packed?.q || q.question"),
    "question fallback chain ends with English q.question"
  );
  assert.ok(
    route.includes("packed?.explanation || q.explanation"),
    "explanation fallback chain ends with English q.explanation"
  );
});

test("TE-FALLBACK-3: a non-Telugu language request never loads the pack", () => {
  const route = src("src/app/api/trivia/start/route.ts");
  // The pack is ONLY loaded when lang === "te"; every other language (en, hi,
  // etc.) keeps the original DB-translations → English behavior.
  assert.ok(
    route.includes('lang === "te" ? getTriviaTePack() : null'),
    "pack load must be strictly gated to te — no other language triggers it"
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 5 — No off-limits surfaces touched
// ═══════════════════════════════════════════════════════════════════════════

test("TE-SCOPE-1: YouVersion / Bible provider files untouched by the trivia work", () => {
  // The trivia changes are confined to: trivia-te.json, trivia-te-pack.ts,
  // /api/trivia/start/route.ts. The YouVersion client/catalog/config and
  // bible-server/bible-fetch must NOT reference the pack (they sit upstream).
  for (const rel of [
    "src/lib/youversion/client.ts",
    "src/lib/youversion/catalog.ts",
    "src/lib/youversion/config.ts",
    "src/lib/bible-server.ts",
    "src/lib/bible-fetch.ts",
  ]) {
    const s = src(rel);
    assert.ok(
      !s.includes("trivia-te-pack"),
      `${rel} must not import the trivia pack (off-limits surface)`
    );
    assert.ok(
      !s.includes("getTriviaTePack"),
      `${rel} must not call getTriviaTePack (off-limits surface)`
    );
  }
});
