// ─────────────────────────────────────────────────────────────────────────────
// Gamification Daily Challenge — Telugu support regression suite.
//
// Follow-up to the user report "bible trivia is not changing when I shift to
// Telugu": PR #28 fixed the hosted competition (Weekly Quiz) surface, but the
// DAILY CHALLENGE card on the Trivia page (screenshot: "Who was the first
// woman?" served in English while the UI was Telugu) is a THIRD surface fed
// by /api/gamification/daily-challenge — which had no translation lookup at
// all, and a client that sent no lang parameter.
//
// Pins (source contracts, no network/DB):
//   • the daily-challenge route imports the Telugu pack loader;
//   • GET reads `lang` from the query string, POST from the body, both
//     sanitized against the same allowlist as /api/trivia/start
//     (invalid → English);
//   • the route wires the THREE-tier fallback (DB translations → static
//     Telugu pack → English) with the pack loaded ONLY when lang === "te";
//   • POST translates the returned explanation (grading itself stays
//     index-based and language-independent);
//   • anti-farming (unique attempt per user per challenge) is untouched;
//   • GamificationPanel sends lang (query + body) and refetches when the
//     language changes;
//   • the exact question from the user's screenshot (beg_fb_003) has a
//     complete Telugu pack entry.
// ─────────────────────────────────────────────────────────────────────────────

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function src(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

const DAILY_ROUTE = src("src/app/api/gamification/daily-challenge/route.ts");
const GAMIFICATION_PANEL = src("src/components/crosscrafted/GamificationPanel.tsx");

function langCodesOf(source: string): string[] {
  const match = source.match(/\[(?:"[a-z]{2}",\s*)*"[a-z]{2}"\]/);
  assert.ok(match, "a quoted language-code array must exist in the source");
  return [...match[0].matchAll(/"([a-z]{2})"/g)].map((m) => m[1]);
}

test("TQ-10: daily-challenge route imports the Telugu pack loader", () => {
  assert.ok(
    DAILY_ROUTE.includes('import { getTriviaTePack } from "@/lib/i18n/content/trivia-te-pack";'),
    "the daily-challenge route must import getTriviaTePack"
  );
});

test("TQ-11: GET reads lang from the query string, POST from the body; both sanitized", () => {
  assert.ok(
    DAILY_ROUTE.includes('req.nextUrl.searchParams.get("lang")'),
    "GET must read the lang query parameter"
  );
  assert.ok(
    DAILY_ROUTE.includes("sanitizeLang(body?.lang)"),
    "POST must read lang from the request body"
  );
  assert.ok(
    DAILY_ROUTE.includes("typeof raw === \"string\" && VALID_LANGS.includes(raw) ? raw : \"en\""),
    "invalid languages must fall back to English"
  );
});

test("TQ-12: daily-challenge language allowlist matches /api/trivia/start", () => {
  const dailyCodes = langCodesOf(DAILY_ROUTE);
  const startRoute = src("src/app/api/trivia/start/route.ts");
  const startCodes = langCodesOf(startRoute);
  assert.deepEqual(
    [...dailyCodes].sort(),
    [...startCodes].sort(),
    "daily-challenge must accept exactly the same language set as regular trivia"
  );
  assert.ok(dailyCodes.includes("te") && dailyCodes.includes("en"), "te and en must be accepted");
});

test("TQ-13: daily-challenge route wires the THREE-tier fallback (Telugu ONLY)", () => {
  // Tier 2: static pack gated to te
  assert.ok(
    DAILY_ROUTE.includes('lang === "te" ? getTriviaTePack() : null'),
    "the pack must load ONLY when lang === 'te' — no other language triggers it"
  );
  // Tier 1: DB translations
  assert.ok(
    DAILY_ROUTE.includes("allTranslations[lang]"),
    "DB translations must remain priority 1"
  );
  // Tier 3: English fallbacks
  assert.ok(
    DAILY_ROUTE.includes("packed?.q || question.question"),
    "English fallback for question text"
  );
  assert.ok(
    DAILY_ROUTE.includes("packed?.options || options"),
    "English fallback for options"
  );
});

test("TQ-14: POST translates the explanation; grading stays index-based", () => {
  assert.ok(
    DAILY_ROUTE.includes(
      "explanation: translated?.explanation || packed?.explanation || question.explanation"
    ),
    "the POST response explanation must use the 3-tier fallback"
  );
  // Grading is language-independent: server compares the selected INDEX.
  assert.ok(
    DAILY_ROUTE.includes("selectedAnswer === question.correctAnswer"),
    "grading must remain index-based (correctAnswer never translated)"
  );
});

test("TQ-15: anti-farming untouched (unique attempt per user per challenge)", () => {
  assert.ok(
    DAILY_ROUTE.includes("userId_challengeId: { userId, challengeId: challenge.id }"),
    "the unique per-user-per-challenge attempt lookup must remain"
  );
  assert.ok(
    DAILY_ROUTE.includes("You already answered today's challenge"),
    "the duplicate-answer rejection must remain"
  );
  assert.ok(
    DAILY_ROUTE.includes("question.basePoints * challenge.multiplier"),
    "the 2x FP awarding logic must remain unchanged"
  );
});

test("TQ-16: GamificationPanel sends lang and refetches on language switch", () => {
  assert.ok(
    GAMIFICATION_PANEL.includes("const { lang } = useLanguage()"),
    "lang must come from the language context"
  );
  assert.ok(
    GAMIFICATION_PANEL.includes(
      "`/api/gamification/daily-challenge?lang=${encodeURIComponent(lang)}`"
    ),
    "the GET request must carry lang as a query parameter"
  );
  assert.ok(
    GAMIFICATION_PANEL.includes("body: JSON.stringify({ selectedAnswer, lang })"),
    "the POST submit must include lang in the body"
  );
  assert.ok(
    GAMIFICATION_PANEL.includes("[isAuthenticated, lang, fetchChallenge"),
    "the fetch effect must re-run when lang changes"
  );
});

test("TQ-17: the screenshot's daily question (beg_fb_003) has a complete Telugu pack entry", () => {
  const pack = JSON.parse(src("src/lib/i18n/content/trivia-te.json"));
  const entry = pack.entries?.["beg_fb_003"];
  assert.ok(entry, "beg_fb_003 ('Who was the first woman?') must be in the Telugu pack");
  assert.match(entry.q, /[\u0C00-\u0C7F]/, "question text must be Telugu script");
  assert.strictEqual(entry.options.length, 4, "must have exactly 4 options");
  entry.options.forEach((opt: string, i: number) => {
    assert.match(opt, /[\u0C00-\u0C7F]/, `option ${i} must be Telugu script`);
  });
  assert.match(entry.explanation, /[\u0C00-\u0C7F]/, "explanation must be Telugu script");
});
