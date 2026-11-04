import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, getExcludedUserIds, postSelect, serializePosts, jsonError } from "@/lib/social/server";
import { resolvedCommunityRoleLabel } from "@/lib/community-roles";

/**
 * GET /api/social/search?q=<term>&type=all|users|posts|hashtags&limit=<n>
 * Search across users (username/name), hashtags, and post captions.
 * Suggested users (no query) are included for the Explore empty state —
 * `limit` (1..12, default 6) controls how many are returned.
 *
 * Every user carries `viewerFollows` (does the viewer already follow them)
 * and `role` (self-reported community role label — ONLY when that user
 * opted into public role display; null otherwise).
 * The empty-query response also carries `hashtags`: top 8 real hashtag
 * counts over the last 30 days for the Explore "For You" hub.
 */
export async function GET(req: NextRequest) {
  const session = await getSessionUser();
  if (!session.user) return jsonError("Not authenticated", 401);
  const viewerId = session.user.id;

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim().slice(0, 100);
  const type = searchParams.get("type") || "all";
  const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "20", 10), 1), 30);

  const excluded = viewerId ? await getExcludedUserIds(viewerId) : [];
  const notBlocked = excluded.length ? { id: { notIn: excluded } } : {};

  // Marks which of the given users the viewer already follows.
  async function followsMap(userIds: string[]): Promise<Set<string>> {
    if (!viewerId || userIds.length === 0) return new Set();
    const rows = await db.follow.findMany({
      where: { followerId: viewerId, followingId: { in: userIds } },
      select: { followingId: true },
    });
    return new Set(rows.map((r) => r.followingId));
  }

  if (!q) {
    // Suggested users for the Explore empty state: most-followed first.
    const suggestedLimit = Math.min(
      Math.max(parseInt(searchParams.get("suggested_limit") || "6", 10), 1),
      12,
    );
    const suggested = await db.user.findMany({
      where: { profileCompleted: true, ...notBlocked, ...(viewerId ? { id: { not: viewerId } } : {}) },
      orderBy: [{ followers: { _count: "desc" } }, { createdAt: "desc" }],
      take: suggestedLimit,
      select: {
        id: true, name: true, username: true, image: true, bio: true,
        communityRole: true, communityRoleOther: true, communityRoleVisible: true,
        _count: { select: { followers: true } },
      },
    });
    const followed = await followsMap(suggested.map((u) => u.id));

    // Real trending hashtags (post counts over the last 30 days). Best-effort:
    // a failure here only means no hashtag suggestions, never a broken search.
    let trendingHashtags: Array<{ tag: string; count: number }> = [];
    try {
      const rows = await db.$queryRaw<Array<{ tag: string; count: bigint }>>`
        SELECT UNNEST(hashtags) AS tag, COUNT(*) AS count
        FROM "Post"
        WHERE published = true AND "createdAt" >= NOW() - INTERVAL '30 days'
        GROUP BY tag
        ORDER BY count DESC
        LIMIT 8`;
      trendingHashtags = rows.map((h) => ({ tag: h.tag, count: Number(h.count) }));
    } catch (err) {
      console.warn("[social/search] trending hashtags failed:", err);
    }

    return Response.json({
      users: suggested.map((u) => ({
        id: u.id,
        name: u.name,
        username: u.username,
        image: u.image,
        bio: u.bio,
        followers: u._count.followers,
        viewerFollows: followed.has(u.id),
        role: u.communityRoleVisible
          ? resolvedCommunityRoleLabel(u.communityRole, u.communityRoleOther)
          : null,
      })),
      hashtags: trendingHashtags,
      posts: [],
    });
  }

  const term = q.toLowerCase();

  const userRows =
    type === "all" || type === "users"
      ? await db.user.findMany({
          where: {
            OR: [
              { username: { contains: term, mode: "insensitive" } },
              { name: { contains: term, mode: "insensitive" } },
            ],
            profileCompleted: true,
            ...notBlocked,
          },
          take: limit,
          select: {
            id: true,
            name: true,
            username: true,
            image: true,
            bio: true,
            communityRole: true,
            communityRoleOther: true,
            communityRoleVisible: true,
            _count: { select: { followers: true } },
          },
        })
      : [];
  const followedUsers = await followsMap(userRows.map((u) => u.id));
  const users = userRows.map((u) => ({
    id: u.id,
    name: u.name,
    username: u.username,
    image: u.image,
    bio: u.bio,
    followers: u._count.followers,
    viewerFollows: followedUsers.has(u.id),
    role: u.communityRoleVisible
      ? resolvedCommunityRoleLabel(u.communityRole, u.communityRoleOther)
      : null,
  }));

  const hashtagMatches =
    type === "all" || type === "hashtags"
      ? await db.$queryRaw<Array<{ tag: string; count: bigint }>>`
          SELECT UNNEST(hashtags) AS tag, COUNT(*) AS count
          FROM "Post"
          WHERE EXISTS (SELECT 1 FROM UNNEST(hashtags) h WHERE LOWER(h) LIKE ${"%" + term + "%"})
          GROUP BY tag
          ORDER BY count DESC
          LIMIT ${limit}`
      : [];

  const postRows =
    type === "all" || type === "posts"
      ? await db.post.findMany({
          where: {
            published: true,
            OR: [
              { content: { contains: term, mode: "insensitive" } },
              { hashtags: { has: term.replace(/^#/, "") } },
            ],
            ...(excluded.length ? { authorId: { notIn: excluded } } : {}),
          },
          select: postSelect,
          orderBy: { createdAt: "desc" },
          take: limit,
        })
      : [];

  const posts = await serializePosts(postRows, viewerId);

  return Response.json({
    users,
    hashtags: hashtagMatches.map((h) => ({ tag: h.tag, count: Number(h.count) })),
    posts,
  });
}
