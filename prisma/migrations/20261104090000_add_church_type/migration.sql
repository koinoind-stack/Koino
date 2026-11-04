-- Church listing "type" — what kind of directory entry this is.
-- Fixed set: "Church" | "Ministry" | "Fellowship" | "Prayer Hall" | "Other"
--
-- Additive and idempotent — safe to run manually in the Supabase SQL Editor:
--   Dashboard → SQL Editor → paste this file → Run.
-- (Or: npx prisma migrate deploy with the production DATABASE_URL.)
ALTER TABLE "Church" ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'Church';
