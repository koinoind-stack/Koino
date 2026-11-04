import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, notify, areBlocked, postSelect, serializePosts, jsonError } from "@/lib/social/server";
import { rateLimit } from "@/lib/social/rate-limit";

/**
 * POST /api/social/posts/[id]/repost — toggle repost.
 *
 * Plain repost (no quote text) is toggled by creating/deleting a repost
 * marker post — a Post with repostedFromId set and no content, marked
 * published:false so it never appears as its own feed item. The original's
 * repostCount is kept in sync inside the transaction. Quote reposts are
 * created via POST /api/social/posts with repostOfId instead.
 */
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const session = await getSessionUser();
  if (!session.user) return jsonError("Not authenticated", 401);
  const me = session.user;

  if (!rateLimit(`reposts:${me.id}`, 60, 60 * 60 * 1000)) {
    return jsonError("Too many actions — slow down a little", 429);
  }

  const original = await db.post.findUnique({ where: { id }, select: { id: true, authorId: true } });
  if (!original) return jsonError("Post not found", 404);
  if (original.authorId === me.id) return jsonError("You can't repost your own post");
  if (await areBlocked(me.id, original.authorId)) return jsonError("You can't repost this", 403);

  try {
    const result = await db.$transaction(async (tx) => {
      const existing = await tx.post.findFirst({
        where: { authorId: me.id, repostedFromId: id, published: false, content: null },
        select: { id: true },
      });
      if (existing) {
        await tx.post.delete({ where: { id: existing.id } });
        const updated = await tx.post.update({
          where: { id },
          data: { repostCount: { decrement: 1 } },
          select: { repostCount: true },
        });
        return { reposted: false, repostCount: Math.max(0, updated.repostCount) };
      }
      await tx.post.create({
        data: { authorId: me.id, repostedFromId: id, published: false, mediaType: "text" },
      });
      const updated = await tx.post.update({
        where: { id },
        data: { repostCount: { increment: 1 } },
        select: { repostCount: true },
      });
      return { reposted: true, repostCount: updated.repostCount };
    });

    if (result.reposted) {
      await notify({ userId: original.authorId, actorId: me.id, type: "repost", postId: id });
    }
    return Response.json(result);
  } catch (err) {
    console.error("[social/repost] toggle failed:", err);
    return jsonError("Failed to toggle repost", 500);
  }
}
