-- ─────────────────────────────────────────────────────────────────────────
-- Koino Round 2: Groups & Fellowship
-- Idempotent — safe to run more than once (IF NOT EXISTS everywhere).
-- Additive only: existing tables/data are never modified or dropped.
-- Paste the whole file into: Supabase Dashboard → SQL Editor → Run
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "Group" (
    "id"            TEXT NOT NULL,
    "name"          TEXT NOT NULL,
    "description"   TEXT,
    "category"      TEXT NOT NULL DEFAULT 'fellowship',
    "visibility"    TEXT NOT NULL DEFAULT 'public',
    "coverGradient" INTEGER NOT NULL DEFAULT 0,
    "createdById"   TEXT NOT NULL,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
    ALTER TABLE "Group" ADD CONSTRAINT "Group_createdById_fkey"
        FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "Group_category_idx"  ON "Group"("category");
CREATE INDEX IF NOT EXISTS "Group_createdAt_idx" ON "Group"("createdAt");

CREATE TABLE IF NOT EXISTS "GroupMember" (
    "id"        TEXT NOT NULL,
    "groupId"   TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "role"      TEXT NOT NULL DEFAULT 'member',
    "status"    TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupMember_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
    ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_groupId_fkey"
        FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "GroupMember_groupId_userId_key"
    ON "GroupMember"("groupId", "userId");
CREATE INDEX IF NOT EXISTS "GroupMember_userId_idx" ON "GroupMember"("userId");

-- Group-scoped posts (existing posts keep groupId = NULL, untouched)
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "groupId" TEXT;

DO $$ BEGIN
    ALTER TABLE "Post" ADD CONSTRAINT "Post_groupId_fkey"
        FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "Post_groupId_createdAt_idx" ON "Post"("groupId", "createdAt");

-- ─────────────────────────────────────────────────────────────────────────
-- VERIFICATION — read the two results after running:
--   groups_check should say: groups ready
--   social_check   should say: ok: Post table present
--   (if it says MISSING, tell Z.ai before using the social features)
-- ─────────────────────────────────────────────────────────────────────────
SELECT CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'Group'
) THEN 'groups ready' ELSE 'FAILED' END AS groups_check;

SELECT CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'Post'
) THEN 'ok: Post table present' ELSE 'MISSING: Post table (social platform SQL was never run — report this)' END AS social_check;
