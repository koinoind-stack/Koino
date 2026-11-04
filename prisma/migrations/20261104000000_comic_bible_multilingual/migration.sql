-- ─── COMIC BIBLE MULTILINGUAL REDESIGN ──────────────────────────────────────
-- Extends the existing Comic Bible tables for the premium multilingual
-- Comic Bible experience:
--   1. ComicChapter: story-experience flags (kidsFriendly, pageMode)
--   2. ComicChapterTranslation: per-language publish status + localized story
--      sections (introduction / lesson / prayer) + structured key-verse ref
--   3. ComicPanelTranslation: per-language publish status
--
-- IMPORTANT COMPATIBILITY NOTE: the new "status" columns default to
-- 'published' so that every translation row that exists today remains
-- visible to readers after this migration. New translations created through
-- the admin CMS always pass an explicit status (draft | published), so the
-- default only affects legacy rows and non-CMS seeds — both of which are
-- content that is meant to be live.

-- 1. Story-experience flags on the chapter (story) itself.
ALTER TABLE "ComicChapter" ADD COLUMN IF NOT EXISTS "kidsFriendly" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ComicChapter" ADD COLUMN IF NOT EXISTS "pageMode" TEXT NOT NULL DEFAULT 'individual';

-- 2. Chapter (story) translations: status + localized story sections +
--    structured key-verse reference (text is fetched live from the existing
--    Bible translation system — never stored per language).
ALTER TABLE "ComicChapterTranslation" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'published';
ALTER TABLE "ComicChapterTranslation" ADD COLUMN IF NOT EXISTS "introduction" TEXT;
ALTER TABLE "ComicChapterTranslation" ADD COLUMN IF NOT EXISTS "lesson" TEXT;
ALTER TABLE "ComicChapterTranslation" ADD COLUMN IF NOT EXISTS "prayer" TEXT;
ALTER TABLE "ComicChapterTranslation" ADD COLUMN IF NOT EXISTS "keyVerseBook" TEXT;
ALTER TABLE "ComicChapterTranslation" ADD COLUMN IF NOT EXISTS "keyVerseChapter" INTEGER;
ALTER TABLE "ComicChapterTranslation" ADD COLUMN IF NOT EXISTS "keyVerseStart" INTEGER;
ALTER TABLE "ComicChapterTranslation" ADD COLUMN IF NOT EXISTS "keyVerseEnd" INTEGER;

-- 3. Panel translations: status.
ALTER TABLE "ComicPanelTranslation" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'published';

-- Index for the per-language status filter used by the public read APIs.
CREATE INDEX IF NOT EXISTS "ComicChapterTranslation_status_idx" ON "ComicChapterTranslation"("status");
CREATE INDEX IF NOT EXISTS "ComicPanelTranslation_status_idx" ON "ComicPanelTranslation"("status");
