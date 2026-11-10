-- Articles & Knowledge — Phase 2: Unified taxonomy & content-type foundations.
-- Plan v2 §5.3 / Tables 2–7. ADDITIVE ONLY:
--   * Four new tables: Category, Topic, ArticleTopic, SlugRedirect.
--   * Additive nullable columns on KoinoArticle (+ one defaulted column) and
--     one additive nullable column on Post.
--   * NO drops, NO type changes, NO data rewrites. Existing BlogPost /
--     KoinoArticle rows, ids, authors and engagement are untouched; the
--     Phase 3 migration (separate, approval-gated) populates the new columns.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) Category — DB-managed editorial sections (Plan v2 §2.3). Seeded by
--    prisma/scripts/seed-taxonomy.ts with the six canonical sections.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "iconKey" TEXT,
    "imageUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");
CREATE INDEX "Category_isActive_sortOrder_idx" ON "Category"("isActive", "sortOrder");

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) Topic — DB-managed subjects; legacyKey preserves the six existing SPA
--    topic ids exactly (gods_existence, problem_of_evil, resurrection,
--    bible_reliability, science_faith, world_religions) so UserQuestion
--    category values and deep links keep working untouched (Plan v2 §2.4).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE "Topic" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "legacyKey" TEXT,
    "parentCategoryId" TEXT NOT NULL,
    "description" TEXT,
    "iconKey" TEXT,
    "imageUrl" TEXT,
    "color" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Topic_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Topic_slug_key" ON "Topic"("slug");
CREATE UNIQUE INDEX "Topic_legacyKey_key" ON "Topic"("legacyKey");
CREATE INDEX "Topic_parentCategoryId_idx" ON "Topic"("parentCategoryId");
CREATE INDEX "Topic_isActive_sortOrder_idx" ON "Topic"("isActive", "sortOrder");
-- Restrict: a category that still has topics cannot be hard-deleted — admins
-- move or deactivate topics first (soft deactivation is the default path).
ALTER TABLE "Topic" ADD CONSTRAINT "Topic_parentCategoryId_fkey" FOREIGN KEY ("parentCategoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) ArticleTopic — many-to-many article ↔ topic join (Plan v2 §2.4). Both
--    sides CASCADE: removing an article or topic removes only the association.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE "ArticleTopic" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArticleTopic_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ArticleTopic_articleId_topicId_key" ON "ArticleTopic"("articleId", "topicId");
CREATE INDEX "ArticleTopic_topicId_idx" ON "ArticleTopic"("topicId");
ALTER TABLE "ArticleTopic" ADD CONSTRAINT "ArticleTopic_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "KoinoArticle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ArticleTopic" ADD CONSTRAINT "ArticleTopic_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4) SlugRedirect — 301 map for slug collisions found by the Phase 3 scan
--    (Plan v2 Table 7). Empty until then.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE "SlugRedirect" (
    "id" TEXT NOT NULL,
    "fromSlug" TEXT NOT NULL,
    "toSlug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlugRedirect_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SlugRedirect_fromSlug_key" ON "SlugRedirect"("fromSlug");
CREATE INDEX "SlugRedirect_toSlug_idx" ON "SlugRedirect"("toSlug");

-- ─────────────────────────────────────────────────────────────────────────────
-- 5) KoinoArticle — additive unified-model columns (Plan v2 Table 7). All
--    nullable except `language` (defaulted, so existing rows read as "en").
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE "KoinoArticle" ADD COLUMN     "authorUserId" TEXT;
ALTER TABLE "KoinoArticle" ADD COLUMN     "readingMinutes" INTEGER;
ALTER TABLE "KoinoArticle" ADD COLUMN     "language" TEXT NOT NULL DEFAULT 'en';
ALTER TABLE "KoinoArticle" ADD COLUMN     "categoryId" TEXT;
ALTER TABLE "KoinoArticle" ADD COLUMN     "legacyBlogPostId" TEXT;

CREATE UNIQUE INDEX "KoinoArticle_legacyBlogPostId_key" ON "KoinoArticle"("legacyBlogPostId");
CREATE INDEX "KoinoArticle_categoryId_idx" ON "KoinoArticle"("categoryId");
CREATE INDEX "KoinoArticle_authorUserId_idx" ON "KoinoArticle"("authorUserId");
ALTER TABLE "KoinoArticle" ADD CONSTRAINT "KoinoArticle_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "KoinoArticle" ADD CONSTRAINT "KoinoArticle_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6) Post — second feed-wrapper FK pointing at the unified model (Plan v2
--    Table 7). Populated by Phase 3; legacy "articleId" retained in parallel
--    until the optional Phase 9.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE "Post" ADD COLUMN     "unifiedArticleId" TEXT;

CREATE UNIQUE INDEX "Post_unifiedArticleId_key" ON "Post"("unifiedArticleId");
ALTER TABLE "Post" ADD CONSTRAINT "Post_unifiedArticleId_fkey" FOREIGN KEY ("unifiedArticleId") REFERENCES "KoinoArticle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
