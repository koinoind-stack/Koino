/**
 * Launch-audit regression tests (post PR #30 audit, Nov 2026).
 *
 * Bugs found by the pre-launch audit and pinned here:
 *
 *   1. Daily Spin "2x FP Next Quiz" (double_fp) was advertised on the wheel,
 *      stored in DailySpin.rewardType — and NEVER honored. POST /api/trivia/submit
 *      had no reference to DailySpin (dead TODO in daily-spin/route.ts), so users
 *      won the epic reward and silently got nothing. The fix awards the bonus on
 *      the first EARN_POINTS quiz of the spin's day with a positive score, using
 *      an atomic conditional updateMany (rewardValue 1 → 0, count === 1 owns it)
 *      — race-safe with NO schema migration, and rewardType stays "double_fp" so
 *      GET /api/gamification/daily-spin keeps rendering the won-reward card.
 *   2. Telugu pack data-quality pins: beg_fb_003's explanation translated
 *      "rib" as "కాలువ" (a CANAL); the Telugu Bible word is "వాలు". And
 *      int_ot_015 dropped the number 450 ("450 prophets of Baal") from the
 *      question text. Both corrected; the correct-answer INDEX for
 *      beg_fb_003 must remain untouched (options[2] = "అవ్వ" = Eve).
 *   3. No branded 404 / route error boundary existed — plain Next defaults.
 *      src/app/not-found.tsx and src/app/error.tsx now render the app's
 *      dark-brand shell with localized copy (English / Telugu).
 *
 * Technique: Node's built-in test runner (node:test) + tsx. Pure source
 * contracts (fs.readFileSync + assertions) plus JSON data pins — no network,
 * no database, no production contact.
 *
 * Run: npm test
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path: string) => fs.readFileSync(path, "utf8");

/** Strip // line comments so contract regexes never match commentary. */
function code(src: string): string {
  return src.replace(/^\s*\/\/.*$/gm, "");
}

// ─── 1. Daily Spin double_fp reward is honored by POST /api/trivia/submit ───

test("LA-1: submit route consumes today's double_fp spin and awards the 2x bonus", () => {
  const src = code(read("src/app/api/trivia/submit/route.ts"));

  // Gating: EARN_POINTS only, and only when the quiz actually earned points.
  assert.match(src, /if \(mode === "EARN_POINTS" && result\.totalPointsEarned > 0\)/);

  // Reads the spin via the composite key (userId + spinDate = the spin's day).
  assert.match(src, /userId_spinDate: \{ userId: user\.id, spinDate: today \}/);
  assert.match(src, /spin\.rewardType === "double_fp"/);

  // Race-safe consumption: atomic conditional UPDATE, count === 1 owns it.
  assert.match(
    src,
    /updateMany\(\{\s*where: \{ id: spin\.id, rewardType: "double_fp", rewardValue: 1 \},\s*data: \{ rewardValue: 0 \},\s*\}\)/
  );
  assert.match(src, /consumed\.count === 1/);

  // Bonus is credited atomically with its ledger row (DOUBLE_FP_BONUS).
  assert.match(src, /db\.\$transaction\(\[/);
  assert.match(src, /totalPoints: \{ increment: bonusPoints \}/);
  assert.match(src, /reason: "DOUBLE_FP_BONUS"/);

  // The response's balance reflects the bonus before it is sent.
  assert.match(src, /result\.newTotalPoints = \(result\.newTotalPoints \|\| 0\) \+ bonusPoints/);
});

test("LA-2: response exposes doubleFpApplied + bonusPoints; failure can never break the result", () => {
  const src = code(read("src/app/api/trivia/submit/route.ts"));
  assert.match(src, /doubleFpApplied,/);
  assert.match(src, /bonusPoints,/);
  // The whole reward block is guarded — a spin hiccup must not 500 the quiz.
  const block = src.slice(src.indexOf('mode === "EARN_POINTS" && result.totalPointsEarned > 0'));
  assert.match(block, /catch \(e\)/);
  assert.match(block, /\[trivia\/submit\] double_fp handling failed/);
});

test("LA-3: rewardType is NOT renamed — GET /api/gamification/daily-spin keeps rendering the card", () => {
  const submit = code(read("src/app/api/trivia/submit/route.ts"));
  assert.doesNotMatch(submit, /double_fp_used/);
  assert.doesNotMatch(submit, /data: \{ rewardType:/);

  const spin = code(read("src/app/api/gamification/daily-spin/route.ts"));
  const spinRaw = read("src/app/api/gamification/daily-spin/route.ts");
  // GET resolves the won reward from the catalog by rewardType…
  assert.match(spin, /REWARDS\.find\(\(r\) => r\.type === existingSpin\.rewardType\)/);
  // …and the wheel still offers the epic double_fp reward.
  assert.match(spin, /type: "double_fp", value: 1, label: "2x FP Next Quiz"/);
  // The dead TODO is gone — replaced by the wiring note (checked on the RAW
  // source: the note itself is a comment, invisible to the stripped view).
  assert.doesNotMatch(spinRaw, /TODO: wire into submit/);
  assert.match(spinRaw, /consumed by POST \/api\/trivia\/submit/);
});

test("LA-4: TriviaView surfaces the 2x bonus in the FP toast", () => {
  const src = code(read("src/components/crosscrafted/TriviaView.tsx"));
  assert.match(src, /result\.doubleFpApplied/);
  assert.match(src, /result\.bonusPoints \|\| 0/);
  assert.match(src, /t\("triviaView\.doubleFpApplied", \{ n: result\.bonusPoints \|\| 0 \}\)/);
});

// ─── 2. i18n key parity (English + Telugu) ──────────────────────────────────

test("LA-5: new keys exist in BOTH en.ts and te.ts", () => {
  const en = read("src/lib/i18n/en.ts");
  const te = read("src/lib/i18n/te.ts");
  const keys = [
    "triviaView.doubleFpApplied",
    "notFound.title",
    "notFound.desc",
    "notFound.home",
    "error.title",
    "error.desc",
    "error.retry",
  ];
  for (const k of keys) {
    assert.match(en, new RegExp(`"${k}":`), `missing in en.ts: ${k}`);
    assert.match(te, new RegExp(`"${k}":`), `missing in te.ts: ${k}`);
  }
  // The Telugu copies really are Telugu (no accidental English passthrough).
  assert.match(te, /"notFound\.title": "[^"]*[\u0C00-\u0C7F]/);
  assert.match(te, /"error\.retry": "[^"]*[\u0C00-\u0C7F]/);
});

// ─── 3. Telugu pack data-quality pins ───────────────────────────────────────

test("LA-6: beg_fb_003 explanation says 'rib' (వాలు), not 'canal' (కాలువ); answer index untouched", () => {
  const pack = JSON.parse(read("src/lib/i18n/content/trivia-te.json")) as {
    entries: Record<string, { q: string; options: string[]; explanation: string }>;
  };
  const e = pack.entries["beg_fb_003"];
  assert.ok(e, "beg_fb_003 missing from the Telugu pack");
  assert.match(e.explanation, /వాలు/);
  assert.doesNotMatch(e.explanation, /కాలువ/);
  // The correct answer is Eve = "అవ్వ" at index 2 (matches DB correctAnswer: 2).
  assert.equal(e.options[2], "అవ్వ");
});

test("LA-7: int_ot_015 keeps the 450 prophets; pack still ships 800 complete entries", () => {
  const pack = JSON.parse(read("src/lib/i18n/content/trivia-te.json")) as {
    count: number;
    entries: Record<string, { q: string; options: string[]; explanation: string }>;
  };
  assert.equal(pack.count, 800);
  assert.equal(Object.keys(pack.entries).length, 800);
  assert.match(pack.entries["int_ot_015"].q, /450/);
  // No other entry lost the canal fix (regression sweep).
  for (const [id, e] of Object.entries(pack.entries)) {
    assert.doesNotMatch(e.explanation, /కాలువ/, `canal mistranslation in ${id}`);
  }
});

// ─── 4. Branded 404 + route error boundary ──────────────────────────────────

test("LA-8: not-found.tsx is a localized client page with a way home", () => {
  const src = read("src/app/not-found.tsx");
  assert.match(src, /"use client"/);
  assert.match(src, /useTranslation/);
  assert.match(src, /t\("notFound\.title"\)/);
  assert.match(src, /t\("notFound\.desc"\)/);
  assert.match(src, /href="\/"/);
  assert.match(src, /t\("notFound\.home"\)/);
});

test("LA-9: error.tsx is a client boundary with retry (reset) and localized copy", () => {
  const src = read("src/app/error.tsx");
  assert.match(src, /"use client"/);
  assert.match(src, /useTranslation/);
  assert.match(src, /reset: \(\) => void/);
  assert.match(src, /onClick=\{reset\}/);
  assert.match(src, /t\("error\.title"\)/);
  assert.match(src, /t\("error\.desc"\)/);
  assert.match(src, /t\("error\.retry"\)/);
  // Errors are logged for observability.
  assert.match(src, /console\.error/);
});

// ─── 5. Suite registration ──────────────────────────────────────────────────

test("LA-10: this suite is registered in the npm test list", () => {
  const pkg = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
  assert.match(pkg.scripts.test, /tests\/launch-audit\.test\.ts/);
});
