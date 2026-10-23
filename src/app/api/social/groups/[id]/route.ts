import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, jsonError } from "@/lib/social/server";

/**
 * GET /api/social/groups/[id]
 *
 * Group detail: group + active members + the viewer's membership state.
 * Private groups hide members/posts from non-members (they only see the
 * public card: name, description, category, member count). Owners also get
 * the pending join requests so they can approve or remove people.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionUser();
  if (!session.user) return jsonError("Not authenticated", 401);
  const me = session.user.id;
  const { id } = await ctx.params;

  try {
    const group = await db.group.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        description: true,
        category: true,
        visibility: true,
        coverGradient: true,
        createdAt: true,
        createdBy: { select: { name: true, username: true, image: true } },
        _count: { select: { members: { where: { status: "active" } } } },
      },
    });
    if (!group) return jsonError("Group not found", 404);

    const myMembership = await db.groupMember.findUnique({
      where: { groupId_userId: { groupId: id, userId: me } },
      select: { status: true, role: true },
    });

    const isOwner = myMembership?.role === "owner" && myMembership.status === "active";
    const isMember = myMembership?.status === "active";
    const isPublic = group.visibility === "public";

    // Private group + non-member: public card only
    if (!isPublic && !isMember) {
      return Response.json({
        group: { ...group, memberCount: group._count.members },
        viewer: { status: myMembership?.status ?? null, role: myMembership?.role ?? null },
        members: [],
        pending: [],
        restricted: true,
      });
    }

    const memberRows = await db.groupMember.findMany({
      where: { groupId: id, status: "active" },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }], // owner first
      take: 60,
      select: {
        role: true,
        createdAt: true,
        user: { select: { id: true, name: true, username: true, image: true } },
      },
    });

    let pending: Array<{ id: string; user: { id: string; name: string | null; username: string | null; image: string | null } }> = [];
    if (isOwner) {
      pending = (
        await db.groupMember.findMany({
          where: { groupId: id, status: "pending" },
          orderBy: { createdAt: "asc" },
          take: 50,
          select: {
            id: true,
            user: { select: { id: true, name: true, username: true, image: true } },
          },
        })
      ).map((m) => ({ id: m.id, user: m.user }));
    }

    return Response.json({
      group: { ...group, memberCount: group._count.members },
      viewer: { status: myMembership?.status ?? null, role: myMembership?.role ?? null },
      members: memberRows.map((m) => ({ role: m.role, joinedAt: m.createdAt, user: m.user })),
      pending,
      restricted: false,
    });
  } catch (err) {
    if (isMissingTable(err)) return jsonError("Groups are being set up — try again soon", 503);
    console.error("[social/groups/[id]] GET failed:", err);
    return jsonError("Failed to load group", 500);
  }
}

function isMissingTable(err: unknown): boolean {
  const e = err as { code?: string; message?: string };
  return e?.code === "P2021" || /does not exist/i.test(e?.message || "");
}
