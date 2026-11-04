-- Community role (self-reported, optional) — Koino
-- Applied to production BY HAND in the Supabase SQL editor (Koino deploys
-- do not run `prisma migrate deploy`). Keep in sync with prisma/schema.prisma
-- and src/lib/community-roles.ts.
--
-- communityRole        : one of the stable values in src/lib/community-roles.ts
-- communityRoleOther   : free-text description when communityRole = 'other' (<= 60 chars)
-- communityRoleVisible : gates PUBLIC profile display only (admins can always filter)

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "communityRole" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "communityRoleOther" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "communityRoleVisible" BOOLEAN NOT NULL DEFAULT true;
