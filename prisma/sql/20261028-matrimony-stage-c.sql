-- ═══════════════════════════════════════════════════════════════════════════
--  KOINO MATRIMONY — STAGE C (Discovery / Search) — 2026-10-28
-- ═══════════════════════════════════════════════════════════════════════════
--
--  WHAT THIS DOES
--    Adds ONE covering index that serves the discovery feed ordering.
--    GET /api/matrimony/discover filters status='active' and keyset-paginates
--    by (updatedAt DESC, id DESC). This index lets Postgres walk that exact
--    order directly instead of sorting the filtered set on every request.
--
--  SAFETY
--    - Idempotent: IF NOT EXISTS — safe to run twice (e.g. if an earlier
--      version of this file was already executed, re-running is a no-op).
--    - Zero data changes: no tables created, no rows read/updated/deleted,
--      no schema changes beyond this one index. Nothing destructive exists
--      in this file.
--    - Online-safe: a plain CREATE INDEX takes a brief ShareLock on writes
--      to this small table; it completes in well under a second at current
--      scale. (Use the CONCURRENTLY variant below ONLY if you prefer zero
--      write-blocking — it cannot run inside a transaction wrapper.)
--
--  ROLLBACK (if ever needed — harmless to keep):
--    DROP INDEX IF EXISTS "MatrimonyProfile_discovery_keyset_idx";
-- ═══════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS "MatrimonyProfile_discovery_keyset_idx"
  ON "MatrimonyProfile" ("status", "updatedAt" DESC, "id" DESC);

-- ─── Verification (optional — run after, should list the index above) ──────
-- SELECT indexname, indexdef
--   FROM pg_indexes
--  WHERE tablename = 'MatrimonyProfile'
--  ORDER BY indexname;
--
-- Expected rows:
--   MatrimonyProfile_status_idx              (from Stage B DDL — @@index([status]))
--   MatrimonyProfile_discovery_keyset_idx    (this file)
--   MatrimonyProfile_userId_key              (from @unique)
--   MatrimonyProfile_pkey
