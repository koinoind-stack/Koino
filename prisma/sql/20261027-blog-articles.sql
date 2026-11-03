-- ─────────────────────────────────────────────────────────────────────────────
-- HISTORICAL REFERENCE FILE — DO NOT EXECUTE (Plan v2 defect 18 annotation).
-- Name misnomer: despite the "20261027-blog-articles.sql" filename, this file
-- ONLY covers the Task 73 BlogPost workflow columns + Post.articleId wrapper
-- FK — not the wider 20261027 batch it was once grouped with. It has already
-- been applied to production via the tracked Prisma migration for Task 73;
-- it is kept verbatim as an audit trail. DO NOT rename (external references)
-- and DO NOT re-run (the UPDATE below is not idempotent-safe against later
-- workflow edits).
-- Current schema of record: prisma/schema.prisma. Phase 2 taxonomy migration:
-- prisma/migrations/20261103000000_unified_taxonomy/migration.sql.
-- ─────────────────────────────────────────────────────────────────────────────

-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "articleId" TEXT;

-- AlterTable
ALTER TABLE "BlogPost" ADD COLUMN     "authorId" TEXT,
ADD COLUMN     "publishedById" TEXT,
ADD COLUMN     "readingMinutes" INTEGER,
ADD COLUMN     "reviewNotes" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedById" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'draft',
ADD COLUMN     "submittedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Post_articleId_key" ON "Post"("articleId");

-- CreateIndex
CREATE INDEX "BlogPost_status_submittedAt_idx" ON "BlogPost"("status", "submittedAt");

-- CreateIndex
CREATE INDEX "BlogPost_authorId_updatedAt_idx" ON "BlogPost"("authorId", "updatedAt");

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "BlogPost"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlogPost" ADD CONSTRAINT "BlogPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlogPost" ADD CONSTRAINT "BlogPost_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlogPost" ADD CONSTRAINT "BlogPost_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Backfill: sync new `status` column with the legacy `published` boolean so
-- pre-existing admin-CMS rows keep their public visibility semantics.
UPDATE "BlogPost" SET "status" = CASE WHEN "published" THEN 'published' ELSE 'draft' END;
