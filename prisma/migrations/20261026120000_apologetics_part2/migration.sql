-- Apologetics PART 2: admin CMS, Bible references, contributor workflow,
-- Q&A↔article linking, threaded comments, reactions, bookmarks, notifications.
-- All changes are ADDITIVE — no existing column is dropped or rewritten.

-- ─── KoinoArticle ──────────────────────────────────────────────────────────
ALTER TABLE "KoinoArticle" ADD COLUMN "tags" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "KoinoArticle" ADD COLUMN "sourceQuestionId" TEXT;

-- ─── UserQuestion ──────────────────────────────────────────────────────────
ALTER TABLE "UserQuestion" ADD COLUMN "bibleRefs" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "UserQuestion" ADD COLUMN "answeredByName" TEXT;
ALTER TABLE "UserQuestion" ADD COLUMN "answeredByUserId" TEXT;
ALTER TABLE "UserQuestion" ADD COLUMN "contributorAnswer" TEXT;
ALTER TABLE "UserQuestion" ADD COLUMN "contributorAnswerName" TEXT;
ALTER TABLE "UserQuestion" ADD COLUMN "contributorAnswerUserId" TEXT;
ALTER TABLE "UserQuestion" ADD COLUMN "contributorAnswerStatus" TEXT;

-- ─── Notification (generic target for non-post notifications) ──────────────
ALTER TABLE "Notification" ADD COLUMN "targetType" TEXT;
ALTER TABLE "Notification" ADD COLUMN "targetId" TEXT;
ALTER TABLE "Notification" ADD COLUMN "href" TEXT;

CREATE INDEX "KoinoArticle_sourceQuestionId_idx" ON "KoinoArticle"("sourceQuestionId");

-- ─── ApologeticsComment (threaded comments on articles + questions) ────────
CREATE TABLE "ApologeticsComment" (
    "id" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "parentId" TEXT,
    "authorUserId" TEXT,
    "authorName" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'visible',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApologeticsComment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ApologeticsReaction" (
    "id" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApologeticsReaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ApologeticsBookmark" (
    "id" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApologeticsBookmark_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ApologeticsComment_targetType_targetId_createdAt_idx" ON "ApologeticsComment"("targetType", "targetId", "createdAt");
CREATE INDEX "ApologeticsComment_parentId_idx" ON "ApologeticsComment"("parentId");
CREATE INDEX "ApologeticsComment_authorUserId_idx" ON "ApologeticsComment"("authorUserId");

CREATE UNIQUE INDEX "ApologeticsReaction_targetType_targetId_userId_kind_key" ON "ApologeticsReaction"("targetType", "targetId", "userId", "kind");
CREATE INDEX "ApologeticsReaction_targetType_targetId_idx" ON "ApologeticsReaction"("targetType", "targetId");
CREATE INDEX "ApologeticsReaction_userId_idx" ON "ApologeticsReaction"("userId");

CREATE UNIQUE INDEX "ApologeticsBookmark_userId_targetType_targetId_key" ON "ApologeticsBookmark"("userId", "targetType", "targetId");
CREATE INDEX "ApologeticsBookmark_userId_idx" ON "ApologeticsBookmark"("userId");

ALTER TABLE "ApologeticsComment"
  ADD CONSTRAINT "ApologeticsComment_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "ApologeticsComment"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ApologeticsComment"
  ADD CONSTRAINT "ApologeticsComment_authorUserId_fkey"
  FOREIGN KEY ("authorUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ApologeticsReaction"
  ADD CONSTRAINT "ApologeticsReaction_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ApologeticsBookmark"
  ADD CONSTRAINT "ApologeticsBookmark_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
