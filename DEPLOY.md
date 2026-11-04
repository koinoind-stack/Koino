deploy

# Test vs production data isolation (Phase 1 Fix 5)

## What happened

An E2E test record ("E2E Verification Church II") was found visible on the
production site. Investigation found no repo script that hardcodes production:
every DB script runs against whatever `DATABASE_URL` is exported in the shell.
Running E2E/content scripts (or hitting the production API with a real session)
while production credentials were exported is how test records reached the
production database.

## Rules that now apply

1. **Guarded write-scripts.** The scripts that create or modify records refuse
   to run when `DATABASE_URL` looks like production
   (`scripts/lib/db-guard.ts`, wired into `prisma/seed-trivia.ts`,
   `scripts/create-genesis-*-via-cms.ts`, `scripts/rebrand-db.ts`,
   `scripts/fix-production-readiness.ts`, `scripts/run-supabase-migration.ts`).
   Each run prints a `[db-guard] ... target: host=... db=...` banner — read it.
2. **Two detection inputs** (see `.env.example`): `PRODUCTION_DATABASE_URL`
   (exact match by host+database or Supabase project ref) and
   `NEXT_PUBLIC_SUPABASE_URL` (same project ref ⇒ production).
3. **Bypass is explicit and loud**: `ALLOW_PRODUCTION_DB=1` prints a warning
   line before continuing. Never set it in profiles/CI.
4. **E2E against the deployed site is forbidden.** Run E2E (`scripts/e2e-*.sh`)
   only against a LOCAL server (`npm run build` + standalone server with a
   placeholder `DATABASE_URL`) — the existing `scripts/e2e-back-nav-local.sh`
   pattern. Never point browser E2E at https://www.koino.in with a real
   session cookie.
5. **E2E records must identify themselves**: any test record created through a
   running app must be named with an unmistakable marker (e.g. `E2E <name>`)
   AND created against a dev/local database only.
6. **Destructive npm scripts stay out of CI and out of prod shells**:
   `db:push` / `db:push:force` (`--accept-data-loss`), `db:reset`, and raw
   `run-supabase-migration.ts` against production are manual, reviewed
   operations. The guard adds a tripwire; it does not replace review.

## Cleanup of existing production test records

The existing E2E records in production are NOT removed by this repository
change. Deleting production rows is a manual owner decision (admin panel or a
reviewed, explicitly-authorized script run with `ALLOW_PRODUCTION_DB=1`).
