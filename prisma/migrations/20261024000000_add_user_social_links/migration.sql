-- Koino: User social/website links (profile "paste your links" feature)
-- Adds 5 nullable link columns to the "User" table.
-- Additive only: nullable columns, no data loss, no destructive change.
-- ⚠️ ALREADY APPLIED to production by hand (Supabase SQL Editor, user ran
--    koino-user-social-links.sql on 2026-10-24 — "Success. No rows returned").
--    This file keeps the repo's Prisma migration history in sync with the
--    live schema; `prisma migrate deploy` becomes a no-op for it.
-- Application code reading/writing these columns ships in the same round
-- (profile-links): /api/profile GET+PATCH, /api/social/users/[username],
-- EditProfileView, SocialProfileView.

ALTER TABLE "User" ADD COLUMN "website"   TEXT;
ALTER TABLE "User" ADD COLUMN "instagram" TEXT;
ALTER TABLE "User" ADD COLUMN "youtube"   TEXT;
ALTER TABLE "User" ADD COLUMN "facebook"  TEXT;
ALTER TABLE "User" ADD COLUMN "twitter"   TEXT;
