-- Prayer Wall: real persistence for prayer requests, "I Prayed" counts,
-- comments/replies, answered-prayer status. All changes are ADDITIVE.
-- (Already executed manually in Supabase production on 2026-10-26.)

-- ─── PrayerRequest ─────────────────────────────────────────────────────────
CREATE TABLE "PrayerRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'visible',
    "answered" BOOLEAN NOT NULL DEFAULT false,
    "testimony" TEXT,
    "answeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PrayerRequest_pkey" PRIMARY KEY ("id")
);

-- ─── PrayerPrayer ("I Prayed") ─────────────────────────────────────────────
CREATE TABLE "PrayerPrayer" (
    "id" TEXT NOT NULL,
    "prayerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PrayerPrayer_pkey" PRIMARY KEY ("id")
);

-- ─── PrayerComment ─────────────────────────────────────────────────────────
CREATE TABLE "PrayerComment" (
    "id" TEXT NOT NULL,
    "prayerId" TEXT NOT NULL,
    "parentId" TEXT,
    "userId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'visible',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PrayerComment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PrayerRequest_status_createdAt_idx" ON "PrayerRequest"("status", "createdAt");
CREATE INDEX "PrayerRequest_userId_idx" ON "PrayerRequest"("userId");
CREATE INDEX "PrayerRequest_answered_status_createdAt_idx" ON "PrayerRequest"("answered", "status", "createdAt");

CREATE UNIQUE INDEX "PrayerPrayer_prayerId_userId_key" ON "PrayerPrayer"("prayerId", "userId");
CREATE INDEX "PrayerPrayer_userId_idx" ON "PrayerPrayer"("userId");

CREATE INDEX "PrayerComment_prayerId_createdAt_idx" ON "PrayerComment"("prayerId", "createdAt");
CREATE INDEX "PrayerComment_userId_idx" ON "PrayerComment"("userId");
CREATE INDEX "PrayerComment_parentId_idx" ON "PrayerComment"("parentId");

ALTER TABLE "PrayerRequest" ADD CONSTRAINT "PrayerRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PrayerPrayer" ADD CONSTRAINT "PrayerPrayer_prayerId_fkey" FOREIGN KEY ("prayerId") REFERENCES "PrayerRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PrayerPrayer" ADD CONSTRAINT "PrayerPrayer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PrayerComment" ADD CONSTRAINT "PrayerComment_prayerId_fkey" FOREIGN KEY ("prayerId") REFERENCES "PrayerRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PrayerComment" ADD CONSTRAINT "PrayerComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "PrayerComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PrayerComment" ADD CONSTRAINT "PrayerComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
