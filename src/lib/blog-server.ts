/**
 * ─── BLOG & ARTICLES — SERVER HELPERS (Task 73) ────────────────────────────
 *
 * DB-backed helpers for the community publishing workflow: unique slugs,
 * article serialization, author notifications (reuses the Notification model
 * with targetType="article"), and the feed wrapper sync.
 *
 * FEED INTEGRATION MODEL (smallest compatible integration):
 *   - The canonical article lives ONLY in BlogPost.
 *   - On publish, one system-owned Post wrapper is created with
 *     articleId = article.id (Post.articleId is @unique → no duplicates).
 *     Existing like/comment/bookmark/share machinery keeps working unchanged.
 *   - On unpublish/archive/reject, the wrapper is set published=false
 *     (engagement rows preserved); the feed GET filters published=true.
 *   - Serialization attaches article data ONLY while the article passes the
 *     full public-visibility gate — no unpublished content can leak.
 */
import { db } from "@/lib/db";
import {
  isPubliclyVisible,
  slugifyTitle,
  BLOG_LIMITS,
} from "@/lib/blog";

// ─── Public-visibility gate (Prisma where-builder) ────────────────────────
/**
 * The public-visibility gate as a Prisma `where` clause — the query-side
 * twin of `isPubliclyVisible()` in src/lib/blog.ts. ALL four legs must hold:
 *   1. legacy boolean gate      published: true
 *   2. workflow status          status: "published"
 *   3. publish schedule         publishedAt is null or in the past
 *   4. schedule hold (Phase 1)  scheduledAt is null or in the past
 *
 * Phase 1 (security fixes 1–3): this builder is the SINGLE source of the
 * public BlogPost filter. /api/blog/latest, /blog, /blog/[slug] related
 * queries and the sitemap must use it — never a hand-rolled subset, because
 * a missing leg makes drafts or scheduled posts publicly visible.
 */
export function publicBlogPostWhere(now: Date = new Date()) {
  return {
    published: true as const,
    status: "published" as const,
    AND: [
      { OR: [{ publishedAt: null }, { publishedAt: { lte: now } }] },
      { OR: [{ scheduledAt: null }, { scheduledAt: { lte: now } }] },
    ],
  };
}

// ─── Serialization shapes ───────────────────────────────────────────────────

/** Author fields safe for public display. */
export const blogAuthorSelect = {
  id: true,
  name: true,
  username: true,
  image: true,
  verified: true,
} as const;

/** Include used by admin + owner + public article queries. */
export const blogArticleInclude = {
  authorUser: { select: blogAuthorSelect },
  publishedBy: { select: blogAuthorSelect },
} as const;

export type SerializedArticleAuthor = {
  id: string | null;
  name: string;
  username: string | null;
  image: string | null;
};

/**
 * Display author: real author (member/admin) first, then the legacy
 * display-name string, then the site default. Never falsely attributes
 * admin-written content to anyone else.
 */
export function displayArticleAuthor(post: {
  authorUser?:
    | { id?: string | null; name?: string | null; username?: string | null; image?: string | null }
    | null;
  author?: string | null;
}): SerializedArticleAuthor {
  if (post.authorUser) {
    return {
      id: post.authorUser.id ?? null,
      name: post.authorUser.name || post.authorUser.username || "Koino member",
      username: post.authorUser.username ?? null,
      image: post.authorUser.image ?? null,
    };
  }
  return { id: null, name: post.author || "Koino Team", username: null, image: null };
}

/** Resolves the author's avatar via their username profile (lazy, optional). */
export async function getAuthorImage(
  username: string | null
): Promise<string | null> {
  if (!username) return null;
  const u = await db.user.findUnique({
    where: { username },
    select: { image: true },
  });
  return u?.image ?? null;
}

// ─── Slug uniqueness ────────────────────────────────────────────────────────
/**
 * Generate a unique slug from a title. Duplicate titles are handled by
 * appending -2, -3, … (up to -50, then a random suffix). `excludeId` lets an
 * article keep its own slug when re-saving an unchanged title.
 */
export async function getUniqueBlogSlug(
  title: string,
  excludeId?: string
): Promise<string> {
  const base = slugifyTitle(title);
  for (let i = 1; i <= 50; i++) {
    const candidate = i === 1 ? base : `${base}-${i}`;
    const clash = await db.blogPost.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!clash || (excludeId && clash.id === excludeId)) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

// ─── Notifications ──────────────────────────────────────────────────────────
type ArticleNotificationType = "article_published" | "article_rejected" | "article_changes_requested";

/**
 * Notify an article's author about a moderation outcome. Mirrors the
 * apologetics helper: deduped, never throws, deep-links via href.
 */
export async function createArticleNotification(input: {
  userId: string; // article author
  actorId?: string | null; // administering admin
  type: ArticleNotificationType;
  article: { id: string; slug: string; title: string };
}): Promise<void> {
  try {
    if (input.actorId && input.actorId === input.userId) return; // no self-notify
    const existing = await db.notification.findFirst({
      where: {
        userId: input.userId,
        actorId: input.actorId ?? null,
        type: input.type,
        targetType: "article",
        targetId: input.article.id,
      },
      select: { id: true },
    });
    if (existing) return; // dedupe
    await db.notification.create({
      data: {
        userId: input.userId,
        actorId: input.actorId ?? undefined,
        type: input.type,
        targetType: "article",
        targetId: input.article.id,
        href: `/blog/${input.article.slug}`,
      },
    });
  } catch (e) {
    console.error("[blog/notifications] create failed:", e);
  }
}

// ─── Feed wrapper sync ──────────────────────────────────────────────────────
function buildFeedCaption(post: {
  title: string;
  excerpt: string | null;
}): string {
  const text = (post.excerpt || post.title).trim();
  return text.length > 2200 ? `${text.slice(0, 2197)}…` : text;
}

/**
 * Create / refresh / hide the single feed wrapper Post for an article.
 * Called after every moderation transition, after editing a live article
 * (so the feed card reflects the current excerpt/cover without duplicates),
 * and on admin instant-publish create (Phase 1 security fix 4 — the feed
 * must learn about a publishNow article immediately, not after a later edit).
 */
export async function syncArticleFeedWrapper(post: {
  id: string;
  title: string;
  excerpt: string | null;
  featuredImage: string | null;
  published: boolean;
  status: string;
  publishedAt: Date | null;
  scheduledAt?: Date | null;
  authorId: string | null;
}): Promise<void> {
  try {
    const visible = isPubliclyVisible(post);
    const existing = await db.post.findUnique({
      where: { articleId: post.id },
      select: { id: true },
    });

    if (visible) {
      // Text-only wrapper: the caption carries the excerpt and the PostCard
      // article banner renders title/cover/category/reading time from the
      // canonical article — no duplicate image block on the card.
      const data = {
        published: true,
        content: buildFeedCaption(post),
        mediaType: "text",
        mediaUrls: "[]",
      };
      if (existing) {
        await db.post.update({ where: { id: existing.id }, data });
      } else {
        // Legacy rows without a real author account cannot be attributed in
        // the feed — skip wrapper creation (article still shows on /blog).
        if (!post.authorId) return;
        await db.post.create({
          data: {
            ...data,
            articleId: post.id,
            authorId: post.authorId,
          },
        });
      }
    } else if (existing) {
      // Hide from the feed; engagement rows (likes/comments/bookmarks) are
      // preserved so a later re-publish restores the discussion.
      await db.post.update({ where: { id: existing.id }, data: { published: false } });
    }
  } catch (e) {
    console.error("[blog/feed] wrapper sync failed:", post.id, e);
  }
}

// ─── Input shaping ──────────────────────────────────────────────────────────
/** Clamp helper for API payloads (used alongside zod in routes). */
export function clampString(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.slice(0, max);
}

export { BLOG_LIMITS };
