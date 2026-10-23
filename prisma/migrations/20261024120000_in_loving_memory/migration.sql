-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "memorialId" TEXT;

-- CreateTable
CREATE TABLE "Memorial" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "photoUrl" TEXT,
    "gallery" TEXT NOT NULL DEFAULT '[]',
    "dob" TIMESTAMP(3),
    "dod" TIMESTAMP(3),
    "city" TEXT,
    "state" TEXT,
    "tribute" TEXT,
    "lifeStory" TEXT,
    "milestones" TEXT,
    "qualities" TEXT,
    "verse" TEXT,
    "verseRef" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'public',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "creatorId" TEXT NOT NULL,
    "creatorName" TEXT NOT NULL,
    "creatorRelation" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Memorial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemorialManager" (
    "id" TEXT NOT NULL,
    "memorialId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'manager',
    "addedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemorialManager_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemorialCondolence" (
    "id" TEXT NOT NULL,
    "memorialId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'condolence',
    "body" TEXT NOT NULL,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemorialCondolence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Memorial_status_visibility_createdAt_idx" ON "Memorial"("status", "visibility", "createdAt");

-- CreateIndex
CREATE INDEX "Memorial_state_city_idx" ON "Memorial"("state", "city");

-- CreateIndex
CREATE INDEX "Memorial_fullName_idx" ON "Memorial"("fullName");

-- CreateIndex
CREATE INDEX "MemorialManager_userId_idx" ON "MemorialManager"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MemorialManager_memorialId_userId_key" ON "MemorialManager"("memorialId", "userId");

-- CreateIndex
CREATE INDEX "MemorialCondolence_memorialId_createdAt_idx" ON "MemorialCondolence"("memorialId", "createdAt");

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_memorialId_fkey" FOREIGN KEY ("memorialId") REFERENCES "Memorial"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Memorial" ADD CONSTRAINT "Memorial_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemorialManager" ADD CONSTRAINT "MemorialManager_memorialId_fkey" FOREIGN KEY ("memorialId") REFERENCES "Memorial"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemorialManager" ADD CONSTRAINT "MemorialManager_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemorialCondolence" ADD CONSTRAINT "MemorialCondolence_memorialId_fkey" FOREIGN KEY ("memorialId") REFERENCES "Memorial"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemorialCondolence" ADD CONSTRAINT "MemorialCondolence_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

