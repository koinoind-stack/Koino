/**
 * ─── SOCIAL FEED UTILITIES (Koino Social) ────────────────────────────────────
 *
 * Pure, dependency-free helpers behind the Part 2 social feed behaviors:
 * feed tabs, Trending ranking, keyset pagination cursors, notification
 * de-duplication and repost state. Everything here is client-safe (no
 * server-only imports) and unit-tested in:
 *
 *   tests/social-feed-utils.test.ts   — tabs / trending / cursor
 *   tests/notification-dedup.test.ts  — isDuplicateNotification
 *   tests/repost-state.test.ts        — repost attribution + state reducer
 *
 * Keeping the logic pure lets the API routes and React components stay thin
 * while the decision-making is covered by tests that need no database and no
 * network.
 */

/** The three feed tabs. "discover" renders as "For You" (i18n: feed.tab.discover). */
export type FeedTab = "discover" | "following" | "trending";

/**
 * Parse the `tab` query parameter into a known feed tab.
 * Anything missing/unknown falls back to "discover" (For You) — the same
 * default GET /api/social/posts has always used, now pinned in one place.
 */
export function parseFeedTab(param: string | null | undefined): FeedTab {
  if (param === "following") return "following";
  if (param === "trending") return "trending";
  return "discover";
}

/** Minimal counter shape both Prisma rows and serialized posts satisfy. */
export interface EngagementCounters {
  likeCount: number;
  commentCount: number;
  repostCount: number;
}

/**
 * Trending score — unchanged weights from the Part 1 route:
 * likes ×2 + comments ×3 + reposts ×3. Exported so the route and the tests
 * share one definition.
 */
export function trendingScore(p: EngagementCounters): number {
  return p.likeCount * 2 + p.commentCount * 3 + p.repostCount * 3;
}

/**
 * Rank trending candidates: score desc, then newest first on ties.
 * Non-mutating (the route passes a fresh array; spread guarantees it).
 */
export function rankTrending<T extends EngagementCounters & { createdAt: Date | string }>(
  candidates: T[],
  take: number,
): T[] {
  return [...candidates]
    .sort(
      (a, b) =>
        trendingScore(b) - trendingScore(a) ||
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .slice(0, Math.max(0, take));
}

/**
 * Keyset cursor for createdAt-ordered pages: the last row's ISO timestamp
 * when (and only when) another page exists. This is the exact rule the
 * posts / comments / notifications routes apply — pinned here so pagination
 * behavior is testable and cannot drift between endpoints.
 */
export function nextCursorFrom(
  lastCreatedAt: Date | string | undefined | null,
  hasMore: boolean,
): string | null {
  if (!hasMore || !lastCreatedAt) return null;
  const d = lastCreatedAt instanceof Date ? lastCreatedAt : new Date(lastCreatedAt);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** The identity fields that make a notification unique per recipient. */
export interface NotificationIdentity {
  userId: string;
  actorId: string | null | undefined;
  type: string;
  postId?: string | null;
  commentId?: string | null;
  storyId?: string | null;
}

/**
 * True when `existing` is the SAME notification event as `incoming`.
 *
 * Why: like/repost are toggles — a viewer who likes → unlikes → likes again
 * must not produce a second "liked your post" row for the recipient (Part 2
 * spec: notification integration must prevent duplicates). Comment/reply
 * notifications are naturally unique through their commentId, and mentions
 * through (postId, commentId); this check covers all of them uniformly by
 * comparing the full identity tuple.
 */
export function isDuplicateNotification(
  existing: NotificationIdentity | null | undefined,
  incoming: NotificationIdentity,
): boolean {
  if (!existing) return false;
  return (
    existing.userId === incoming.userId &&
    (existing.actorId ?? null) === (incoming.actorId ?? null) &&
    existing.type === incoming.type &&
    (existing.postId ?? null) === (incoming.postId ?? null) &&
    (existing.commentId ?? null) === (incoming.commentId ?? null) &&
    (existing.storyId ?? null) === (incoming.storyId ?? null)
  );
}

/** Serialized viewer flags on a feed post (mirrors SerializedPost.viewer). */
export interface PostViewerFlags {
  liked: boolean;
  bookmarked: boolean;
  following: boolean;
  reposted: boolean;
}

/** Minimal post shape the repost helpers need (client Post type satisfies it). */
export interface RepostablePost {
  id: string;
  repostCount: number;
  author: { id: string; username: string | null; name?: string | null };
  repostedFrom: { author: { id: string; username: string | null; name?: string | null } } | null;
  viewer: PostViewerFlags;
}

/**
 * The @handle the "↻ Reposted from @…" attribution line should show.
 *
 * On a repost wrapper the TOP author is the person who reposted; the
 * attribution belongs to the ORIGINAL author (`repostedFrom.author`).
 * The pre-Part 2 card rendered the wrapper author here — which for the
 * viewer's own repost read the nonsensical "Reposted from @me".
 */
export function repostAttributionHandle(post: RepostablePost): string | null {
  return post.repostedFrom?.author.username ?? null;
}

/** Response shape of POST /api/social/posts/[id]/repost. */
export interface RepostResponse {
  reposted: boolean;
  repostCount: number;
}

/**
 * Fold a server repost response into the current post state (pure).
 *
 * `reposted: true`  → viewer now has a repost marker  → count from server.
 * `reposted: false` → marker removed (undo)           → count from server.
 * Counts always come from the server response — never guessed locally — so
 * an out-of-sync optimistic bump can never stick.
 */
export function applyRepostToViewer(
  post: RepostablePost,
  res: RepostResponse,
): Pick<RepostablePost, "repostCount" | "viewer"> {
  return {
    repostCount: Math.max(0, res.repostCount),
    viewer: { ...post.viewer, reposted: res.reposted },
  };
}

/**
 * Optimistic repost count for the instant before the server answers:
 * +1 when starting a repost, −1 when starting an undo, floored at 0.
 */
export function optimisticRepostCount(post: RepostablePost): number {
  return Math.max(0, post.repostCount + (post.viewer.reposted ? -1 : 1));
}
