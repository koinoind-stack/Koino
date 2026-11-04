-- Task 49 (Koino Upgrade Part 1): Edit Profile
-- Adds profile-editing fields to the User table.
-- ⚠️ REQUIRES USER APPROVAL before running against production.
--    Run with: npx prisma migrate deploy   (at deploy time, together with
--    the Task 49 application code — the /api/profile endpoints read these
--    columns and will fail if the migration has not been applied.)
-- Additive only: two nullable columns, no data loss, no destructive change.

ALTER TABLE "User" ADD COLUMN "bio" TEXT;
ALTER TABLE "User" ADD COLUMN "usernameChangedAt" TIMESTAMP(3);
