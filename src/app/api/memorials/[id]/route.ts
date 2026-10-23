import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, jsonError } from "@/lib/social/server";
import {
  authShape,
  requireMemorialAccess,
  serializeMemorialFull,
} from "@/lib/memorial/server";
import {
  canDeleteMemorial,
  canEditMemorial,
  validateMemorialInput,
  visibleCondolenceStatuses,
} from "@/lib/memorial/shared";

/**
 * Part 4 — GET/PATCH/DELETE /api/memorials/[id]
 *
 * GET    detail with condolence counts (approved for everyone; pending count
 *        additionally for managers/admin).
 * PATCH  edit — creator, co-managers, or admin (pure rule, server-side).
 * DELETE — creator (owner) or admin ONLY; co-managers are refused.
 *          Hard delete cascades to managers + condolences (FK onCascade).
 */

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionUser();
  const { id } = await ctx.params;

  const access = await requireMemorialAccess(id, session.user);
  if (!access.ok) return access.response;
  const { memorial, viewer } = access;
  const shape = authShape(memorial);

  const seesQueue = visibleCondolenceStatuses(shape, viewer).includes("pending");

  const [condolenceCount, pendingCount] = await Promise.all([
    db.memorialCondolence.count({ where: { memorialId: id, status: "approved" } }),
    seesQueue
      ? db.memorialCondolence.count({ where: { memorialId: id, status: "pending" } })
      : Promise.resolve(0),
  ]);

  return Response.json({
    memorial: serializeMemorialFull(memorial, viewer?.id ?? null),
    condolenceCount,
    pendingCount,
    canEdit: canEditMemorial(shape, viewer),
    canDelete: canDeleteMemorial(shape, viewer),
  });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionUser();
  if (!session.user) return jsonError("Not authenticated", 401);
  const { id } = await ctx.params;

  const access = await requireMemorialAccess(id, session.user);
  if (!access.ok) return access.response;
  const { memorial, viewer } = access;

  if (!canEditMemorial(authShape(memorial), viewer)) {
    return jsonError("Only the memorial's managers can edit it", 403);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body");
  }

  const parsed = validateMemorialInput(body);
  if (!parsed.ok) return jsonError(parsed.error);

  try {
    const updated = await db.memorial.update({
      where: { id },
      data: { ...parsed.value },
      select: { id: true },
    });
    return Response.json({ success: true, id: updated.id });
  } catch (err) {
    console.error("[memorial-update] failed:", err);
    return jsonError("Could not update the memorial", 500);
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionUser();
  if (!session.user) return jsonError("Not authenticated", 401);
  const { id } = await ctx.params;

  const access = await requireMemorialAccess(id, session.user);
  if (!access.ok) return access.response;
  const { memorial, viewer } = access;

  if (!canDeleteMemorial(authShape(memorial), viewer)) {
    return jsonError("Only the memorial's creator or an admin can delete it", 403);
  }

  try {
    await db.memorial.delete({ where: { id } });
    return Response.json({ success: true });
  } catch (err) {
    console.error("[memorial-delete] failed:", err);
    return jsonError("Could not delete the memorial", 500);
  }
}
