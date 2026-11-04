import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, jsonError } from "@/lib/social/server";
import { isMissingSchema } from "@/lib/social/group-fields";

/**
 * Pinned announcements for a group.
 *
 * POST   /api/social/groups/[id]/pin — { postId } pins a post from THIS group
 *        to the top of the group's Posts tab.
 * DELETE /api/social/groups/[id]/pin — unpins the current announcement.
 *
 * Server-enforced: only the owner, admins and moderators may pin/unpin, and
 * only posts that actually belong to the group can be pinned.
 */
async function requireModerator(groupId: string, userId: string) {
  const membership = await db.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
    select: { role: true, status: true },
  });
  if (!membership || membership.status !== "active" || membership.role === "member") return false;
  return true;
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionUser();
  if (!session.user) return jsonError("Not authenticated", 401);
  const { id: groupId } = await ctx.params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body");
  }
  const postId = typeof body.postId === "string" ? body.postId.trim() : "";
  if (!postId) return jsonError("postId is required");

  try {
    if (!(await requireModerator(groupId, session.user.id))) {
      return jsonError("Only group managers can pin posts", 403);
    }

    const post = await db.post.findUnique({
      where: { id: postId },
      select: { id: true, groupId: true },
    });
    if (!post || post.groupId !== groupId) {
      return jsonError("Only posts inside this group can be pinned", 400);
    }

    await db.group.update({ where: { id: groupId }, data: { pinnedPostId: postId } });
    return Response.json({ ok: true, pinnedPostId: postId });
  } catch (err) {
    if (isMissingSchema(err)) return jsonError("Groups are being set up — try again soon", 503);
    console.error("[social/groups/[id]/pin] POST failed:", err);
    return jsonError("Failed to pin post", 500);
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionUser();
  if (!session.user) return jsonError("Not authenticated", 401);
  const { id: groupId } = await ctx.params;

  try {
    if (!(await requireModerator(groupId, session.user.id))) {
      return jsonError("Only group managers can unpin posts", 403);
    }
    await db.group.update({ where: { id: groupId }, data: { pinnedPostId: null } });
    return Response.json({ ok: true });
  } catch (err) {
    if (isMissingSchema(err)) return jsonError("Groups are being set up — try again soon", 503);
    console.error("[social/groups/[id]/pin] DELETE failed:", err);
    return jsonError("Failed to unpin post", 500);
  }
}
