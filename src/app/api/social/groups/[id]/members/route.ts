import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, jsonError, notify } from "@/lib/social/server";
import { rateLimit } from "@/lib/social/rate-limit";

/**
 * Membership actions for a group.
 *
 * POST   /api/social/groups/[id]/members — join (public → active instantly;
 *          private → pending request; owner notified on approval-needed).
 * DELETE /api/social/groups/[id]/members — leave (owner cannot leave; group
 *          deletion is a future admin feature).
 * PATCH  /api/social/groups/[id]/members — owner only: { action: "approve" |
 *          "remove", userId } to approve pending requests or remove members.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionUser();
  if (!session.user) {
    if (session.code === "ACCOUNT_INACTIVE") return jsonError(session.error!, 403);
    return jsonError("Not authenticated", 401);
  }
  const me = session.user;
  const { id: groupId } = await ctx.params;

  if (!rateLimit(`groups:join:${me.id}`, 30, 60 * 60 * 1000)) {
    return jsonError("Too many join actions — try again later", 429);
  }

  try {
    const group = await db.group.findUnique({
      where: { id: groupId },
      select: { id: true, visibility: true, createdById: true, name: true },
    });
    if (!group) return jsonError("Group not found", 404);

    const existing = await db.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: me.id } },
    });
    if (existing?.status === "active") return jsonError("You're already a member", 409);
    if (existing?.status === "pending") return jsonError("Your request is waiting for the owner's approval", 409);

    const isPublic = group.visibility === "public";
    const member = await db.groupMember.upsert({
      where: { groupId_userId: { groupId, userId: me.id } },
      create: { groupId, userId: me.id, status: isPublic ? "active" : "pending" },
      update: { status: isPublic ? "active" : "pending" },
      select: { status: true },
    });

    if (!isPublic) {
      // Let the owner know someone asked to join their group
      await notify({
        userId: group.createdById,
        actorId: me.id,
        type: "follow", // reuse the follow notification shape (social bell) — group types are future work
        postId: null,
      }).catch(() => {});
    }

    return Response.json({ status: member.status });
  } catch (err) {
    if (isMissingTable(err)) return jsonError("Groups are being set up — try again soon", 503);
    console.error("[social/groups/[id]/members] POST failed:", err);
    return jsonError("Failed to join group", 500);
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionUser();
  if (!session.user) return jsonError("Not authenticated", 401);
  const { id: groupId } = await ctx.params;

  try {
    const existing = await db.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: session.user.id } },
      select: { role: true, status: true },
    });
    if (!existing) return jsonError("You're not a member of this group", 404);
    if (existing.role === "owner") return jsonError("Owners can't leave their own group yet", 403);

    await db.groupMember.delete({ where: { groupId_userId: { groupId, userId: session.user.id } } });
    return Response.json({ ok: true });
  } catch (err) {
    if (isMissingTable(err)) return jsonError("Groups are being set up — try again soon", 503);
    console.error("[social/groups/[id]/members] DELETE failed:", err);
    return jsonError("Failed to leave group", 500);
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionUser();
  if (!session.user) return jsonError("Not authenticated", 401);
  const { id: groupId } = await ctx.params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body");
  }
  const action = body.action;
  const targetUserId = typeof body.userId === "string" ? body.userId : "";
  if ((action !== "approve" && action !== "remove") || !targetUserId) {
    return jsonError("action must be 'approve' or 'remove' and userId is required");
  }

  try {
    const me = await db.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: session.user.id } },
      select: { role: true, status: true },
    });
    if (!me || me.status !== "active" || me.role !== "owner") {
      return jsonError("Only the group owner can manage members", 403);
    }

    if (action === "approve") {
      const updated = await db.groupMember.update({
        where: { groupId_userId: { groupId, userId: targetUserId } },
        data: { status: "active" },
        select: { status: true },
      }).catch(() => null);
      if (!updated) return jsonError("That membership request no longer exists", 404);
      return Response.json({ ok: true, status: "active" });
    }

    // remove — never remove the owner themselves
    const target = await db.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: targetUserId } },
      select: { role: true },
    });
    if (target?.role === "owner") return jsonError("The owner can't be removed", 403);
    await db.groupMember.delete({
      where: { groupId_userId: { groupId, userId: targetUserId } },
    }).catch(() => {});
    return Response.json({ ok: true });
  } catch (err) {
    if (isMissingTable(err)) return jsonError("Groups are being set up — try again soon", 503);
    console.error("[social/groups/[id]/members] PATCH failed:", err);
    return jsonError("Failed to update member", 500);
  }
}

function isMissingTable(err: unknown): boolean {
  const e = err as { code?: string; message?: string };
  return e?.code === "P2021" || /does not exist/i.test(e?.message || "");
}
