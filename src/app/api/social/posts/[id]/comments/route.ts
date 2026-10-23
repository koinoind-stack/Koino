import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, getBlockFilter, notify, notifyMentions, jsonError } from "@/lib/social/server";
import { rateLimit } from "@/lib/social/rate-limit";

/**
 * GET  /api/social/posts/[id]/comments?cursor=<iso>  — list (top-level + reply counts)
 * POST /api/social/posts/[id]/comments               — create comment or reply
 *
 * Comments are one level deep: replies (parentId) attach to top-level
 * comments only. The post author may delete any comment (see
 * [commentId]/route.ts); comment authors may delete their own.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const session = await getSessionUser();
  if (!session.user) return jsonError("Not authenticated", 401);
  const viewerId = session.user.id;

  const post = await db.post.findUnique({ where: { id }, select: { id: true, authorId: true } });
  if (!post) return jsonError("Post not found", 404);

  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get("cursor");
  const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "20", 10), 1), 50);

  const blockFilter = viewerId ? await getBlockFilter(viewerId) : undefined;
  const where: Record<string, unknown> = {
    postId: id,
    parentId: null,
    ...(blockFilter ? { NOT: blockFilter } : {}),
    ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
  };

  const rows = await db.postComment.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    select: {
      id: true,
      content: true,
      createdAt: true,
      userId: true,
      user: { select: { id: true, name: true, username: true, image: true, verified: true } },
      replies: {
        orderBy: { createdAt: "asc" },
        take: 2,
        select: {
          id: true,
          content: true,
          createdAt: true,
          user: { select: { id: true, name: true, username: true, image: true, verified: true } },
        },
      },
      _count: { select: { replies: true } },
    },
  });

  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  return Response.json({
    comments: page.map((c) => ({
      id: c.id,
      content: c.content,
      createdAt: c.createdAt.toISOString(),
      user: c.user,
      replyCount: c._count.replies,
      recentReplies: c.replies.map((r) => ({
        id: r.id,
        content: r.content,
        createdAt: r.createdAt.toISOString(),
        user: r.user,
      })),
    })),
    nextCursor: hasMore && page.length > 0 ? page[page.length - 1].createdAt.toISOString() : null,
  });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const session = await getSessionUser();
  if (!session.user) {
    if (session.code === "ACCOUNT_INACTIVE") return jsonError(session.error!, 403);
    return jsonError("Not authenticated", 401);
  }
  const me = session.user;

  if (!rateLimit(`comments:create:${me.id}`, 60, 60 * 60 * 1000)) {
    return jsonError("You're commenting too fast — take a short break", 429);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body");
  }

  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!content) return jsonError("Comment cannot be empty");
  if (content.length > 1000) return jsonError("Comment must be 1000 characters or fewer");

  const post = await db.post.findUnique({ where: { id }, select: { id: true, authorId: true } });
  if (!post) return jsonError("Post not found", 404);
  if (post.authorId !== me.id && (await (await import("@/lib/social/server")).areBlocked(me.id, post.authorId))) {
    return jsonError("You can't comment on this post", 403);
  }

  // Reply target: must be a top-level comment on THIS post (one level only).
  let parentId: string | null = null;
  if (typeof body.parentId === "string" && body.parentId) {
    const parent = await db.postComment.findFirst({
      where: { id: body.parentId, postId: id, parentId: null },
      select: { id: true, userId: true },
    });
    if (!parent) return jsonError("Comment not found", 404);
    parentId = parent.id;
  }

  try {
    const comment = await db.postComment.create({
      data: { postId: id, userId: me.id, content, parentId },
      select: {
        id: true,
        content: true,
        createdAt: true,
        user: { select: { id: true, name: true, username: true, image: true, verified: true } },
      },
    });

    await db.post.update({ where: { id }, data: { commentCount: { increment: 1 } } }).catch(() => {});
    await notify({
      userId: post.authorId,
      actorId: me.id,
      type: parentId ? "reply" : "comment",
      postId: id,
      commentId: comment.id,
    });
    if (parentId) {
      const parent = await db.postComment.findUnique({ where: { id: parentId }, select: { userId: true } });
      if (parent && parent.userId !== post.authorId) {
        await notify({
          userId: parent.userId,
          actorId: me.id,
          type: "reply",
          postId: id,
          commentId: comment.id,
        });
      }
    }
    await notifyMentions({ text: content, actorId: me.id, postId: id, commentId: comment.id });

    return Response.json(
      { comment: { ...comment, createdAt: comment.createdAt.toISOString() } },
      { status: 201 },
    );
  } catch (err) {
    console.error("[social/comments] POST failed:", err);
    return jsonError("Failed to add comment", 500);
  }
}
