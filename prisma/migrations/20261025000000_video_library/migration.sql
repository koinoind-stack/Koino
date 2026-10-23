-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "videoId" TEXT;

-- CreateTable
CREATE TABLE "Video" (
    "id"                TEXT NOT NULL,
    "slug"              TEXT NOT NULL,
    "title"             TEXT NOT NULL,
    "summary"           TEXT,
    "description"       TEXT,
    "source"            TEXT NOT NULL DEFAULT 'youtube',
    "youtubeId"         TEXT,
    "canonicalUrl"      TEXT,
    "thumbnailUrl"      TEXT,
    "durationSec"       INTEGER,
    "category"          TEXT NOT NULL,
    "language"          TEXT NOT NULL DEFAULT 'en',
    "subtitleLanguages" TEXT NOT NULL DEFAULT '[]',
    "dubLanguages"      TEXT NOT NULL DEFAULT '[]',
    "originalLanguage"  TEXT,
    "contentWarning"    TEXT,
    "status"            TEXT NOT NULL DEFAULT 'draft',
    "featured"          BOOLEAN NOT NULL DEFAULT false,
    "embeddable"        BOOLEAN NOT NULL DEFAULT true,
    "sourceName"        TEXT,
    "rightsNote"        TEXT,
    "viewCount"         INTEGER NOT NULL DEFAULT 0,
    "createdById"       TEXT,
    "publishedAt"       TIMESTAMP(3),
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Video_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Video_slug_key" ON "Video"("slug");

-- CreateIndex
CREATE INDEX "Video_status_category_createdAt_idx" ON "Video"("status", "category", "createdAt");

-- CreateIndex
CREATE INDEX "Video_status_featured_createdAt_idx" ON "Video"("status", "featured", "createdAt");

-- CreateIndex
CREATE INDEX "Video_status_language_idx" ON "Video"("status", "language");

-- CreateIndex
CREATE INDEX "Video_status_createdAt_idx" ON "Video"("status", "createdAt");

-- CreateTable
CREATE TABLE "VideoBibleRef" (
    "id"           TEXT NOT NULL,
    "videoId"      TEXT NOT NULL,
    "bookId"       TEXT NOT NULL,
    "chapterStart" INTEGER NOT NULL,
    "verseStart"   INTEGER,
    "chapterEnd"   INTEGER,
    "verseEnd"     INTEGER,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VideoBibleRef_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VideoBibleRef_bookId_chapterStart_idx" ON "VideoBibleRef"("bookId", "chapterStart");

-- CreateIndex
CREATE INDEX "VideoBibleRef_videoId_idx" ON "VideoBibleRef"("videoId");

-- CreateTable
CREATE TABLE "VideoProgress" (
    "id"          TEXT NOT NULL,
    "userId"      TEXT NOT NULL,
    "videoId"     TEXT NOT NULL,
    "positionSec" INTEGER NOT NULL DEFAULT 0,
    "completed"   BOOLEAN NOT NULL DEFAULT false,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VideoProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VideoProgress_userId_videoId_key" ON "VideoProgress"("userId", "videoId");

-- CreateIndex
CREATE INDEX "VideoProgress_userId_updatedAt_idx" ON "VideoProgress"("userId", "updatedAt");

-- CreateTable
CREATE TABLE "VideoSave" (
    "id"        TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "videoId"   TEXT NOT NULL,
    "list"      TEXT NOT NULL DEFAULT 'watch_later',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VideoSave_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VideoSave_userId_videoId_list_key" ON "VideoSave"("userId", "videoId", "list");

-- CreateIndex
CREATE INDEX "VideoSave_userId_list_createdAt_idx" ON "VideoSave"("userId", "list", "createdAt");

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT     "Post_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoBibleRef" ADD CONSTRAINT "VideoBibleRef_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoProgress" ADD CONSTRAINT "VideoProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoProgress" ADD CONSTRAINT "VideoProgress_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoSave" ADD CONSTRAINT "VideoSave_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoSave" ADD CONSTRAINT "VideoSave_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;
