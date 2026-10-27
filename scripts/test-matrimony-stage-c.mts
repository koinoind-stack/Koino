/**
 * ─── MATRIMONY STAGE C — LOGIC TESTS (Task 74) ──────────────────────────────
 *
 * Run:  npx tsx scripts/test-matrimony-stage-c.mts
 *
 * Covers the PURE Stage C core logic with no DB/network:
 *   1. birthDateRangeFromAges — age-filter → DOB-range conversion, exact
 *      birthday boundaries on both ends, one-sided ranges, contradiction.
 *   2. encodeDiscoveryCursor / parseDiscoveryCursor — roundtrip + tamper
 *      resistance (garbage, missing separator, bad date, bad id shape).
 *   3. matrimonyDiscoveryQuerySchema — fail-closed validation of every query
 *      param, string coercion, and limit clamps.
 *
 * API-level checks (401 gate, filters against real data) run separately —
 * see the Stage C report + scripts/test-matrimony-gates.sh.
 */

import {
  birthDateRangeFromAges,
  encodeDiscoveryCursor,
  matrimonyDiscoveryQuerySchema,
  parseDiscoveryCursor,
  MATRIMONY_DISCOVERY_LIMITS,
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

// ─── 1. birthDateRangeFromAges ──────────────────────────────────────────────
console.log("\n── birthDateRangeFromAges ──");

{
  const r = birthDateRangeFromAges({ ageMin: 18, ageMax: 30, now: NOW });
  check(
    "ageMin=18 → lte = end of (now − 18y)",
    r.lte?.toISOString() === "2008-06-15T23:59:59.999Z",
    r.lte?.toISOString()
  );
  check(
    "ageMax=30 → gte = start of (now − 31y) + 1 day",
    r.gte?.toISOString() === "1995-06-16T00:00:00.000Z",
    r.gte?.toISOString()
  );
}

{
  // Boundary semantics: born exactly on the lower cutoff day → age 18 exactly → included.
  const r = birthDateRangeFromAges({ ageMin: 18, now: NOW });
  const dob = new Date("2008-06-15T10:00:00Z");
  check(
    "born on cutoff day (2008-06-15) passes ageMin=18",
    !!r.lte && dob.getTime() <= r.lte.getTime()
  );
  const tooYoung = new Date("2008-06-16T00:00:00Z");
  check(
    "born day after cutoff (2008-06-16) fails ageMin=18",
    !!r.lte && tooYoung.getTime() > r.lte.getTime()
  );
}

{
  // Upper boundary: born 1995-06-15 → 31 today → excluded by ageMax=30.
  const r = birthDateRangeFromAges({ ageMax: 30, now: NOW });
  const just31 = new Date("1995-06-15T00:00:00Z");
  const still30 = new Date("1995-06-16T00:00:00Z");
  check(
    "born 1995-06-15 (age 31) excluded by ageMax=30",
    !!r.gte && just31.getTime() < r.gte.getTime()
  );
  check(
    "born 1995-06-16 (age 30) included by ageMax=30",
    !!r.gte && still30.getTime() >= r.gte.getTime()
  );
}

{
  const r = birthDateRangeFromAges({ now: NOW });
  check("no bounds → empty range", r.gte === undefined && r.lte === undefined);
}

{
  const r = birthDateRangeFromAges({ ageMin: 40, ageMax: 25, now: NOW });
  check(
    "ageMin > ageMax → contradictory range (gte > lte) matches nothing",
    !!r.gte && !!r.lte && r.gte.getTime() > r.lte.getTime()
  );
}

// ─── 2. Discovery cursor ────────────────────────────────────────────────────
console.log("\n── discovery cursor ──");

{
  const date = new Date("2026-06-15T12:00:00Z");
  const encoded = encodeDiscoveryCursor({ updatedAt: date, id: "cmdiscover123" });
  check(
    "encode format: <iso>~<id>",
    encoded === "2026-06-15T12:00:00.000Z~cmdiscover123",
    encoded
  );
  const back = parseDiscoveryCursor(encoded);
  check(
    "roundtrip preserves date + id",
    !!back && back.updatedAt.getTime() === date.getTime() && back.id === "cmdiscover123"
  );
}

check("null/undefined/empty cursor → null", parseDiscoveryCursor(null) === null && parseDiscoveryCursor(undefined) === null && parseDiscoveryCursor("") === null);
check("no separator → null", parseDiscoveryCursor("justanid") === null);
check("empty id part → null", parseDiscoveryCursor("2026-06-15T12:00:00.000Z~") === null);
check("garbage date → null", parseDiscoveryCursor("notadate~cmdiscover123") === null);
check("id with illegal chars → null", parseDiscoveryCursor("2026-06-15T12:00:00.000Z~bad;id!") === null);
check("id too short → null", parseDiscoveryCursor("2026-06-15T12:00:00.000Z~ab") === null);

{
  // Realistic cuid2 ids may contain "~"? No — cuid2 is [a-z0-9]. But ISO
  // dates never contain "~", so lastIndexOf is always the correct split.
  const encoded = encodeDiscoveryCursor({ updatedAt: "2026-01-01T00:00:00.000Z", id: "a1b2c3d4e5" });
  const back = parseDiscoveryCursor(encoded);
  check("string-date encode roundtrip", !!back && back.id === "a1b2c3d4e5" && back.updatedAt.toISOString() === "2026-01-01T00:00:00.000Z");
}

// ─── 3. matrimonyDiscoveryQuerySchema ───────────────────────────────────────
console.log("\n── discovery query schema ──");

{
  const ok = matrimonyDiscoveryQuerySchema.safeParse({
    q: "  teacher  ",
    gender: "female",
    state: "Kerala",
    city: "Kochi",
    language: "Hindi",
    ageMin: "22",
    ageMax: "30",
    limit: "12",
    cursor: "2026-06-15T12:00:00.000Z~cmdiscover123",
  });
  check(
    "full valid query parses (strings coerced, q trimmed)",
    ok.success &&
      ok.success &&
      (ok as Extract<typeof ok, { success: true }>).data.q === "teacher" &&
      (ok as Extract<typeof ok, { success: true }>).data.ageMin === 22 &&
      (ok as Extract<typeof ok, { success: true }>).data.ageMax === 30 &&
      (ok as Extract<typeof ok, { success: true }>).data.limit === 12
  );
}

{
  const ok = matrimonyDiscoveryQuerySchema.safeParse({});
  check("empty query is valid (everything optional)", ok.success);
}

check(
  `limit below ${MATRIMONY_DISCOVERY_LIMITS.pageMin} rejected`,
  !matrimonyDiscoveryQuerySchema.safeParse({ limit: String(MATRIMONY_DISCOVERY_LIMITS.pageMin - 1) }).success
);
check(
  `limit above ${MATRIMONY_DISCOVERY_LIMITS.pageMax} rejected`,
  !matrimonyDiscoveryQuerySchema.safeParse({ limit: String(MATRIMONY_DISCOVERY_LIMITS.pageMax + 1) }).success
);
check(
  `ageMin below ${MATRIMONY_DISCOVERY_LIMITS.filterAgeMin} rejected (18+ is non-negotiable)`,
  !matrimonyDiscoveryQuerySchema.safeParse({ ageMin: String(MATRIMONY_DISCOVERY_LIMITS.filterAgeMin - 1) }).success
);
check(
  `ageMax above ${MATRIMONY_DISCOVERY_LIMITS.filterAgeMax} rejected`,
  !matrimonyDiscoveryQuerySchema.safeParse({ ageMax: String(MATRIMONY_DISCOVERY_LIMITS.filterAgeMax + 1) }).success
);
check("non-integer age rejected", !matrimonyDiscoveryQuerySchema.safeParse({ ageMin: "21.5" }).success);
check("bad gender rejected", !matrimonyDiscoveryQuerySchema.safeParse({ gender: "other" }).success);
check("language not in the fixed list rejected", !matrimonyDiscoveryQuerySchema.safeParse({ language: "Klingon" }).success);
check("over-long q rejected", !matrimonyDiscoveryQuerySchema.safeParse({ q: "x".repeat(MATRIMONY_DISCOVERY_LIMITS.qMax + 1) }).success);
check("over-long cursor rejected", !matrimonyDiscoveryQuerySchema.safeParse({ cursor: "x".repeat(121) }).success);

// ─── Summary ────────────────────────────────────────────────────────────────
console.log(`\n===== ${pass}/${pass + fail} STAGE C LOGIC TESTS PASSED =====`);
if (fail > 0) process.exit(1);
