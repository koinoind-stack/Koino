import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, notify, jsonError } from "@/lib/social/server";
import { rateLimit } from "@/lib/social/rate-limit";

/**
 * POST /api/social/posts/[id]/like — toggle like (short $transaction keeps
 * the denormalized likeCount consistent with the join row).
 */
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const session = await getSessionUser();
  if (!session.user) return jsonError("Not authenticated", 401);
  const me = session.user;

  if (!rateLimit(`likes:${me.id}`, 120, 60 * 60 * 1000)) {
    return jsonError("Too many actions — slow down a little", 429);
  }

  const post = await db.post.findUnique({ where: { id }, select: { id: true, authorId: true } });
  if (!post) return jsonError("Post not found", 404);

  try {
    const result = await db.$transaction(async (tx) => {
      const existing = await tx.postLike.findUnique({
        where: { postId_userId: { postId: id, userId: me.id } },
        select: { id: true },
      });
      if (existing) {
        await tx.postLike.delete({ where: { id: existing.id } });
        const updated = await tx.post.update({
          where: { id },
          data: { likeCount: { decrement: 1 } },
          select: { likeCount: true },
        });
        return { liked: false, likeCount: Math.max(0, updated.likeCount) };
      }
      await tx.postLike.create({ data: { postId: id, userId: me.id } });
      const updated = await tx.post.update({
        where: { id },
        data: { likeCount: { increment: 1 } },
        select: { likeCount: true },
      });
      return { liked: true, likeCount: updated.likeCount };
    });

    if (result.liked) {
      await notify({ userId: post.authorId, actorId: me.id, type: "like", postId: id });
    }
    return Response.json(result);
  } catch (err) {
    console.error("[social/like] toggle failed:", err);
    return jsonError("Failed to toggle like", 500);
  }
}
