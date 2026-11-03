/**
 * Level-up popup regression tests (2026-11-04 user report).
 *
 * Bug: the "Level Up!" celebration + toast replayed on EVERY page refresh.
 * Root cause: useSupabaseUser starts points at 0 and fills in the real total
 * a moment later (after /api/auth/me). LevelUpAnimation armed its tier
 * detector on first render (baseline tier from the placeholder 0), so the
 * 0 → real-total transition always looked like a fresh level-up.
 *
 * Fix pinned here:
 *   1. The detector only arms once `ready` is true (profile loaded, real FP).
 *   2. The baseline is the higher of the loaded tier and the last tier this
 *      browser celebrated — persisted in localStorage under a fixed key.
 *   3. Celebrating writes the new tier back to that storage.
 *   4. TriviaView passes ready={!userLoading}.
 *
 * Technique: Node's built-in test runner (node:test) + tsx. Pure source
 * contracts — no React render, no network, no database.
 *
 * Run: npm test
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path: string) => fs.readFileSync(path, "utf8");

const anim = read("src/components/crosscrafted/LevelUpAnimation.tsx");
const trivia = read("src/components/crosscrafted/TriviaView.tsx");
const en = read("src/lib/i18n/en.ts");
const te = read("src/lib/i18n/te.ts");

// ─── 1. The ready gate: no arming until the real FP total has loaded ────────

test("LU-1: component takes a ready prop (default true) and holds arming until it is set", () => {
  assert.match(anim, /ready\?: boolean;/);
  // Default true keeps any future caller safe (celebrations may still fire,
  // but the old always-on-refresh bug needs the caller to pass real state).
  assert.match(anim, /ready = true/);
  // The arming block must bail out while the profile is still loading.
  assert.match(anim, /if \(!armed\.current\) \{/);
  assert.match(anim, /if \(!ready\) return;/);
  assert.match(anim, /armed\.current = true;/);
  // `ready` must be an effect dependency, or the detector would never arm
  // when the profile finishes loading without a points change.
  assert.match(anim, /\[totalPoints, ready, t\]/);
});

test("LU-2: the old always-arm-on-first-render pattern is gone", () => {
  assert.doesNotMatch(anim, /initialized\.current/);
});

test("LU-3: baseline combines the loaded tier with the persisted seen tier", () => {
  assert.match(anim, /prevTierIdx\.current = Math\.max\(currentTierIdx, getSeenTier\(\)\);/);
});

// ─── 2. localStorage persistence: at most one celebration per tier/device ───

test("LU-4: seen tier is persisted under a stable key with SSR + quota guards", () => {
  assert.match(anim, /const SEEN_TIER_KEY = "koino:levelup-seen-tier";/);
  const getFn = anim.slice(
    anim.indexOf("function getSeenTier"),
    anim.indexOf("function setSeenTier")
  );
  const setFn = anim.slice(
    anim.indexOf("function setSeenTier"),
    anim.indexOf("type LevelUpAnimationProps")
  );
  // SSR-safe read…
  assert.match(getFn, /if \(typeof window === "undefined"\) return -1;/);
  assert.match(getFn, /window\.localStorage\.getItem\(SEEN_TIER_KEY\)/);
  // …write path…
  assert.match(setFn, /window\.localStorage\.setItem\(SEEN_TIER_KEY, String\(idx\)\);/);
  // …and both paths survive disabled storage (private mode / quota).
  assert.match(getFn, /catch/);
  assert.match(setFn, /catch/);
});

test("LU-5: celebrating a tier writes it back to the seen-tier storage", () => {
  // The persist call must sit inside the tier-increase branch, before/with
  // the celebration state flip — not in a cleanup or unrelated effect.
  const celebrateBlock = anim.slice(
    anim.indexOf("if (currentTierIdx > prevTierIdx.current)"),
    anim.indexOf("prevTierIdx.current = currentTierIdx;")
  );
  assert.ok(celebrateBlock.length > 0, "tier-increase branch not found");
  assert.match(celebrateBlock, /setShowCelebration\(true\);/);
  assert.match(celebrateBlock, /setSeenTier\(currentTierIdx\);/);
});

// ─── 3. Caller wiring: TriviaView waits for the profile fetch ───────────────

test("LU-6: TriviaView passes ready={!userLoading} so the placeholder 0 never arms the detector", () => {
  assert.match(trivia, /loading: userLoading/);
  assert.match(trivia, /<LevelUpAnimation totalPoints=\{userPoints \|\| 0\} ready=\{!userLoading\} \/>/);
});

// ─── 4. Hygiene: auto-hide timer is cleaned up on unmount ────────────────────

test("LU-7: auto-hide timer is cancelled on unmount (no setState-after-unmount)", () => {
  assert.match(anim, /hideTimer\.current = setTimeout/);
  assert.match(anim, /clearTimeout\(hideTimer\.current\)/);
});

// ─── 5. i18n: the celebration copy stays translated in both languages ───────

test("LU-8: levelup keys exist in BOTH en and te packs (popup + toast render translated)", () => {
  const keys = [
    "levelup.tier.faithSeeker",
    "levelup.tier.bibleStudent",
    "levelup.tier.spiritualDisciple",
    "levelup.tier.bibleTeacher",
    "levelup.tier.theologyScholar",
    "levelup.tier.wordWarrior",
    "levelup.tier.bibleMaster",
    "levelup.toast",
    "levelup.title",
    "levelup.reached",
    "levelup.shareCta",
  ];
  for (const key of keys) {
    assert.ok(en.includes(`"${key}":`), `en.ts missing ${key}`);
    assert.ok(te.includes(`"${key}":`), `te.ts missing ${key}`);
  }
  // Telugu pack must carry real Telugu script, not English fallbacks.
  assert.match(te, /"levelup\.title": "[^"]*లెవెల్[^"]*"/);
  assert.match(te, /"levelup\.reached": "[^"]*పాయింట్ల[^"]*"/);
});
