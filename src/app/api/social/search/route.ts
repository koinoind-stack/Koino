import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, getExcludedUserIds, postSelect, serializePosts, jsonError } from "@/lib/social/server";

/**
 * GET /api/social/search?q=<term>&type=all|users|posts|hashtags
 * Search across users (username/name), hashtags, and post captions.
 * Suggested users (no query) are included for the Explore empty state.
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

  if (!q) {
    // Suggested users for the Explore empty state: most-followed first.
    const suggested = await db.user.findMany({
      where: { profileCompleted: true, ...notBlocked, ...(viewerId ? { id: { not: viewerId } } : {}) },
      orderBy: [{ followers: { _count: "desc" } }, { createdAt: "desc" }],
      take: 6,
      select: { id: true, name: true, username: true, image: true, bio: true, _count: { select: { followers: true } } },
    });
    return Response.json({
      users: suggested.map((u) => ({
        id: u.id,
        name: u.name,
        username: u.username,
        image: u.image,
        bio: u.bio,
        followers: u._count.followers,
      })),
      hashtags: [],
      posts: [],
    });
  }

  const term = q.toLowerCase();

  const users =
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
            _count: { select: { followers: true } },
          },
        })
      : [];

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
    users: users.map((u) => ({
      id: u.id,
      name: u.name,
      username: u.username,
      image: u.image,
      bio: u.bio,
      followers: u._count.followers,
    })),
    hashtags: hashtagMatches.map((h) => ({ tag: h.tag, count: Number(h.count) })),
    posts,
  });
}
