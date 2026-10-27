-- Task 74 — Koino Matrimony Stage B
-- ⚠️ REQUIRES USER APPROVAL before running against production.
--    Run in Supabase SQL Editor (or `npx prisma migrate deploy` at deploy
--    time) together with the Stage B application code — the /api/matrimony/*
--    endpoints read/write these tables and will fail if not applied.
--
-- ADDITIVE ONLY: three new tables + indexes + FKs. No existing table is
-- altered, no data is touched, fully reversible by dropping the 3 tables.
-- MatrimonyProfile.userId has an ON DELETE CASCADE FK to User(id): deleting
-- a Koino account removes its matrimony profile + photos metadata (storage
-- objects are cleaned by application code).

-- CreateTable
CREATE TABLE "MatrimonyProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "languages" TEXT NOT NULL DEFAULT '[]',
    "intention" TEXT,
    "timeline" TEXT,
    "denomination" TEXT,
    "education" TEXT,
    "profession" TEXT,
    "aboutMe" TEXT,
    "heightCm" INTEGER,
    "photoVisibility" TEXT NOT NULL DEFAULT 'CONNECTIONS_ONLY',
    "restrictedReason" TEXT,
    "activatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatrimonyProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatrimonyPhoto" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ready',
    "position" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "sizeBytes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatrimonyPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatrimonyAuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorRole" TEXT,
    "action" TEXT NOT NULL,
    "targetUserId" TEXT,
    "targetType" TEXT,
    "targetId" TEXT,
    "outcome" TEXT,
    "justification" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatrimonyAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MatrimonyProfile_userId_key" ON "MatrimonyProfile"("userId");

-- CreateIndex
CREATE INDEX "MatrimonyProfile_status_idx" ON "MatrimonyProfile"("status");

-- CreateIndex
CREATE UNIQUE INDEX "MatrimonyPhoto_storagePath_key" ON "MatrimonyPhoto"("storagePath");

-- CreateIndex
CREATE UNIQUE INDEX "MatrimonyPhoto_profileId_position_key" ON "MatrimonyPhoto"("profileId", "position");

-- CreateIndex
CREATE INDEX "MatrimonyPhoto_profileId_idx" ON "MatrimonyPhoto"("profileId");

-- CreateIndex
CREATE INDEX "MatrimonyAuditLog_action_createdAt_idx" ON "MatrimonyAuditLog"("action", "createdAt");

-- CreateIndex
CREATE INDEX "MatrimonyAuditLog_targetUserId_createdAt_idx" ON "MatrimonyAuditLog"("targetUserId", "createdAt");

-- AddForeignKey
ALTER TABLE "MatrimonyProfile" ADD CONSTRAINT "MatrimonyProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatrimonyPhoto" ADD CONSTRAINT "MatrimonyPhoto_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "MatrimonyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatrimonyAuditLog" ADD CONSTRAINT "MatrimonyAuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
