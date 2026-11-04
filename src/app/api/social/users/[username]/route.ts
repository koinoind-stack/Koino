import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, getExcludedUserIds, postSelect, serializePosts, jsonError } from "@/lib/social/server";
import { getTier } from "@/lib/trivia-server";

/**
 * GET /api/social/users/[username]?tab=posts|reels|saved
 *
 * Public social profile: identity + counters + post grid.
 * `saved` returns the VIEWER's own bookmarks and only works when
 * username === the viewer's own handle (privacy).
 * Blocked pairs get a 404 (the profile effectively doesn't exist for them).
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ username: string }> }) {
  const { username } = await ctx.params;
  const session = await getSessionUser();
  if (!session.user) return jsonError("Not authenticated", 401);
  const viewerId = session.user.id;

  const user = await db.user.findFirst({
    where: { username: { equals: username.toLowerCase(), mode: "insensitive" } },
    select: {
      id: true,
      name: true,
      username: true,
      image: true,
      bio: true,
      state: true,
      city: true,
      verified: true,
      createdAt: true,
      role: true,
      totalPoints: true,
      website: true,
      instagram: true,
      youtube: true,
      facebook: true,
      twitter: true,
      communityRole: true,
      communityRoleOther: true,
      communityRoleVisible: true,
    },
  });
  if (!user) return jsonError("User not found", 404);

  if (viewerId && viewerId !== user.id) {
    const excluded = await getExcludedUserIds(viewerId);
    if (excluded.includes(user.id)) return jsonError("User not found", 404);
  }

  const { searchParams } = new URL(req.url);
  const tab = searchParams.get("tab") || "posts";
  const cursor = searchParams.get("cursor");
  const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "12", 10), 1), 30);

  const [followers, following, postCount] = await Promise.all([
    db.follow.count({ where: { followingId: user.id } }),
    db.follow.count({ where: { followerId: user.id } }),
    db.post.count({ where: { authorId: user.id, published: true, repostedFromId: null } }),
  ]);

  // Build the grid for the requested tab.
  let posts: Awaited<ReturnType<typeof serializePosts>> = [];
  let nextCursor: string | null = null;

  if (tab === "saved") {
    if (!viewerId || viewerId !== user.id) {
      return jsonError("Saved posts are private", 403);
    }
    const bookmarks = await db.postBookmark.findMany({
      where: {
        userId: viewerId,
        ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      select: { post: { select: postSelect }, createdAt: true },
    });
    const hasMore = bookmarks.length > limit;
    const page = bookmarks.slice(0, limit);
    posts = await serializePosts(page.map((b) => b.post), viewerId);
    nextCursor = hasMore && page.length > 0 ? page[page.length - 1].createdAt.toISOString() : null;
  } else {
    const rows = await db.post.findMany({
      where: {
        authorId: user.id,
        published: true,
        ...(tab === "reels" ? { isReel: true } : {}),
        ...(tab === "posts" ? { repostedFromId: null } : {}),
        ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
      },
      select: postSelect,
      orderBy: { createdAt: "desc" },
      take: limit + 1,
    });
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    posts = await serializePosts(page, viewerId);
    nextCursor = hasMore && page.length > 0 ? page[page.length - 1].createdAt.toISOString() : null;
  }

  const isSelf = viewerId === user.id;
  const viewerFollows = viewerId
    ? !!(await db.follow.findUnique({
        where: { followerId_followingId: { followerId: viewerId, followingId: user.id } },
        select: { id: true },
      }))
    : false;

  // Faith journey for the profile header: verified FP balance, tier and the
  // badges the user has actually unlocked (public — achievements, not PII).
  const [badges, tier] = await Promise.all([
    db.userBadge.findMany({
      where: { userId: user.id },
      orderBy: { unlockedAt: "desc" },
      select: {
        badgeId: true,
        badgeName: true,
        badgeIcon: true,
        badgeDescription: true,
        unlockedAt: true,
      },
    }),
    Promise.resolve(getTier(user.totalPoints)),
  ]);

  return Response.json({
    user: {
      id: user.id,
      name: user.name,
      username: user.username,
      image: user.image,
      bio: user.bio,
      state: user.state,
      city: user.city,
      verified: !!user.verified,
      createdAt: user.createdAt.toISOString(),
      role: user.role,
      website: user.website,
      instagram: user.instagram,
      youtube: user.youtube,
      facebook: user.facebook,
      twitter: user.twitter,
      // Self-reported community role — public ONLY when the user opted in
      // via communityRoleVisible. Never implies a verified status.
      communityRole: user.communityRoleVisible ? user.communityRole : null,
      communityRoleOther: user.communityRoleVisible ? user.communityRoleOther : null,
    },
    counters: { followers, following, posts: postCount },
    isSelf,
    viewerFollows,
    faith: {
      points: user.totalPoints,
      tier: tier.current?.title ?? null,
      tierIcon: tier.current?.icon ?? null,
      badges: badges.map((b) => ({
        id: b.badgeId,
        name: b.badgeName,
        icon: b.badgeIcon,
        description: b.badgeDescription,
        unlockedAt: b.unlockedAt.toISOString(),
      })),
    },
    posts,
    nextCursor,
  });
}
