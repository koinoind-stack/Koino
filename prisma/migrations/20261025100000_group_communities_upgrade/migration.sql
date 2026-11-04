-- ─── GROUP COMMUNITIES UPGRADE (Task 117) ───────────────────────────────────
-- Additive-only. Applied to production via Supabase SQL Editor (the repo's
-- migrations folder is SQLite-locked; `prisma migrate deploy` must NEVER be
-- run against the Postgres database — see worklog Task 36 notes).
-- Every statement is idempotent so re-running is harmless.

-- ── Group: new community columns ────────────────────────────────────────────
ALTER TABLE "Group" ADD COLUMN IF NOT EXISTS "coverImage" TEXT;
ALTER TABLE "Group" ADD COLUMN IF NOT EXISTS "logoUrl" TEXT;
ALTER TABLE "Group" ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE "Group" ADD COLUMN IF NOT EXISTS "state" TEXT;
ALTER TABLE "Group" ADD COLUMN IF NOT EXISTS "language" TEXT;
ALTER TABLE "Group" ADD COLUMN IF NOT EXISTS "joinMode" TEXT NOT NULL DEFAULT 'open';
ALTER TABLE "Group" ADD COLUMN IF NOT EXISTS "memberPostPermission" TEXT NOT NULL DEFAULT 'members';
ALTER TABLE "Group" ADD COLUMN IF NOT EXISTS "rules" TEXT;
ALTER TABLE "Group" ADD COLUMN IF NOT EXISTS "pinnedPostId" TEXT;
ALTER TABLE "Group" ADD COLUMN IF NOT EXISTS "churchId" TEXT;
ALTER TABLE "Group" ADD COLUMN IF NOT EXISTS "churchName" TEXT;
ALTER TABLE "Group" ADD COLUMN IF NOT EXISTS "churchVerified" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "Group_churchId_idx" ON "Group"("churchId");

-- Church affiliation: display-only link. Deleting the church detaches the
-- link (SET NULL) — group data is never cascaded away.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Group_churchId_fkey'
  ) THEN
    ALTER TABLE "Group" ADD CONSTRAINT "Group_churchId_fkey"
      FOREIGN KEY ("churchId") REFERENCES "Church"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- ── Event: group events reuse the existing events table ────────────────────
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "groupId" TEXT;
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "groupVisibility" TEXT NOT NULL DEFAULT 'public';

CREATE INDEX IF NOT EXISTS "Event_groupId_idx" ON "Event"("groupId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Event_groupId_fkey'
  ) THEN
    ALTER TABLE "Event" ADD CONSTRAINT "Event_groupId_fkey"
      FOREIGN KEY ("groupId") REFERENCES "Group"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
