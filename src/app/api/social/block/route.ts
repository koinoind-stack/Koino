import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, jsonError } from "@/lib/social/server";
import { rateLimit } from "@/lib/social/rate-limit";

/**
 * POST /api/social/block — toggle a two-direction block.
 * Blocking removes both follow edges in the same transaction; blocked users
 * disappear from each other's feeds, profiles, comments, stories, search.
 */
export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!session.user) return jsonError("Not authenticated", 401);
  const me = session.user;

  if (!rateLimit(`blocks:${me.id}`, 30, 60 * 60 * 1000)) {
    return jsonError("Too many actions — slow down a little", 429);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body");
  }
  if (typeof body.username !== "string" || !body.username) {
    return jsonError("username is required");
  }

  const target = await db.user.findFirst({
    where: { username: { equals: body.username.toLowerCase(), mode: "insensitive" } },
    select: { id: true, username: true },
  });
  if (!target) return jsonError("User not found", 404);
  if (target.id === me.id) return jsonError("You can't block yourself");
  if (target.id === (await db.user.findUnique({ where: { id: me.id }, select: { id: true } }))?.id) {
    // unreachable — kept for clarity
  }

  try {
    const existing = await db.block.findUnique({
      where: { blockerId_blockedId: { blockerId: me.id, blockedId: target.id } },
      select: { id: true },
    });
    if (existing) {
      // Unblock.
      await db.block.delete({ where: { id: existing.id } });
      return Response.json({ blocked: false });
    }
    // Block + remove both follow edges atomically.
    await db.$transaction([
      db.block.create({ data: { blockerId: me.id, blockedId: target.id } }),
      db.follow.deleteMany({ where: { followerId: me.id, followingId: target.id } }),
      db.follow.deleteMany({ where: { followerId: target.id, followingId: me.id } }),
    ]);
    return Response.json({ blocked: true });
  } catch (err) {
    console.error("[social/block] toggle failed:", err);
    return jsonError("Failed to toggle block", 500);
  }
}

/** GET /api/social/block — the viewer's block list (for a settings sheet). */
export async function GET() {
  const session = await getSessionUser();
  if (!session.user) return jsonError("Not authenticated", 401);
  const rows = await db.block.findMany({
    where: { blockerId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: { blocked: { select: { id: true, name: true, username: true, image: true } } },
  });
  return Response.json({ blocked: rows.map((r) => r.blocked) });
}
