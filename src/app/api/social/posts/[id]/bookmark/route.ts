import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, jsonError } from "@/lib/social/server";
import { rateLimit } from "@/lib/social/rate-limit";

/**
 * POST /api/social/posts/[id]/bookmark — toggle save-to-collection.
 */
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const session = await getSessionUser();
  if (!session.user) return jsonError("Not authenticated", 401);
  const me = session.user;

  if (!rateLimit(`bookmarks:${me.id}`, 120, 60 * 60 * 1000)) {
    return jsonError("Too many actions — slow down a little", 429);
  }

  const post = await db.post.findUnique({ where: { id }, select: { id: true } });
  if (!post) return jsonError("Post not found", 404);

  try {
    const existing = await db.postBookmark.findUnique({
      where: { postId_userId: { postId: id, userId: me.id } },
      select: { id: true },
    });
    if (existing) {
      await db.postBookmark.delete({ where: { id: existing.id } });
      return Response.json({ bookmarked: false });
    }
    await db.postBookmark.create({ data: { postId: id, userId: me.id } });
    return Response.json({ bookmarked: true });
  } catch (err) {
    console.error("[social/bookmark] toggle failed:", err);
    return jsonError("Failed to toggle bookmark", 500);
  }
}
