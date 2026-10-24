import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, jsonError, notify } from "@/lib/social/server";
import { rateLimit } from "@/lib/social/rate-limit";
import { isMissingSchema } from "@/lib/social/group-fields";

/**
 * Membership actions for a group.
 *
 * POST   /api/social/groups/[id]/members — join. Public groups with
 *          joinMode="open" join instantly; public groups with
 *          joinMode="approval" and ALL private groups create a pending
 *          request for the managers to approve.
 * DELETE /api/social/groups/[id]/members — leave (owner cannot leave; group
 *          deletion is a future admin feature).
 * PATCH  /api/social/groups/[id]/members — manager actions:
 *          { action: "approve" | "remove", userId }  → owner/admin/moderator
 *          { action: "setRole", userId, role }       → owner only; grants or
 *          revokes admin/moderator (target roles: admin | moderator | member)
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
      select: { id: true, visibility: true, joinMode: true, createdById: true, name: true },
    });
    if (!group) return jsonError("Group not found", 404);

    const existing = await db.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: me.id } },
    });
    if (existing?.status === "active") return jsonError("You're already a member", 409);
    if (existing?.status === "pending") return jsonError("Your request is waiting for approval", 409);

    // Private groups always require approval; public groups honour joinMode.
    const needsApproval = group.visibility === "private" || group.joinMode === "approval";
    const member = await db.groupMember.upsert({
      where: { groupId_userId: { groupId, userId: me.id } },
      create: { groupId, userId: me.id, status: needsApproval ? "pending" : "active" },
      update: { status: needsApproval ? "pending" : "active" },
      select: { status: true },
    });

    if (needsApproval) {
      // Let the managers know someone asked to join (owner + admins).
      const managers = await db.groupMember.findMany({
        where: { groupId, status: "active", role: { in: ["owner", "admin"] } },
        select: { userId: true },
      });
      for (const m of managers) {
        await notify({
          userId: m.userId,
          actorId: me.id,
          type: "follow", // reuse the follow notification shape (social bell) — group types are future work
          postId: null,
        }).catch(() => {});
      }
    }

    return Response.json({ status: member.status });
  } catch (err) {
    if (isMissingSchema(err)) return jsonError("Groups are being set up — try again soon", 503);
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
    if (isMissingSchema(err)) return jsonError("Groups are being set up — try again soon", 503);
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
  if (!targetUserId || (action !== "approve" && action !== "remove" && action !== "setRole")) {
    return jsonError("action must be 'approve', 'remove' or 'setRole' and userId is required");
  }

  try {
    const me = await db.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: session.user.id } },
      select: { role: true, status: true },
    });
    if (!me || me.status !== "active" || me.role === "member") {
      return jsonError("Only group managers can do that", 403);
    }

    if (action === "setRole") {
      // Only the owner may grant or revoke admin/moderator roles.
      if (me.role !== "owner") return jsonError("Only the group owner can change roles", 403);
      const newRole = body.role;
      if (newRole !== "admin" && newRole !== "moderator" && newRole !== "member") {
        return jsonError("role must be 'admin', 'moderator' or 'member'");
      }
      const target = await db.groupMember.findUnique({
        where: { groupId_userId: { groupId, userId: targetUserId } },
        select: { role: true, status: true },
      });
      if (!target || target.status !== "active") return jsonError("That member isn't active in this group", 404);
      if (target.role === "owner") return jsonError("The owner's role can't be changed", 403);

      await db.groupMember.update({
        where: { groupId_userId: { groupId, userId: targetUserId } },
        data: { role: newRole },
      });
      return Response.json({ ok: true, role: newRole });
    }

    if (action === "approve") {
      const updated = await db.groupMember.update({
        where: { groupId_userId: { groupId, userId: targetUserId } },
        data: { status: "active" },
        select: { status: true },
      }).catch(() => null);
      if (!updated) return jsonError("That membership request no longer exists", 404);
      // Welcome the new member (best-effort).
      const group = await db.group.findUnique({ where: { id: groupId }, select: { name: true } });
      await notify({
        userId: targetUserId,
        actorId: session.user.id,
        type: "follow", // reuse the follow notification shape (social bell)
        postId: null,
      }).catch(() => {});
      return Response.json({ ok: true, status: "active", groupName: group?.name ?? null });
    }

    // remove — managers can remove ordinary members; only owner/admin can
    // remove moderators/admins; the owner can never be removed.
    const target = await db.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: targetUserId } },
      select: { role: true },
    });
    if (!target) return jsonError("That membership no longer exists", 404);
    if (target.role === "owner") return jsonError("The owner can't be removed", 403);
    if ((target.role === "admin" || target.role === "moderator") && me.role === "moderator") {
      return jsonError("Moderators can only remove ordinary members", 403);
    }
    await db.groupMember.delete({
      where: { groupId_userId: { groupId, userId: targetUserId } },
    }).catch(() => {});
    return Response.json({ ok: true });
  } catch (err) {
    if (isMissingSchema(err)) return jsonError("Groups are being set up — try again soon", 503);
    console.error("[social/groups/[id]/members] PATCH failed:", err);
    return jsonError("Failed to update member", 500);
  }
}
