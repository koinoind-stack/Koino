import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, jsonError, notify } from "@/lib/social/server";
import { rateLimit } from "@/lib/social/rate-limit";
import { authShape, findMemorial } from "@/lib/memorial/server";
import {
  canModerateCondolences,
  canViewCondolence,
  moderationTransition,
} from "@/lib/memorial/shared";

/**
 * Part 4 — PATCH/DELETE /api/memorials/[id]/condolences/[condolenceId]
 *
 * PATCH  moderation — approve | reject | reopen. Managers + admin only.
 *        The author is notified on approve (never on reject).
 * DELETE — the author (their own message, any status) or a manager/admin.
 */
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; condolenceId: string }> },
) {
  const session = await getSessionUser();
  if (!session.user) return jsonError("Not authenticated", 401);
  const { id, condolenceId } = await ctx.params;

  if (!rateLimit(`condolence-mod:${session.user.id}`, 60, 60 * 60 * 1000)) {
    return jsonError("Too many moderation actions — try again later", 429);
  }

  const memorial = await findMemorial(id);
  if (!memorial) return jsonError("Memorial not found", 404);
  const shape = authShape(memorial);
  const viewer = { id: session.user.id, role: session.user.role };

  if (!canModerateCondolences(shape, viewer)) {
    return jsonError("Only the memorial's managers can moderate condolences", 403);
  }

  const condolence = await db.memorialCondolence.findUnique({
    where: { id: condolenceId },
    select: { id: true, memorialId: true, authorId: true, status: true },
  });
  if (!condolence || condolence.memorialId !== id) {
    return jsonError("Condolence not found", 404);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body");
  }

  const action = body.action;
  if (action !== "approve" && action !== "reject" && action !== "reopen") {
    return jsonError("action must be one of: approve, reject, reopen");
  }

  const nextStatus = moderationTransition(condolence.status, action);
  if (!nextStatus) {
    return jsonError(`Cannot ${action} a condolence that is "${condolence.status}"`, 400);
  }

  try {
    const updated = await db.memorialCondolence.update({
      where: { id: condolenceId },
      data: { status: nextStatus, reviewedById: session.user.id, reviewedAt: new Date() },
      select: { id: true, status: true },
    });

    if (nextStatus === "approved") {
      await notify({
        userId: condolence.authorId,
        actorId: session.user.id,
        type: "memorial_condolence_approved",
        postId: null,
      }).catch(() => {});
    }

    return Response.json({ success: true, status: updated.status });
  } catch (err) {
    console.error("[condolence-moderate] failed:", err);
    return jsonError("Could not update the condolence", 500);
  }
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string; condolenceId: string }> },
) {
  const session = await getSessionUser();
  if (!session.user) return jsonError("Not authenticated", 401);
  const { id, condolenceId } = await ctx.params;

  const memorial = await findMemorial(id);
  if (!memorial) return jsonError("Memorial not found", 404);
  const shape = authShape(memorial);
  const viewer = { id: session.user.id, role: session.user.role };

  const condolence = await db.memorialCondolence.findUnique({
    where: { id: condolenceId },
    select: { id: true, memorialId: true, authorId: true, status: true },
  });
  if (!condolence || condolence.memorialId !== id) {
    return jsonError("Condolence not found", 404);
  }

  // Visibility gate first: a user who cannot even SEE a pending condolence
  // must not learn anything about it from the delete endpoint.
  if (!canViewCondolence(shape, viewer, condolence)) {
    return jsonError("Condolence not found", 404);
  }

  const isAuthor = viewer.id === condolence.authorId;
  const isModerator = canModerateCondolences(shape, viewer);
  if (!isAuthor && !isModerator) {
    return jsonError("You can only delete your own condolences", 403);
  }

  try {
    await db.memorialCondolence.delete({ where: { id: condolenceId } });
    return Response.json({ success: true });
  } catch (err) {
    console.error("[condolence-delete] failed:", err);
    return jsonError("Could not delete the condolence", 500);
  }
}
