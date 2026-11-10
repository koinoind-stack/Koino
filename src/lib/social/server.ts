import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { isPubliclyVisible } from "@/lib/blog";
import { isDuplicateNotification, type NotificationIdentity } from "@/lib/social/feed-utils";

/**
 * Shared server helpers for /api/social/* routes (Task 50).
 * All functions are server-only — never import this file from client code.
 */

export type SessionUser = {
  id: string;
  email: string;
  role: string;
};

/**
 * Authenticated + active session user for social routes.
 * Returns null when not signed in. Blocked/suspended accounts are rejected
 * with a 403-shaped error object (callers turn that into a response).
 */
export async function getSessionUser(): Promise<
  { user: SessionUser } | { user: null; error?: string; code?: string }
> {
  const auth = await getAuthUser();
  if (!auth) return { user: null };
  const record = await db.user.findUnique({
    where: { id: auth.id },
    select: { id: true, email: true, role: true, accountStatus: true },
  });
  if (!record) return { user: null };
  if (record.accountStatus !== "active") {
    return { user: null, error: "Account is not active", code: "ACCOUNT_INACTIVE" };
  }
  return { user: { id: record.id, email: record.email, role: record.role } };
}

/** True when a↔b are blocked in EITHER direction. */
export async function areBlocked(a: string, b: string): Promise<boolean> {
  if (a === b) return false;
  const block = await db.block.findFirst({
    where: {
      OR: [
        { blockerId: a, blockedId: b },
        { blockerId: b, blockedId: a },
      ],
    },
    select: { id: true },
  });
  return !!block;
}

/** User ids that block (or are blocked by) `viewerId`. */
export async function getExcludedUserIds(viewerId: string): Promise<string[]> {
  const blocks = await db.block.findMany({
    where: { OR: [{ blockerId: viewerId }, { blockedId: viewerId }] },
    select: { blockerId: true, blockedId: true },
  });
  const ids = new Set<string>();
  for (const b of blocks) {
    ids.add(b.blockerId === viewerId ? b.blockedId : b.blockerId);
  }
  return [...ids];
}

/**
 * Convenience filter for content queries: excludes blocked users' content.
 *
 * Phase 1 Fix 3 — the author/comment-field mismatch that caused HTTP 500s:
 * this used to ALWAYS return `{ authorId: { notIn: excluded } }`. That is
 * valid on the Post model (Post.authorId) but NOT on PostComment, whose
 * author field is `userId` (prisma/schema.prisma → model PostComment).
 * Passing the filter into db.postComment.findMany made Prisma throw
 * PrismaClientValidationError ("Unknown argument `authorId`") — so
 * GET /api/social/posts/[id]/comments returned 500 for exactly and only
 * those viewers who had blocked (or been blocked by) someone, because for
 * everyone else `excluded` was empty and no filter was built.
 *
 * The author-field name is now a REQUIRED parameter, so every call site
 * must declare which model it is filtering (authorId for Post,
 * userId for PostComment) — the mismatch class is structurally prevented.
 */
export async function getBlockFilter(
  viewerId: string,
  authorField: "authorId" | "userId",
) {
  const excluded = await getExcludedUserIds(viewerId);
  if (excluded.length === 0) return undefined;
  return { [authorField]: { notIn: excluded } };
}

/**
 * Create a notification, never for: self-actions, blocked pairs, or events
 * the recipient has already been told about (Part 2 dedup).
 *
 * WHY dedup: like/repost are toggles — like → unlike → like must not stack a
 * second "liked your post" row onto the recipient's feed. Comment/reply rows
 * are naturally unique through commentId; the same identity check covers
 * them without special cases. The pure decision lives in
 * `isDuplicateNotification` (feed-utils.ts, unit-tested in
 * tests/notification-dedup.test.ts) — this wrapper only adds the lookup.
 * Fire-and-forget safe: callers may `await` or ignore; failures are logged.
 */
export async function notify(input: {
  userId: string;
  actorId?: string | null;
  type: string;
  postId?: string | null;
  commentId?: string | null;
  storyId?: string | null;
}) {
  const { userId, actorId, type, postId, commentId, storyId } = input;
  if (!actorId || actorId === userId) return; // never notify yourself
  if (await areBlocked(userId, actorId)) return; // never notify across blocks
  try {
    // Narrow the candidate set on the always-required identity fields, then
    // let the unit-tested pure helper decide on the optional target fields
    // (postId/commentId/storyId) — null-vs-value mismatches included.
    const candidates = await db.notification.findMany({
      where: { userId, actorId, type },
      select: { userId: true, actorId: true, type: true, postId: true, commentId: true, storyId: true },
      take: 25,
    });
    const incoming: NotificationIdentity = { userId, actorId, type, postId, commentId, storyId };
    if (candidates.some((c) => isDuplicateNotification(c, incoming))) return; // already notified — never duplicate
    await db.notification.create({
      data: { userId, actorId, type, postId: postId ?? null, commentId: commentId ?? null, storyId: storyId ?? null },
    });
  } catch (err) {
    console.warn("[social] notify failed:", type, err);
  }
}

/**
 * Parse @mentions from text → notify matching users (≤20 per caption).
 * Mentioned users must exist to be notified; never notifies across blocks
 * (handled by `notify`).
 */
export async function notifyMentions(input: {
  text: string;
  actorId: string;
  postId?: string | null;
  commentId?: string | null;
}) {
  const { text, actorId, postId, commentId } = input;
  const handles = [...new Set((text.match(/(?:^|\s)@([a-zA-Z0-9_.]{3,30})/g) || [])
    .map((m) => m.trim().slice(1).toLowerCase()))].slice(0, 20);
  for (const handle of handles) {
    const target = await db.user.findFirst({
      where: { username: { equals: handle, mode: "insensitive" } },
      select: { id: true },
    });
    if (!target) continue;
    await notify({
      userId: target.id,
      actorId,
      type: "mention",
      postId: postId ?? null,
      commentId: commentId ?? null,
    });
  }
}

/** Extract up to 30 hashtags from text (word chars + unicode letters, no leading #). */
export function parseHashtags(text: string | null | undefined): string[] {
  if (!text) return [];
  const matches = text.match(/(?:^|\s)#([\p{L}\p{N}_]{1,50})(?=\s|$)/gu) || [];
  return [...new Set(matches.map((m) => m.trim().slice(1).toLowerCase()))].slice(0, 30);
}

/** Serialized post shape returned to clients (mediaUrls parsed, viewer flags added). */
export type SerializedPost = {
  id: string;
  content: string | null;
  mediaType: string;
  mediaUrls: string[];
  thumbnailUrl: string | null;
  aspectRatio: string | null;
  hashtags: string[];
  likeCount: number;
  commentCount: number;
  repostCount: number;
  viewCount: number;
  isReel: boolean;
  memorial: { id: string; fullName: string } | null; // Part 4: "View Memorial" feed card
  video: { id: string; slug: string; title: string; thumbnailUrl: string | null; durationSec: number | null } | null; // Part 5: "Watch Now" feed card
  // Task 73: "Read Article" feed card — attached ONLY while the article
  // passes the full public-visibility gate (never leaks unpublished content).
  article: {
    id: string;
    slug: string;
    title: string;
    excerpt: string | null;
    featuredImage: string | null;
    category: string;
    readingMinutes: number | null;
  } | null;
  editedAt: string | null;
  createdAt: string;
  author: {
    id: string;
    name: string | null;
    username: string | null;
    image: string | null;
    verified?: boolean;
  };
  repostedFrom: {
    id: string;
    content: string | null;
    mediaType: string;
    mediaUrls: string[];
    thumbnailUrl: string | null;
    aspectRatio: string | null;
    isReel: boolean;
    author: { id: string; name: string | null; username: string | null; image: string | null };
  } | null;
  viewer: { liked: boolean; bookmarked: boolean; following: boolean; reposted: boolean };
};

/**
 * The shared select for post payloads: author + original post for reposts.
 * Use with db.post.findMany/findUnique/findFirst.
 */
export const postSelect = {
  id: true,
  content: true,
  mediaType: true,
  mediaUrls: true,
  thumbnailUrl: true,
  aspectRatio: true,
  hashtags: true,
  likeCount: true,
  commentCount: true,
  repostCount: true,
  viewCount: true,
  isReel: true,
  memorial: { select: { id: true, fullName: true } },
  video: { select: { id: true, slug: true, title: true, thumbnailUrl: true, durationSec: true } },
  article: {
    select: {
      id: true,
      slug: true,
      title: true,
      excerpt: true,
      featuredImage: true,
      category: true,
      readingMinutes: true,
      status: true,
      published: true,
      publishedAt: true,
      scheduledAt: true, // gate must see the schedule hold (4-leg visibility)
    },
  },
  editedAt: true,
  createdAt: true,
  author: {
    select: { id: true, name: true, username: true, image: true, verified: true },
  },
  repostedFrom: {
    select: {
      id: true,
      content: true,
      mediaType: true,
      mediaUrls: true,
      thumbnailUrl: true,
      aspectRatio: true,
      isReel: true,
      video: { select: { id: true, slug: true, title: true, thumbnailUrl: true, durationSec: true } },
      author: { select: { id: true, name: true, username: true, image: true, verified: true } },
    },
  },
} as const;

function safeParseUrls(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((u) => typeof u === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Repost marker set for a viewer across a page of posts (single query).
 *
 * A repost is a Post row authored by the viewer with `repostedFromId` set —
 * both the hidden plain-repost marker (published:false, created by the
 * toggle route) and a published quote-repost count as "the viewer reposted
 * this". Returns the set of ORIGINAL post ids the viewer has reposted.
 */
export async function fetchViewerRepostSet(
  viewerId: string | null,
  postIds: string[],
): Promise<Set<string>> {
  if (!viewerId || postIds.length === 0) return new Set<string>();
  // Defensive: a viewer-repost lookup failure must never 500 the whole feed
  // serialization (degrades to "viewer has not reposted anything").
  try {
    const markers = await db.post.findMany({
      where: { authorId: viewerId, repostedFromId: { in: postIds } },
      select: { repostedFromId: true },
    });
    return new Set(
      markers
        .map((m) => m.repostedFromId)
        .filter((v): v is string => typeof v === "string"),
    );
  } catch {
    return new Set<string>();
  }
}

/**
 * Serialize post rows + attach viewer flags in ONE extra batched query set
 * (not N+1): likes/bookmarks for this viewer across the page, the follow
 * map for the page's authors, and (Part 2) the viewer's repost markers so
 * cards can render active repost state and offer undo.
 */
export async function serializePosts(
  rows: any[],
  viewerId: string | null,
): Promise<SerializedPost[]> {
  const ids = rows.map((r) => r.id);
  const authorIds = [...new Set(rows.map((r) => r.author.id))];

  let likedSet = new Set<string>();
  let bookmarkedSet = new Set<string>();
  let followingSet = new Set<string>();
  let repostedSet = new Set<string>();

  if (viewerId && ids.length > 0) {
    const [likes, bookmarks, follows, reposts] = await Promise.all([
      db.postLike.findMany({ where: { userId: viewerId, postId: { in: ids } }, select: { postId: true } }),
      db.postBookmark.findMany({ where: { userId: viewerId, postId: { in: ids } }, select: { postId: true } }),
      db.follow.findMany({
        where: { followerId: viewerId, followingId: { in: authorIds } },
        select: { followingId: true },
      }),
      fetchViewerRepostSet(viewerId, ids),
    ]);
    likedSet = new Set(likes.map((l) => l.postId));
    bookmarkedSet = new Set(bookmarks.map((b) => b.postId));
    followingSet = new Set(follows.map((f) => f.followingId));
    repostedSet = reposts;
  }

  return rows.map((r) => ({
    id: r.id,
    content: r.content,
    mediaType: r.mediaType,
    mediaUrls: safeParseUrls(r.mediaUrls),
    thumbnailUrl: r.thumbnailUrl,
    aspectRatio: r.aspectRatio,
    hashtags: r.hashtags,
    likeCount: r.likeCount,
    commentCount: r.commentCount,
    repostCount: r.repostCount,
    viewCount: r.viewCount,
    isReel: r.isReel,
    memorial: r.memorial ? { id: r.memorial.id, fullName: r.memorial.fullName } : null,
    video: r.video
      ? {
          id: r.video.id,
          slug: r.video.slug,
          title: r.video.title,
          thumbnailUrl: r.video.thumbnailUrl,
          durationSec: r.video.durationSec,
        }
      : null,
    article:
      r.article &&
      isPubliclyVisible({
        published: r.article.published,
        status: r.article.status,
        publishedAt: r.article.publishedAt,
        scheduledAt: r.article.scheduledAt,
      })
        ? {
            id: r.article.id,
            slug: r.article.slug,
            title: r.article.title,
            excerpt: r.article.excerpt,
            featuredImage: r.article.featuredImage,
            category: r.article.category,
            readingMinutes: r.article.readingMinutes,
          }
        : null,
    editedAt: r.editedAt ? r.editedAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
    author: {
      id: r.author.id,
      name: r.author.name,
      username: r.author.username,
      image: r.author.image,
      verified: !!r.author.verified,
    },
    repostedFrom: r.repostedFrom
      ? {
          id: r.repostedFrom.id,
          content: r.repostedFrom.content,
          mediaType: r.repostedFrom.mediaType,
          mediaUrls: safeParseUrls(r.repostedFrom.mediaUrls),
          thumbnailUrl: r.repostedFrom.thumbnailUrl,
          aspectRatio: r.repostedFrom.aspectRatio,
          isReel: r.repostedFrom.isReel,
          video: r.repostedFrom.video
            ? {
                id: r.repostedFrom.video.id,
                slug: r.repostedFrom.video.slug,
                title: r.repostedFrom.video.title,
                thumbnailUrl: r.repostedFrom.video.thumbnailUrl,
                durationSec: r.repostedFrom.video.durationSec,
              }
            : null,
          author: {
            id: r.repostedFrom.author.id,
            name: r.repostedFrom.author.name,
            username: r.repostedFrom.author.username,
            image: r.repostedFrom.author.image,
          },
        }
      : null,
    viewer: {
      liked: likedSet.has(r.id),
      bookmarked: bookmarkedSet.has(r.id),
      following: followingSet.has(r.author.id),
      reposted: repostedSet.has(r.id),
    },
  }));
}

export function jsonError(message: string, status = 400, extra?: Record<string, unknown>) {
  return Response.json({ error: message, ...extra }, { status });
}
