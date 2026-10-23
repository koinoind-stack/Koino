-- CreateTable
CREATE TABLE "Memorial" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "birthYear" INTEGER,
    "birthMonth" INTEGER,
    "birthDay" INTEGER,
    "deathYear" INTEGER,
    "deathMonth" INTEGER,
    "deathDay" INTEGER,
    "epitaph" TEXT,
    "biography" TEXT,
    "serviceInfo" TEXT,
    "photoUrl" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'public',
    "condolencePolicy" TEXT NOT NULL DEFAULT 'approved',
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Memorial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemorialManager" (
    "id" TEXT NOT NULL,
    "memorialId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "addedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemorialManager_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemorialCondolence" (
    "id" TEXT NOT NULL,
    "memorialId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemorialCondolence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Memorial_createdAt_idx" ON "Memorial"("createdAt");

-- CreateIndex
CREATE INDEX "Memorial_deathYear_idx" ON "Memorial"("deathYear");

-- CreateIndex
CREATE INDEX "Memorial_creatorId_idx" ON "Memorial"("creatorId");

-- CreateIndex
CREATE INDEX "MemorialManager_userId_idx" ON "MemorialManager"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MemorialManager_memorialId_userId_key" ON "MemorialManager"("memorialId", "userId");

-- CreateIndex
CREATE INDEX "MemorialCondolence_memorialId_status_createdAt_idx" ON "MemorialCondolence"("memorialId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "MemorialCondolence_authorId_idx" ON "MemorialCondolence"("authorId");

-- AddForeignKey
ALTER TABLE "Memorial" ADD CONSTRAINT "Memorial_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemorialManager" ADD CONSTRAINT "MemorialManager_memorialId_fkey" FOREIGN KEY ("memorialId") REFERENCES "Memorial"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemorialManager" ADD CONSTRAINT "MemorialManager_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemorialManager" ADD CONSTRAINT "MemorialManager_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemorialCondolence" ADD CONSTRAINT "MemorialCondolence_memorialId_fkey" FOREIGN KEY ("memorialId") REFERENCES "Memorial"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemorialCondolence" ADD CONSTRAINT "MemorialCondolence_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemorialCondolence" ADD CONSTRAINT "MemorialCondolence_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

