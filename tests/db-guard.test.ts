/**
 * Regression tests — Phase 1 Fix 5: DB-target guard.
 *
 * E2E test data ("E2E Verification Church II") reached the production
 * database because every repo script runs against whatever DATABASE_URL is
 * exported — nothing refused production targets. scripts/lib/db-guard.ts
 * adds a fail-closed tripwire. These tests pin the decision logic:
 *
 *   - host+database match against PRODUCTION_DATABASE_URL → production
 *   - same Supabase project ref (pooler user vs pooler user, and pooler
 *     user vs NEXT_PUBLIC_SUPABASE_URL) → production
 *   - different project/host/database → allowed (dev targets)
 *   - localhost is never production by itself
 *   - ALLOW_PRODUCTION_DB=1 override and missing-DATABASE_URL behavior
 *
 * Pure unit tests over scripts/lib/db-guard.ts + env-based behavior of
 * assertNotProductionDb (env is saved/restored around each test).
 * No network, no database.
 *
 * Run: npm test
 */
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import {
  parseDbTarget,
  supabaseRefFromPublicUrl,
  isProductionDbTarget,
  describeDbTarget,
  assertNotProductionDb,
} from "../scripts/lib/db-guard";

// ─── Well-formed fake URLs (no real credentials) ────────────────────────────
const PROD_POOLER = "postgresql://postgres.prodref123:PASSWORD@aws-0-ap-south-1.pooler.supabase.com:5432/postgres";
const DEV_POOLER = "postgresql://postgres.devref456:PASSWORD@aws-0-eu-central-1.pooler.supabase.com:5432/postgres";
const PROD_DIRECT = "postgresql://postgres:PASSWORD@db.prodref123.supabase.co:5432/postgres";
const LOCAL = "postgresql://postgres:PASSWORD@localhost:5432/koino_dev";
const LOCAL_FILE = "file:./db/custom.db";

// ════════════════════════════════════════════════════════════════════════════
// parseDbTarget
// ════════════════════════════════════════════════════════════════════════════

test("DG-1: pooler URL — project ref extracted from the postgres.<ref> user", () => {
  const t = parseDbTarget(PROD_POOLER);
  assert.ok(t);
  assert.equal(t!.host, "aws-0-ap-south-1.pooler.supabase.com");
  assert.equal(t!.database, "postgres");
  assert.equal(t!.projectRef, "prodref123");
});

test("DG-2: direct supabase host — ref extracted from db.<ref>.supabase.co", () => {
  const t = parseDbTarget(PROD_DIRECT);
  assert.ok(t);
  assert.equal(t!.projectRef, "prodref123");
});

test("DG-3: localhost / non-supabase targets have no project ref", () => {
  assert.equal(parseDbTarget(LOCAL)?.projectRef, null);
});

test("DG-4: garbage / non-postgres URLs parse to null (never throw)", () => {
  assert.equal(parseDbTarget(LOCAL_FILE), null);
  assert.equal(parseDbTarget(""), null);
  assert.equal(parseDbTarget("not a url"), null);
});

// ════════════════════════════════════════════════════════════════════════════
// supabaseRefFromPublicUrl
// ════════════════════════════════════════════════════════════════════════════

test("DG-5: public Supabase URL yields its project ref", () => {
  assert.equal(supabaseRefFromPublicUrl("https://prodref123.supabase.co"), "prodref123");
  assert.equal(supabaseRefFromPublicUrl("https://evil.example.com"), null);
  assert.equal(supabaseRefFromPublicUrl(""), null);
});

// ════════════════════════════════════════════════════════════════════════════
// isProductionDbTarget — the core decision
// ════════════════════════════════════════════════════════════════════════════

test("DG-6: DATABASE_URL identical to PRODUCTION_DATABASE_URL → production", () => {
  const v = isProductionDbTarget(PROD_POOLER, { productionDatabaseUrl: PROD_POOLER });
  assert.equal(v.production, true);
  assert.ok(v.reason);
});

test("DG-7: same Supabase project ref via a DIFFERENT pooler host → production", () => {
  // Same project, different region pooler — ref match must still catch it.
  const otherRegion = "postgresql://postgres.prodref123:PASSWORD@aws-0-eu-west-2.pooler.supabase.com:5432/postgres";
  const v = isProductionDbTarget(otherRegion, { productionDatabaseUrl: PROD_POOLER });
  assert.equal(v.production, true);
  assert.match(v.reason!, /project ref/);
});

test("DG-8: pooler DATABASE_URL vs direct PRODUCTION_DATABASE_URL of the same project → production", () => {
  const v = isProductionDbTarget(PROD_POOLER, { productionDatabaseUrl: PROD_DIRECT });
  assert.equal(v.production, true);
});

test("DG-9: DATABASE_URL project ref matching NEXT_PUBLIC_SUPABASE_URL → production", () => {
  const v = isProductionDbTarget(PROD_POOLER, { publicSupabaseUrl: "https://prodref123.supabase.co" });
  assert.equal(v.production, true);
  assert.match(v.reason!, /app's own Supabase project/);
});

test("DG-10: different dev project (different ref) → allowed", () => {
  const v = isProductionDbTarget(DEV_POOLER, {
    productionDatabaseUrl: PROD_POOLER,
    publicSupabaseUrl: "https://prodref123.supabase.co",
  });
  assert.equal(v.production, false);
  assert.equal(v.reason, null);
});

test("DG-11: plain localhost is never production on its own", () => {
  const v = isProductionDbTarget(LOCAL, {
    productionDatabaseUrl: PROD_POOLER,
    publicSupabaseUrl: "https://prodref123.supabase.co",
  });
  assert.equal(v.production, false);
});

test("DG-12: with NO detection inputs configured, nothing is flagged (banner-only mode)", () => {
  assert.equal(isProductionDbTarget(PROD_POOLER, {}).production, false);
});

// ════════════════════════════════════════════════════════════════════════════
// describeDbTarget — banner must never leak credentials
// ════════════════════════════════════════════════════════════════════════════

test("DG-13: banner describes host/database/ref WITHOUT the password", () => {
  const s = describeDbTarget(PROD_POOLER);
  assert.match(s, /host=aws-0-ap-south-1\.pooler\.supabase\.com/);
  assert.match(s, /db=postgres/);
  assert.match(s, /supabase ref: prodref123/);
  assert.doesNotMatch(s, /PASSWORD/);
});

// ════════════════════════════════════════════════════════════════════════════
// assertNotProductionDb — env-driven behavior
// ════════════════════════════════════════════════════════════════════════════

const ENV_KEYS = ["DATABASE_URL", "PRODUCTION_DATABASE_URL", "NEXT_PUBLIC_SUPABASE_URL", "ALLOW_PRODUCTION_DB"] as const;
const savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of ENV_KEYS) savedEnv[k] = process.env[k];
  for (const k of ENV_KEYS) delete process.env[k];
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
});

test("DG-14: assertNotProductionDb throws when DATABASE_URL is production (guard tripwire)", () => {
  process.env.DATABASE_URL = PROD_POOLER;
  process.env.PRODUCTION_DATABASE_URL = PROD_POOLER;
  assert.throws(() => assertNotProductionDb("test-script"), /REFUSING to run/);
});

test("DG-15: assertNotProductionDb throws when DATABASE_URL matches the app's own Supabase ref", () => {
  process.env.DATABASE_URL = PROD_POOLER;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://prodref123.supabase.co";
  assert.throws(() => assertNotProductionDb("test-script"), /REFUSING to run/);
});

test("DG-16: assertNotProductionDb PASSES for a dev database with production detection configured", () => {
  process.env.DATABASE_URL = DEV_POOLER;
  process.env.PRODUCTION_DATABASE_URL = PROD_POOLER;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://prodref123.supabase.co";
  assert.doesNotThrow(() => assertNotProductionDb("test-script"));
});

test("DG-17: ALLOW_PRODUCTION_DB=1 explicitly overrides the refusal", () => {
  process.env.DATABASE_URL = PROD_POOLER;
  process.env.PRODUCTION_DATABASE_URL = PROD_POOLER;
  process.env.ALLOW_PRODUCTION_DB = "1";
  assert.doesNotThrow(() => assertNotProductionDb("test-script"));
});

test("DG-18: assertNotProductionDb throws when DATABASE_URL is missing entirely", () => {
  assert.throws(() => assertNotProductionDb("test-script"), /DATABASE_URL is required/);
});
