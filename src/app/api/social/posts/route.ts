import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, getBlockFilter, notify, notifyMentions, parseHashtags, postSelect, serializePosts, jsonError } from "@/lib/social/server";
import { rateLimit } from "@/lib/social/rate-limit";

/**
 * GET /api/social/posts?tab=following|discover|trending&cursor=<iso>&reels=1&hashtag=<tag>&userId=<id>
 *
 * Feed with cursor pagination (createdAt keyset). `following` shows posts
 * from people the viewer follows (+ their own); `discover` shows everything
 * except blocked users; `trending` ranks the last 30 days by engagement
 * (likes ×2 + comments ×3 + reposts ×3, newest first on ties, no cursor).
 * `reels=1` filters to isReel posts. Two-way block filtering applies everywhere.
 */
export async function GET(req: NextRequest) {
  const session = await getSessionUser();
  if (!session.user) return jsonError("Not authenticated", 401);
  const viewerId = session.user.id;

  const { searchParams } = new URL(req.url);
  const tabParam = searchParams.get("tab") || "";
  const tab =
    tabParam === "following" ? "following" : tabParam === "trending" ? "trending" : "discover";
  const cursor = searchParams.get("cursor");
  const reels = searchParams.get("reels") === "1";
  const hashtag = searchParams.get("hashtag");
  const userId = searchParams.get("userId");
  const groupId = searchParams.get("groupId");
  const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "10", 10), 1), 30);

  const where: Record<string, unknown> = {};
  if (!groupId) where.groupId = null; // group posts live on their group page only
  if (reels) where.isReel = true;
  if (hashtag) where.hashtags = { has: hashtag.toLowerCase() };
  if (userId) where.authorId = userId;

  if (viewerId) {
    const blockFilter = await getBlockFilter(viewerId);
    if (blockFilter) where.AND = [blockFilter];
  }

  if (tab === "following" && viewerId && !userId) {
    const follows = await db.follow.findMany({
      where: { followerId: viewerId },
      select: { followingId: true },
    });
    where.authorId = { in: [...follows.map((f) => f.followingId), viewerId] };
  }

  // Group-scoped fetch: public groups are viewable by everyone; private
  // groups require active membership.
  if (groupId) {
    const group = await db.group
      .findUnique({ where: { id: groupId }, select: { visibility: true } })
      .catch(() => null);
    if (!group) return jsonError("Group not found", 404);
    if (group.visibility !== "public") {
      const membership = await db.groupMember
        .findUnique({
          where: { groupId_userId: { groupId, userId: viewerId } },
          select: { status: true },
        })
        .catch(() => null);
      if (membership?.status !== "active")
        return jsonError("This group is private — join to see its posts", 403);
    }
    where.groupId = groupId;
  }

  // Trending: engagement-ranked window over the last 30 days. Computed in JS
  // (Prisma can't order by a weighted expression); capped at 50 candidates →
  // top 20, so it stays cheap even as the platform grows.
  if (tab === "trending") {
    try {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const candidates = await db.post.findMany({
        where: { AND: [where, { createdAt: { gte: since } }] },
        select: postSelect,
        orderBy: { createdAt: "desc" as const },
        take: 50,
      });
      const score = (p: { likeCount: number; commentCount: number; repostCount: number }) =>
        p.likeCount * 2 + p.commentCount * 3 + p.repostCount * 3;
      const ranked = [...candidates]
        .sort(
          (a, b) =>
            score(b) - score(a) ||
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        )
        .slice(0, 20);
      const posts = await serializePosts(ranked, viewerId);
      return Response.json({ posts, nextCursor: null });
    } catch (err) {
      console.error("[social/posts] trending failed:", err);
      return jsonError("Failed to load trending feed", 500);
    }
  }

  try {
    const rows = await db.post.findMany({
      where: cursor
        ? { AND: [where, { createdAt: { lt: new Date(cursor) } }] }
        : where,
      select: postSelect,
      orderBy: { createdAt: "desc" },
      take: limit + 1,
    });
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    const posts = await serializePosts(page, viewerId);
    const nextCursor =
      hasMore && page.length > 0 ? page[page.length - 1].createdAt.toISOString() : null;
    return Response.json({ posts, nextCursor });
  } catch (err) {
    console.error("[social/posts] GET failed:", err);
    return jsonError("Failed to load feed", 500);
  }
}

/**
 * POST /api/social/posts — create a post (text / images / video / quote-repost).
 * Server-side validation mirrors the signed-URL rules; counters for reposts
 * are maintained here.
 */
export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!session.user) {
    if (session.code === "ACCOUNT_INACTIVE") return jsonError(session.error!, 403);
    return jsonError("Not authenticated", 401);
  }
  const me = session.user;

  if (!rateLimit(`posts:create:${me.id}`, 20, 60 * 60 * 1000)) {
    return jsonError("You're posting too fast — try again in a bit", 429);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body");
  }

  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (content.length > 2200) return jsonError("Caption must be 2200 characters or fewer");

  const mediaType =
    body.mediaType === "image" || body.mediaType === "video" ? body.mediaType : "text";
  let mediaUrls: string[] = [];
  if (Array.isArray(body.mediaUrls)) {
    mediaUrls = body.mediaUrls
      .filter((u): u is string => typeof u === "string" && u.length > 0)
      .slice(0, 10);
  }

  if (mediaType === "image" && mediaUrls.length === 0)
    return jsonError("At least one image is required");
  if (mediaType === "video" && mediaUrls.length !== 1)
    return jsonError("A video post needs exactly one video URL");
  if (mediaType === "text" && !content) return jsonError("A text post needs a caption");
  if (mediaType === "video" && !/\.(mp4|webm|mov|m4v)(\?|$)/i.test(mediaUrls[0] || ""))
    return jsonError("Unsupported video format");

  const aspectRatio = typeof body.aspectRatio === "string" ? body.aspectRatio.slice(0, 10) : null;
  const thumbnailUrl = typeof body.thumbnailUrl === "string" ? body.thumbnailUrl.slice(0, 2048) : null;
  const isReel = body.isReel === true;

  let groupId: string | null = null;
  if (typeof body.groupId === "string" && body.groupId) {
    const group = await db.group
      .findUnique({ where: { id: body.groupId }, select: { id: true, visibility: true } })
      .catch(() => null);
    if (!group) return jsonError("Group not found", 404);
    const membership = await db.groupMember
      .findUnique({
        where: { groupId_userId: { groupId: group.id, userId: me.id } },
        select: { status: true },
      })
      .catch(() => null);
    if (membership?.status !== "active")
      return jsonError("Join the group before posting in it", 403);
    groupId = group.id;
  }

  let repostedFromId: string | null = null;
  if (typeof body.repostOfId === "string" && body.repostOfId) {
    const original = await db.post.findUnique({
      where: { id: body.repostOfId },
      select: { id: true, authorId: true },
    });
    if (!original) return jsonError("Original post not found", 404);
    const blocked = await db.block.findFirst({
      where: {
        OR: [
          { blockerId: original.authorId, blockedId: me.id },
          { blockerId: me.id, blockedId: original.authorId },
        ],
      },
      select: { id: true },
    });
    if (blocked) return jsonError("You can't repost this", 403);
    repostedFromId = original.id;
  }

  if (mediaType === "text" && !content && !repostedFromId)
    return jsonError("Nothing to post");

  try {
    const post = await db.post.create({
      data: {
        content: content || null,
        mediaType,
        mediaUrls: JSON.stringify(mediaUrls),
        thumbnailUrl,
        aspectRatio,
        hashtags: parseHashtags(content),
        isReel: mediaType === "video" && isReel,
        published: true,
        authorId: me.id,
        groupId,
        repostedFromId,
      },
      select: postSelect,
    });

    await notifyMentions({ text: content, actorId: me.id, postId: post.id });
    if (repostedFromId) {
      const original = await db.post.findUnique({
        where: { id: repostedFromId },
        select: { authorId: true },
      });
      if (original) {
        await notify({ userId: original.authorId, actorId: me.id, type: "repost", postId: post.id });
      }
      await db.post
        .update({ where: { id: repostedFromId }, data: { repostCount: { increment: 1 } } })
        .catch(() => {});
    }

    const [serialized] = await serializePosts([post], me.id);
    return Response.json({ post: serialized }, { status: 201 });
  } catch (err) {
    console.error("[social/posts] POST failed:", err);
    return jsonError("Failed to create post", 500);
  }
}
