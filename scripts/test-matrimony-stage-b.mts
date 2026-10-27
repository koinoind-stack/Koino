/**
 * ─── MATRIMONY STAGE B — LOGIC TESTS (Task 74) ──────────────────────────────
 *
 * Run:  npx tsx scripts/test-matrimony-stage-b.mts
 *
 * Covers the PURE core logic with no DB/network:
 *   1. ageFromDOB — birthday-correct calendar age, boundaries, future/invalid.
 *   2. isMatrimonyEligibleDOB — 18+ gate.
 *   3. canViewMatrimonyPhoto — the full photo authorization matrix (fails
 *      closed; connections-only = owner-only in Stage B).
 *   4. matrimonyStatusAfterDobChange — DOB-change restriction policy.
 *   5. matrimonyProfileInputSchema — server-side validation rules.
 *
 * API-level checks (401 gates etc.) run separately against a dev server —
 * see the Stage B report.
 */

import {
  ageFromDOB,
  isMatrimonyEligibleDOB,
  canViewMatrimonyPhoto,
  matrimonyStatusAfterDobChange,
  matrimonyProfileInputSchema,
  MATRIMONY_MIN_AGE,
} from "../src/lib/matrimony";

let pass = 0;
let fail = 0;

function check(name: string, cond: boolean, detail = "") {
  if (cond) {
    pass++;
    console.log(`PASS  ${name}${detail ? `  —  ${detail}` : ""}`);
  } else {
    fail++;
    console.log(`FAIL  ${name}${detail ? `  —  ${detail}` : ""}`);
  }
}

// Fixed "now" so tests are deterministic. 2026-06-15T12:00:00Z
const NOW = new Date("2026-06-15T12:00:00Z");

// ─── 1. ageFromDOB ──────────────────────────────────────────────────────────
console.log("\n── ageFromDOB ──");

check(
  "birthday already passed this year → full year count",
  ageFromDOB(new Date("2000-03-10T00:00:00Z"), NOW) === 26,
  "2000-03-10 @ 2026-06-15 = 26"
);
check(
  "birthday NOT yet this year → one less",
  ageFromDOB(new Date("2000-08-10T00:00:00Z"), NOW) === 25,
  "2000-08-10 @ 2026-06-15 = 25"
);
check(
  "birthday TODAY counts as reached",
  ageFromDOB(new Date("2000-06-15T00:00:00Z"), NOW) === 26,
  "2000-06-15 @ 2026-06-15 = 26"
);
check(
  "leap-day birthday (Feb 29): age correct on non-leap year",
  ageFromDOB(new Date("2004-02-29T00:00:00Z"), new Date("2026-03-01T00:00:00Z")) === 22,
  "2004-02-29 @ 2026-03-01 = 22"
);
check(
  "leap-day birthday: on Feb 28 not yet birthday",
  ageFromDOB(new Date("2004-02-29T00:00:00Z"), new Date("2026-02-28T00:00:00Z")) === 21
);
check("future DOB → -1", ageFromDOB(new Date("2030-01-01T00:00:00Z"), NOW) === -1);
check("null DOB → -1", ageFromDOB(null, NOW) === -1);
check("invalid DOB → -1", ageFromDOB(new Date("not-a-date"), NOW) === -1);
check(
  "exactly 18 today (18th birthday) → 18",
  ageFromDOB(new Date("2008-06-15T00:00:00Z"), NOW) === 18
);
check(
  "day before 18th birthday → 17",
  ageFromDOB(new Date("2008-06-16T00:00:00Z"), NOW) === 17
);

// ─── 2. isMatrimonyEligibleDOB ──────────────────────────────────────────────
console.log("\n── isMatrimonyEligibleDOB (min age " + MATRIMONY_MIN_AGE + ") ──");

check("18-year-old eligible", isMatrimonyEligibleDOB(new Date("2008-06-15T00:00:00Z"), NOW) === true);
check("17-year-old NOT eligible", isMatrimonyEligibleDOB(new Date("2008-06-16T00:00:00Z"), NOW) === false);
check("missing DOB NOT eligible", isMatrimonyEligibleDOB(null, NOW) === false);
check("future DOB NOT eligible", isMatrimonyEligibleDOB(new Date("2027-01-01T00:00:00Z"), NOW) === false);
check("40-year-old eligible", isMatrimonyEligibleDOB(new Date("1986-01-01T00:00:00Z"), NOW) === true);

// ─── 3. canViewMatrimonyPhoto ───────────────────────────────────────────────
console.log("\n── canViewMatrimonyPhoto (authorization matrix) ──");

const OWNER = "user-owner";
const OTHER = "user-other";

// Owner access
check(
  "owner sees own photo regardless of visibility/status",
  canViewMatrimonyPhoto({
    requesterId: OWNER, ownerId: OWNER, requesterEligible: false,
    profileStatus: "draft", visibility: "CONNECTIONS_ONLY", blocked: false,
  }) === true
);
check(
  "owner sees own photo even when restricted",
  canViewMatrimonyPhoto({
    requesterId: OWNER, ownerId: OWNER, requesterEligible: false,
    profileStatus: "restricted", visibility: "CONNECTIONS_ONLY", blocked: false,
  }) === true
);

// Unauthenticated / ineligible
check(
  "ineligible member denied ELIGIBLE_MEMBERS photo",
  canViewMatrimonyPhoto({
    requesterId: OTHER, ownerId: OWNER, requesterEligible: false,
    profileStatus: "active", visibility: "ELIGIBLE_MEMBERS", blocked: false,
  }) === false
);

// Stage B core rule: CONNECTIONS_ONLY = owner-only
check(
  "Stage B: eligible member CANNOT see connections-only photo (no connections yet)",
  canViewMatrimonyPhoto({
    requesterId: OTHER, ownerId: OWNER, requesterEligible: true,
    profileStatus: "active", visibility: "CONNECTIONS_ONLY", blocked: false,
    hasAcceptedConnection: false,
  }) === false
);
check(
  "Stage C preview: accepted connection CAN see connections-only photo",
  canViewMatrimonyPhoto({
    requesterId: OTHER, ownerId: OWNER, requesterEligible: true,
    profileStatus: "active", visibility: "CONNECTIONS_ONLY", blocked: false,
    hasAcceptedConnection: true,
  }) === true
);

// ELIGIBLE_MEMBERS
check(
  "eligible member CAN see members-visible photo on active profile",
  canViewMatrimonyPhoto({
    requesterId: OTHER, ownerId: OWNER, requesterEligible: true,
    profileStatus: "active", visibility: "ELIGIBLE_MEMBERS", blocked: false,
  }) === true
);

// Profile status gating
check(
  "paused profile hidden from eligible members (even members-visibility)",
  canViewMatrimonyPhoto({
    requesterId: OTHER, ownerId: OWNER, requesterEligible: true,
    profileStatus: "paused", visibility: "ELIGIBLE_MEMBERS", blocked: false,
  }) === false
);
check(
  "draft profile hidden from eligible members",
  canViewMatrimonyPhoto({
    requesterId: OTHER, ownerId: OWNER, requesterEligible: true,
    profileStatus: "draft", visibility: "ELIGIBLE_MEMBERS", blocked: false,
  }) === false
);
check(
  "restricted profile hidden from eligible members",
  canViewMatrimonyPhoto({
    requesterId: OTHER, ownerId: OWNER, requesterEligible: true,
    profileStatus: "restricted", visibility: "ELIGIBLE_MEMBERS", blocked: false,
  }) === false
);

// Blocks (either direction)
check(
  "blocked requester denied members-visible photo",
  canViewMatrimonyPhoto({
    requesterId: OTHER, ownerId: OWNER, requesterEligible: true,
    profileStatus: "active", visibility: "ELIGIBLE_MEMBERS", blocked: true,
  }) === false
);

// Fail-closed edges
check(
  "unknown visibility value denied",
  canViewMatrimonyPhoto({
    requesterId: OTHER, ownerId: OWNER, requesterEligible: true,
    profileStatus: "active", visibility: "SOMETHING_ELSE", blocked: false,
  }) === false
);
check(
  "missing requester id denied",
  canViewMatrimonyPhoto({
    requesterId: "", ownerId: OWNER, requesterEligible: true,
    profileStatus: "active", visibility: "ELIGIBLE_MEMBERS", blocked: false,
  }) === false
);

// ─── 4. matrimonyStatusAfterDobChange ───────────────────────────────────────
console.log("\n── matrimonyStatusAfterDobChange (DOB-change policy) ──");

check(
  "no matrimony profile → never restricts",
  matrimonyStatusAfterDobChange({ hasMatrimonyProfile: false, newDob: new Date("2020-01-01"), now: NOW }).restrict === false
);
check(
  "18+ DOB change → no restriction",
  matrimonyStatusAfterDobChange({ hasMatrimonyProfile: true, newDob: new Date("2000-01-01T00:00:00Z"), now: NOW }).restrict === false
);
check(
  "under-18 DOB change → restrict",
  matrimonyStatusAfterDobChange({ hasMatrimonyProfile: true, newDob: new Date("2012-01-01T00:00:00Z"), now: NOW }).restrict === true
);
check(
  "cleared DOB (null) → restrict",
  matrimonyStatusAfterDobChange({ hasMatrimonyProfile: true, newDob: null, now: NOW }).restrict === true
);
check(
  "future DOB → restrict",
  matrimonyStatusAfterDobChange({ hasMatrimonyProfile: true, newDob: new Date("2035-01-01T00:00:00Z"), now: NOW }).restrict === true
);

// ─── 5. matrimonyProfileInputSchema ─────────────────────────────────────────
console.log("\n── matrimonyProfileInputSchema (server validation) ──");

const valid = matrimonyProfileInputSchema.safeParse({
  languages: ["English", "Hindi"],
  intention: "seeking_life_partner",
  timeline: "gods_timing",
});
check("valid minimal payload accepted", valid.success === true);
check(
  "photoVisibility defaults to CONNECTIONS_ONLY",
  valid.success && valid.data.photoVisibility === "CONNECTIONS_ONLY"
);

check(
  "empty languages rejected",
  !matrimonyProfileInputSchema.safeParse({ languages: [], intention: "seeking_life_partner", timeline: "gods_timing" }).success
);
check(
  "7 languages rejected (max 6)",
  !matrimonyProfileInputSchema.safeParse({ languages: ["a", "b", "c", "d", "e", "f", "g"], intention: "seeking_life_partner", timeline: "gods_timing" }).success
);
check(
  "unknown intention rejected",
  !matrimonyProfileInputSchema.safeParse({ languages: ["English"], intention: "just_browsing", timeline: "gods_timing" }).success
);
check(
  "unknown timeline rejected",
  !matrimonyProfileInputSchema.safeParse({ languages: ["English"], intention: "seeking_life_partner", timeline: "whenever" }).success
);
check(
  "bogus visibility rejected",
  !matrimonyProfileInputSchema.safeParse({ languages: ["English"], intention: "seeking_life_partner", timeline: "gods_timing", photoVisibility: "PUBLIC" }).success
);
check(
  "aboutMe over 2000 chars rejected",
  !matrimonyProfileInputSchema.safeParse({
    languages: ["English"], intention: "seeking_life_partner", timeline: "gods_timing",
    aboutMe: "x".repeat(2001),
  }).success
);
check(
  "height under 90cm rejected",
  !matrimonyProfileInputSchema.safeParse({
    languages: ["English"], intention: "seeking_life_partner", timeline: "gods_timing", heightCm: 50,
  }).success
);
check(
  "optional fields may be empty/null",
  matrimonyProfileInputSchema.safeParse({
    languages: ["English"], intention: "seeking_life_partner", timeline: "gods_timing",
    denomination: null, education: null, profession: null, aboutMe: null, heightCm: null,
  }).success === true
);
check(
  "no DOB field exists in the schema (client cannot inject one)",
  !("dateOfBirth" in (matrimonyProfileInputSchema.shape as Record<string, unknown>))
);

// ─── Summary ────────────────────────────────────────────────────────────────
console.log(`\n===== ${pass}/${pass + fail} PASSED =====`);
process.exit(fail === 0 ? 0 : 1);
