-- In Loving Memory → complete memorial platform. ADDITIVE ONLY.
-- (No existing rows are modified; all existing memorials keep their status.)

-- 1) Memorial: faith testimony, family-chosen section visibility, review workflow
ALTER TABLE "Memorial" ADD COLUMN "testimony" TEXT;
ALTER TABLE "Memorial" ADD COLUMN "display" TEXT NOT NULL DEFAULT '{"photos":true,"videos":true,"tributes":true,"verse":true,"family":true,"candles":true}';
ALTER TABLE "Memorial" ADD COLUMN "rejectionReason" TEXT;
ALTER TABLE "Memorial" ADD COLUMN "moderatedAt" TIMESTAMP(3);

-- 2) MemorialCondolence: 1-level replies
ALTER TABLE "MemorialCondolence" ADD COLUMN "parentId" TEXT;
CREATE INDEX "MemorialCondolence_parentId_idx" ON "MemorialCondolence"("parentId");
ALTER TABLE "MemorialCondolence" ADD CONSTRAINT "MemorialCondolence_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "MemorialCondolence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 3) Tribute hearts — one per member per tribute (DB-enforced genuine counts)
CREATE TABLE "MemorialCondolenceHeart" (
    "id" TEXT NOT NULL,
    "condolenceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemorialCondolenceHeart_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MemorialCondolenceHeart_condolenceId_userId_key" ON "MemorialCondolenceHeart"("condolenceId", "userId");
CREATE INDEX "MemorialCondolenceHeart_condolenceId_idx" ON "MemorialCondolenceHeart"("condolenceId");
ALTER TABLE "MemorialCondolenceHeart" ADD CONSTRAINT "MemorialCondolenceHeart_condolenceId_fkey" FOREIGN KEY ("condolenceId") REFERENCES "MemorialCondolence"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MemorialCondolenceHeart" ADD CONSTRAINT "MemorialCondolenceHeart_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 4) Candles — one per member per memorial (DB-enforced genuine counts)
CREATE TABLE "MemorialCandle" (
    "id" TEXT NOT NULL,
    "memorialId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemorialCandle_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MemorialCandle_memorialId_userId_key" ON "MemorialCandle"("memorialId", "userId");
CREATE INDEX "MemorialCandle_memorialId_idx" ON "MemorialCandle"("memorialId");
ALTER TABLE "MemorialCandle" ADD CONSTRAINT "MemorialCandle_memorialId_fkey" FOREIGN KEY ("memorialId") REFERENCES "Memorial"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MemorialCandle" ADD CONSTRAINT "MemorialCandle_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 5) Memorial YouTube videos — pending until admin-approved; never rehosted
CREATE TABLE "MemorialVideo" (
    "id" TEXT NOT NULL,
    "memorialId" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'other',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "rejectionReason" TEXT,
    "addedById" TEXT NOT NULL,
    "addedByName" TEXT NOT NULL,
    "moderatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemorialVideo_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "MemorialVideo_memorialId_status_idx" ON "MemorialVideo"("memorialId", "status");
CREATE INDEX "MemorialVideo_status_createdAt_idx" ON "MemorialVideo"("status", "createdAt");
ALTER TABLE "MemorialVideo" ADD CONSTRAINT "MemorialVideo_memorialId_fkey" FOREIGN KEY ("memorialId") REFERENCES "Memorial"("id") ON DELETE CASCADE ON UPDATE CASCADE;
