/**
 * ─── BLOG & ARTICLES — SINGLE SOURCE OF TRUTH (Task 73) ────────────────────
 *
 * Categories, workflow statuses, validation, slug + reading-time helpers.
 * Client-safe: no secrets, no DB imports. Server-only helpers (slug
 * uniqueness, serialization, feed wrapper sync, notifications) live in
 * src/lib/blog-server.ts.
 *
 * Reuses the existing BlogPost model (public /blog, sitemap, /api/blog/latest
 * and share-card kind=blog already speak it). Content is MARKDOWN rendered
 * through the existing MarkdownRenderer (react-markdown + safeUrl) — raw HTML
 * is never rendered, so stored-XSS is structurally prevented without adding a
 * sanitizer dependency.
 */

// ─── Categories ─────────────────────────────────────────────────────────────
export const BLOG_CATEGORIES = [
  "Bible Study",
  "Devotionals",
  "Testimonies",
  "Christian Living",
  "Apologetics",
  "Church & Ministry",
  "Christian News & Community",
  "Prayer & Encouragement",
] as const;

export type BlogCategory = (typeof BLOG_CATEGORIES)[number];

export function isBlogCategory(value: string): value is BlogCategory {
  return (BLOG_CATEGORIES as readonly string[]).includes(value);
}

// ─── Workflow statuses ──────────────────────────────────────────────────────
// draft | pending | changes_requested | published | rejected | archived
export const ARTICLE_STATUSES = [
  "draft",
  "pending",
  "changes_requested",
  "published",
  "rejected",
  "archived",
] as const;

export type ArticleStatus = (typeof ARTICLE_STATUSES)[number];

export function isArticleStatus(value: string): value is ArticleStatus {
  return (ARTICLE_STATUSES as readonly string[]).includes(value);
}

export const ARTICLE_STATUS_LABELS: Record<ArticleStatus, string> = {
  draft: "Draft",
  pending: "Pending Review",
  changes_requested: "Changes Requested",
  published: "Published",
  rejected: "Rejected",
  archived: "Archived",
};

/** Statuses from which the AUTHOR may submit for review. */
export const SUBMITTABLE_FROM: ArticleStatus[] = [
  "draft",
  "changes_requested",
  "rejected",
];

/** Statuses in which the AUTHOR may still edit their own article. */
export const AUTHOR_EDITABLE: ArticleStatus[] = [
  "draft",
  "changes_requested",
  "rejected",
];

// ─── Reading time ───────────────────────────────────────────────────────────
export const READING_WPM = 200;

/** Strip markdown syntax, count words, convert to minutes (min 1). */
export function estimateReadingMinutes(markdown: string): number {
  if (!markdown) return 1;
  const plain = markdown
    // images/links: keep the label text only
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    // headings / emphasis / blockquote markers / list bullets / hr / code
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/(\*\*|__|\*|_|`)/g, "")
    .replace(/^>\s?/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/^(-{3,}|\*{3,})\s*$/gm, " ")
    // inline images referenced as bare URLs don't add reading value
    .replace(/https?:\/\/\S+/g, " ");
  const words = plain.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / READING_WPM));
}

// ─── Slugs ──────────────────────────────────────────────────────────────────
/** Deterministic, URL-safe slug. Max 80 chars. Empty input → "article". */
export function slugifyTitle(raw: string): string {
  const base = (raw || "")
    .toLowerCase()
    .trim()
    .replace(/['"’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80)
    .replace(/-$/g, "");
  return base || "article";
}

// ─── Public visibility gate (defense in depth — applied everywhere) ────────
export type VisibilityPost = {
  published: boolean;
  status: string;
  publishedAt: Date | null;
};

/**
 * A post is publicly visible only when ALL of these hold:
 *   1. legacy boolean gate (existing pages/APIs depend on it)
 *   2. workflow status === "published"
 *   3. publishedAt is null or in the past
 * Every public surface (blog page, article page, sitemap, feed wrapper,
 * related-post queries, search) must use this — never trust one field alone.
 */
export function isPubliclyVisible(
  post: VisibilityPost,
  now: Date = new Date()
): boolean {
  if (!post.published) return false;
  if (post.status !== "published") return false;
  if (post.publishedAt && post.publishedAt.getTime() > now.getTime()) return false;
  return true;
}

// ─── Validation (zod) ───────────────────────────────────────────────────────
export const BLOG_LIMITS = {
  titleMax: 200,
  titleMin: 3,
  excerptMax: 500,
  contentMax: 200_000,
  contentMin: 1,
  tagMax: 8,
  tagLengthMax: 30,
  coverMaxChars: 2048,
} as const;
