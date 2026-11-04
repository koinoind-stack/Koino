-- ─── COMIC BIBLE — SERVER-SIDE READING SYNC ──────────────────────────────────
-- Part 2 of the Comic Bible redesign: reading progress + story bookmarks that
-- survive devices and browsers for signed-in members, plus the optional kids
-- age band on stories.
--
-- DESIGN NOTES:
--   • One row per (user, story) on BOTH tables — enforced by unique indexes.
--     Every write path is an UPSERT, so duplicate progress/bookmark records
--     are impossible by construction (spec: "Avoid creating duplicate
--     progress records").
--   • ComicBookmark.pages holds a JSON array of bookmarked 1-based page
--     numbers — the same shape as the reader's existing localStorage store —
--     so the reader can merge/restore exact bookmarks across devices.
--   • Both tables cascade on user or story deletion; deleting a comic story
--     in the CMS automatically erases its per-user progress/bookmarks.
--   • Fully idempotent (IF NOT EXISTS) — safe to run on any environment that
--     already applied earlier comic migrations.

-- 1. Optional suggested age band for kids-friendly stories.
ALTER TABLE "ComicChapter" ADD COLUMN IF NOT EXISTS "kidsAgeGroup" TEXT;

-- 2. Server-side reading progress (mirrors cc_comic_progress for members).
CREATE TABLE IF NOT EXISTS "ComicReadingProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "comicChapterId" TEXT NOT NULL,
    "lastPanel" INTEGER NOT NULL DEFAULT 0,
    "totalPanels" INTEGER NOT NULL DEFAULT 0,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComicReadingProgress_pkey" PRIMARY KEY ("id")
);

-- 3. Server-side story bookmarks (mirrors cc_comic_bookmarks for members).
CREATE TABLE IF NOT EXISTS "ComicBookmark" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "comicChapterId" TEXT NOT NULL,
    "pages" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComicBookmark_pkey" PRIMARY KEY ("id")
);

-- Unique indexes: ONE progress row and ONE bookmark row per user per story.
CREATE UNIQUE INDEX IF NOT EXISTS "ComicReadingProgress_userId_comicChapterId_key"
  ON "ComicReadingProgress"("userId", "comicChapterId");
CREATE UNIQUE INDEX IF NOT EXISTS "ComicBookmark_userId_comicChapterId_key"
  ON "ComicBookmark"("userId", "comicChapterId");

-- Lookup indexes for the per-user reads the library/reader perform.
CREATE INDEX IF NOT EXISTS "ComicReadingProgress_userId_idx"
  ON "ComicReadingProgress"("userId");
CREATE INDEX IF NOT EXISTS "ComicReadingProgress_comicChapterId_idx"
  ON "ComicReadingProgress"("comicChapterId");
CREATE INDEX IF NOT EXISTS "ComicBookmark_userId_idx" ON "ComicBookmark"("userId");
CREATE INDEX IF NOT EXISTS "ComicBookmark_comicChapterId_idx" ON "ComicBookmark"("comicChapterId");

-- Foreign keys with cascade cleanup (user deleted → progress/bookmarks gone;
-- story deleted in the CMS → its per-user rows gone).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ComicReadingProgress_userId_fkey'
  ) THEN
    ALTER TABLE "ComicReadingProgress" ADD CONSTRAINT "ComicReadingProgress_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ComicReadingProgress_comicChapterId_fkey'
  ) THEN
    ALTER TABLE "ComicReadingProgress" ADD CONSTRAINT "ComicReadingProgress_comicChapterId_fkey"
      FOREIGN KEY ("comicChapterId") REFERENCES "ComicChapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ComicBookmark_userId_fkey'
  ) THEN
    ALTER TABLE "ComicBookmark" ADD CONSTRAINT "ComicBookmark_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ComicBookmark_comicChapterId_fkey'
  ) THEN
    ALTER TABLE "ComicBookmark" ADD CONSTRAINT "ComicBookmark_comicChapterId_fkey"
      FOREIGN KEY ("comicChapterId") REFERENCES "ComicChapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
