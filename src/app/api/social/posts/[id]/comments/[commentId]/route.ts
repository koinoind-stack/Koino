import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, jsonError } from "@/lib/social/server";

/**
 * GET    /api/social/posts/[id]/comments/[commentId]  — a comment + all replies
 * DELETE /api/social/posts/[id]/comments/[commentId]  — delete
 *
 * Delete permission: the comment's author OR the post's author.
 * Deleting a top-level comment cascades to its replies (schema onDelete)
 * and decrements the post's commentCount by 1 + reply count.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string; commentId: string }> }) {
  const { id, commentId } = await ctx.params;
  const session = await getSessionUser();
  const viewerId = session.user?.id ?? null;

  const comment = await db.postComment.findFirst({
    where: { id: commentId, postId: id },
    select: {
      id: true,
      content: true,
      createdAt: true,
      user: { select: { id: true, name: true, username: true, image: true, verified: true } },
      replies: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          content: true,
          createdAt: true,
          user: { select: { id: true, name: true, username: true, image: true, verified: true } },
        },
      },
    },
  });
  if (!comment) return jsonError("Comment not found", 404);
  return Response.json({
    comment: {
      ...comment,
      createdAt: comment.createdAt.toISOString(),
      replies: comment.replies.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
      viewerIsAuthor: viewerId === comment.user.id,
    },
  });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string; commentId: string }> }) {
  const { id, commentId } = await ctx.params;
  const session = await getSessionUser();
  if (!session.user) return jsonError("Not authenticated", 401);

  const comment = await db.postComment.findFirst({
    where: { id: commentId, postId: id },
    select: { id: true, userId: true, parentId: true, _count: { select: { replies: true } } },
  });
  if (!comment) return jsonError("Comment not found", 404);

  const post = await db.post.findUnique({ where: { id }, select: { authorId: true } });
  if (!post) return jsonError("Post not found", 404);

  const canDelete = comment.userId === session.user.id || post.authorId === session.user.id;
  if (!canDelete) return jsonError("You can't delete this comment", 403);

  try {
    // Count what will disappear (replies cascade with the parent).
    const removed = 1 + (comment.parentId === null ? comment._count.replies : 0);
    await db.postComment.delete({ where: { id: comment.id } });
    await db.post
      .update({ where: { id }, data: { commentCount: { decrement: removed } } })
      .catch(() => {});
    return Response.json({ success: true, removed });
  } catch (err) {
    console.error("[social/comments] DELETE failed:", err);
    return jsonError("Failed to delete comment", 500);
  }
}
