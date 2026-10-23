import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, notify, areBlocked, jsonError } from "@/lib/social/server";
import { rateLimit } from "@/lib/social/rate-limit";

/**
 * POST /api/social/users/[username]/follow — toggle follow.
 * Query: ?list=followers|following&page=<n> returns the lists for the
 * follow modals instead of toggling.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ username: string }> }) {
  const { username } = await ctx.params;
  const session = await getSessionUser();
  if (!session.user) {
    if (session.code === "ACCOUNT_INACTIVE") return jsonError(session.error!, 403);
    return jsonError("Not authenticated", 401);
  }
  const me = session.user;

  const { searchParams } = new URL(req.url);
  const list = searchParams.get("list");
  const target = await db.user.findFirst({
    where: { username: { equals: username.toLowerCase(), mode: "insensitive" } },
    select: { id: true, name: true, username: true, image: true },
  });
  if (!target) return jsonError("User not found", 404);

  // ─── List mode (followers / following modals) ───
  if (list === "followers" || list === "following") {
    const page = Math.max(parseInt(searchParams.get("page") || "0", 10), 0);
    const pageSize = 50;
    if (list === "followers") {
      const rows = await db.follow.findMany({
        where: { followingId: target.id },
        orderBy: { createdAt: "desc" },
        skip: page * pageSize,
        take: pageSize,
        select: { follower: { select: { id: true, name: true, username: true, image: true } } },
      });
      return Response.json({ users: rows.map((r) => r.follower) });
    }
    const rows = await db.follow.findMany({
      where: { followerId: target.id },
      orderBy: { createdAt: "desc" },
      skip: page * pageSize,
      take: pageSize,
      select: { following: { select: { id: true, name: true, username: true, image: true } } },
    });
    return Response.json({ users: rows.map((r) => r.following) });
  }

  // ─── Toggle mode ───
  if (target.id === me.id) return jsonError("You can't follow yourself");

  if (!rateLimit(`follows:${me.id}`, 100, 60 * 60 * 1000)) {
    return jsonError("Too many actions — slow down a little", 429);
  }
  if (await areBlocked(me.id, target.id)) return jsonError("You can't follow this account", 403);

  try {
    const existing = await db.follow.findUnique({
      where: { followerId_followingId: { followerId: me.id, followingId: target.id } },
      select: { id: true },
    });
    if (existing) {
      await db.follow.delete({ where: { id: existing.id } });
      return Response.json({ following: false });
    }
    await db.follow.create({ data: { followerId: me.id, followingId: target.id } });
    await notify({ userId: target.id, actorId: me.id, type: "follow" });
    return Response.json({ following: true });
  } catch (err) {
    console.error("[social/follow] toggle failed:", err);
    return jsonError("Failed to toggle follow", 500);
  }
}
