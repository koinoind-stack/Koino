import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, jsonError } from "@/lib/social/server";
import { authShape, findMemorial, serializeMemorialFull } from "@/lib/memorial/server";
import { canManageManagers } from "@/lib/memorial/shared";

/**
 * Part 4 — DELETE /api/memorials/[id]/managers/[userId]
 *
 * Remove a co-manager. Allowed: the creator (owner), an admin, or the
 * manager removing THEMSELVES. The creator/owner can never be removed
 * (they are not a MemorialManager row anyway — this route only touches
 * co-manager rows).
 */
export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string; userId: string }> },
) {
  const session = await getSessionUser();
  if (!session.user) return jsonError("Not authenticated", 401);
  const { id, userId } = await ctx.params;

  const memorial = await findMemorial(id);
  if (!memorial) return jsonError("Memorial not found", 404);

  const viewer = { id: session.user.id, role: session.user.role };
  const selfRemoval = viewer.id === userId;
  if (!selfRemoval && !canManageManagers(authShape(memorial), viewer)) {
    return jsonError("Only the creator, an admin, or the manager themselves can remove a manager", 403);
  }
  if (userId === memorial.creatorId) {
    return jsonError("The creator cannot be removed — they own this memorial", 400);
  }

  const row = await db.memorialManager.findUnique({
    where: { memorialId_userId: { memorialId: id, userId } },
    select: { id: true },
  });
  if (!row) return jsonError("That member is not a manager of this memorial", 404);

  try {
    await db.memorialManager.delete({ where: { id: row.id } });
  } catch (err) {
    console.error("[memorial-manager-remove] failed:", err);
    return jsonError("Could not remove the manager", 500);
  }

  const fresh = await findMemorial(id);
  return Response.json({
    success: true,
    memorial: fresh ? serializeMemorialFull(fresh, session.user.id) : null,
  });
}
