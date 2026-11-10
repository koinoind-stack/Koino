// ─────────────────────────────────────────────────────────────────────────────
// Trivia competition (Weekly Quiz / hosted) — Telugu support regression suite.
//
// The user reported: "bible trivia is not changing when I shift to Telugu"
// with a screenshot showing the WEEKLY QUIZ (hosted competition) serving an
// English question while the site UI was in Telugu. Root cause: the hosted
// competition start route (`/api/trivia/competitions/[id]/start`) served
// questions from the DB with NO translation lookup and NO Telugu pack
// fallback, and the client (`CompetitionQuizView`) sent no `lang` parameter.
// The regular trivia route (`/api/trivia/start`) already had the 3-tier
// fallback — the competition route did not.
//
// Pins (source contracts, no network/DB):
//   • the competition start route accepts a `lang` body parameter and
//     validates it against the same language list as /api/trivia/start;
//   • the competition start route wires the THREE-tier fallback
//     (DB translations → static Telugu pack → English) with the pack
//     loaded ONLY when lang === "te";
//   • CompetitionQuizView sends `lang` from useLanguage() in the request body;
//   • the correct-answer index is never altered by translation (options are
//     translated position-for-position);
//   • scoring/anti-farming surfaces (submit route, attempt limit) untouched.
// ─────────────────────────────────────────────────────────────────────────────

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function src(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

const START_ROUTE = src("src/app/api/trivia/competitions/[id]/start/route.ts");
const COMP_QUIZ_VIEW = src("src/components/crosscrafted/CompetitionQuizView.tsx");

test("TQ-1: competition start route imports the Telugu pack loader", () => {
  assert.ok(
    START_ROUTE.includes('import { getTriviaTePack } from "@/lib/i18n/content/trivia-te-pack";'),
    "the competition start route must import getTriviaTePack"
  );
});

test("TQ-2: competition start route accepts and validates a `lang` body parameter", () => {
  assert.ok(
    START_ROUTE.includes("if (body && typeof body.lang === \"string\") lang = body.lang;"),
    "lang must be read from the request body"
  );
  // Same language allowlist as /api/trivia/start
  assert.ok(
    START_ROUTE.includes('"te"') && START_ROUTE.includes('"en"'),
    "both te and en must be accepted languages"
  );
  assert.ok(
    START_ROUTE.includes('if (!validLangs.includes(lang)) lang = "en";'),
    "invalid languages must fall back to English"
  );
});

test("TQ-3: competition start route wires the THREE-tier fallback (Telugu ONLY)", () => {
  // Tier 2: static pack gated to te
  assert.ok(
    START_ROUTE.includes('lang === "te" ? getTriviaTePack() : null'),
    "the pack must load ONLY when lang === 'te' — no other language triggers it"
  );
  // Tier 1: DB translations
  assert.ok(
    START_ROUTE.includes("allTranslations[lang]"),
    "DB translations must remain priority 1"
  );
  // Tier 3: English fallback in the mapping
  assert.ok(
    START_ROUTE.includes("packed?.q || q.question"),
    "English fallback for question text"
  );
  assert.ok(
    START_ROUTE.includes("packed?.options || options"),
    "English fallback for options"
  );
});

test("TQ-4: CompetitionQuizView sends `lang` from useLanguage() in the request body", () => {
  assert.ok(
    COMP_QUIZ_VIEW.includes("useLanguage"),
    "useLanguage hook must be imported"
  );
  assert.ok(
    COMP_QUIZ_VIEW.includes("const { lang } = useLanguage()"),
    "lang must be destructured from the language context"
  );
  assert.ok(
    COMP_QUIZ_VIEW.includes("body: JSON.stringify({ lang })"),
    "the start request must include lang in the body"
  );
  assert.ok(
    COMP_QUIZ_VIEW.includes('headers: { "Content-Type": "application/json" }'),
    "the request must declare the JSON content type"
  );
});

test("TQ-5: scoring submit route untouched (anti-farming preserved)", () => {
  const submit = src("src/app/api/trivia/competitions/[id]/submit/route.ts");
  assert.ok(
    submit.includes("POST"),
    "the competition submit route still exports POST"
  );
  // The submit route must NOT have been given translation logic — grading is
  // language-independent (server checks the correctAnswer index).
  assert.ok(
    !submit.includes("getTriviaTePack"),
    "submit route must not load the Telugu pack (grading is index-based)"
  );
});

test("TQ-6: regular trivia start route keeps its own independent wiring", () => {
  const regular = src("src/app/api/trivia/start/route.ts");
  assert.ok(
    regular.includes('lang === "te" ? getTriviaTePack() : null'),
    "the regular trivia route must keep its Telugu pack wiring"
  );
});
