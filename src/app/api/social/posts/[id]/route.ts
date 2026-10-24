import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, areBlocked, notifyMentions, parseHashtags, postSelect, serializePosts, jsonError } from "@/lib/social/server";
import { rateLimit } from "@/lib/social/rate-limit";

/**
 * GET    /api/social/posts/[id]  — single post (with viewer flags)
 * PATCH  /api/social/posts/[id]  — edit caption (author only)
 * DELETE /api/social/posts/[id]  — delete own post, or any group post when
 *          the viewer is a manager (owner/admin/moderator) of the post's
 *          group (+ best-effort storage cleanup)
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const session = await getSessionUser();
  if (!session.user) return jsonError("Not authenticated", 401);
  const viewerId = session.user.id;

  const post = await db.post.findUnique({ where: { id }, select: postSelect });
  if (!post) return jsonError("Post not found", 404);
  if (viewerId && post.author.id !== viewerId && (await areBlocked(viewerId, post.author.id))) {
    return jsonError("Post not available", 404);
  }

  // Count a detail view (skip for the author; fire-and-forget).
  if (!viewerId || viewerId !== post.author.id) {
    db.post.update({ where: { id }, data: { viewCount: { increment: 1 } } }).catch(() => {});
  }

  const [serialized] = await serializePosts([post], viewerId);
  return Response.json({ post: serialized });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const session = await getSessionUser();
  if (!session.user) return jsonError("Not authenticated", 401);

  const post = await db.post.findUnique({ where: { id }, select: { authorId: true } });
  if (!post) return jsonError("Post not found", 404);
  if (post.authorId !== session.user.id) return jsonError("You can only edit your own posts", 403);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body");
  }

  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!content) return jsonError("Caption cannot be empty");
  if (content.length > 2200) return jsonError("Caption must be 2200 characters or fewer");
  if (!rateLimit(`posts:edit:${session.user.id}`, 30, 60 * 60 * 1000)) {
    return jsonError("Too many edits — try again later", 429);
  }

  const updated = await db.post.update({
    where: { id },
    data: { content, editedAt: new Date(), hashtags: parseHashtags(content) },
    select: postSelect,
  });

  await notifyMentions({ text: content, actorId: session.user.id, postId: id });

  const [serialized] = await serializePosts([updated], session.user.id);
  return Response.json({ post: serialized });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const session = await getSessionUser();
  if (!session.user) return jsonError("Not authenticated", 401);

  const post = await db.post.findUnique({
    where: { id },
    select: { authorId: true, mediaUrls: true, repostedFromId: true, groupId: true },
  });
  if (!post) return jsonError("Post not found", 404);

  // The author can always delete their own post. Group managers (owner,
  // admin, moderator) can also moderate ANY post inside their group —
  // verified server-side, never trusted from the client.
  let isGroupManager = false;
  if (!post.authorId || post.authorId !== session.user.id) {
    if (post.groupId) {
      const membership = await db.groupMember.findUnique({
        where: { groupId_userId: { groupId: post.groupId, userId: session.user.id } },
        select: { role: true, status: true },
      });
      isGroupManager = !!membership && membership.status === "active" && membership.role !== "member";
    }
    if (!isGroupManager) return jsonError("You can only delete your own posts", 403);
  }

  try {
    await db.post.delete({ where: { id } });
    if (post.repostedFromId) {
      db.post
        .update({ where: { id: post.repostedFromId }, data: { repostCount: { decrement: 1 } } })
        .catch(() => {});
    }
    // Best-effort storage cleanup for media posts.
    if (post.mediaUrls && post.mediaUrls !== "[]") {
      try {
        const urls: string[] = JSON.parse(post.mediaUrls);
        if (process.env.SUPABASE_SERVICE_ROLE_KEY && urls.length > 0) {
          const { createServiceClient } = await import("@/lib/supabase/service");
          const supabase = createServiceClient();
          // Public URLs look like <origin>/storage/v1/object/public/<bucket>/<path>
          const refs = urls
            .map((u) => {
              const m = u.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+?)(\?|$)/);
              return m ? { bucket: m[1], path: m[2] } : null;
            })
            .filter((x): x is { bucket: string; path: string } => !!x);
          for (const ref of refs) {
            await supabase.storage.from(ref.bucket).remove([ref.path]).catch(() => {});
          }
        }
      } catch (cleanupErr) {
        console.warn("[social/posts] DELETE storage cleanup failed (non-fatal):", cleanupErr);
      }
    }
    return Response.json({ success: true });
  } catch (err) {
    console.error("[social/posts] DELETE failed:", err);
    return jsonError("Failed to delete post", 500);
  }
}
