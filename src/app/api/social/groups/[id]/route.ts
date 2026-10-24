import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, jsonError } from "@/lib/social/server";
import { isMissingSchema, parseGroupFields } from "@/lib/social/group-fields";

/**
 * GET /api/social/groups/[id]
 *
 * Group detail: group + active members + the viewer's membership state and
 * permission flags. Private groups hide members/posts/events from
 * non-members (they only see the public card: name, description, category,
 * member count). Managers (owner/admin/moderator) also get the pending join
 * requests so they can approve or decline people.
 *
 * PATCH /api/social/groups/[id] — edit the group. Server-enforced: only the
 * owner and role=admin members may change settings. Moderators and ordinary
 * members are rejected with 403 (do not rely on the UI to hide the button).
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
        coverImage: true,
        logoUrl: true,
        city: true,
        state: true,
        language: true,
        joinMode: true,
        memberPostPermission: true,
        rules: true,
        pinnedPostId: true,
        churchId: true,
        churchName: true,
        churchVerified: true,
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

    const role = myMembership?.status === "active" ? myMembership.role : null;
    const isOwner = role === "owner";
    const isAdmin = role === "admin";
    const isModerator = role === "moderator";
    const isMember = !!role;
    const isPublic = group.visibility === "public";
    const canManage = isOwner || isAdmin;
    const canModerate = canManage || isModerator;

    // Private group + non-member: public card only
    if (!isPublic && !isMember) {
      return Response.json({
        group: { ...group, memberCount: group._count.members, pinnedPostId: null },
        viewer: { status: myMembership?.status ?? null, role: myMembership?.role ?? null },
        permissions: { canManage: false, canModerate: false, canPost: false },
        members: [],
        pending: [],
        pinnedPost: null,
        restricted: true,
      });
    }

    const memberRows = await db.groupMember.findMany({
      where: { groupId: id, status: "active" },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }], // owner → admin → moderator → member, oldest first
      take: 200,
      select: {
        role: true,
        createdAt: true,
        user: { select: { id: true, name: true, username: true, image: true } },
      },
    });

    let pending: Array<{ id: string; user: { id: string; name: string | null; username: string | null; image: string | null } }> = [];
    if (canModerate) {
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

    // Pinned announcement — lazy cleanup if the underlying post was deleted.
    let pinnedPost: {
      id: string;
      content: string | null;
      mediaType: string;
      mediaUrls: string[];
      createdAt: string;
      author: { id: string; name: string | null; username: string | null; image: string | null };
    } | null = null;
    if (group.pinnedPostId) {
      const p = await db.post.findUnique({
        where: { id: group.pinnedPostId },
        select: {
          id: true,
          content: true,
          mediaType: true,
          mediaUrls: true,
          createdAt: true,
          author: { select: { id: true, name: true, username: true, image: true } },
        },
      }).catch(() => null);
      if (p) {
        pinnedPost = { ...p, mediaUrls: safeParseUrls(p.mediaUrls), createdAt: p.createdAt.toISOString() };
      } else if (canManage) {
        // The post is gone — detach the pin so the flag doesn't linger.
        await db.group.update({ where: { id }, data: { pinnedPostId: null } }).catch(() => {});
      }
    }

    return Response.json({
      group: { ...group, memberCount: group._count.members },
      viewer: { status: myMembership?.status ?? null, role: myMembership?.role ?? null },
      permissions: {
        canManage,
        canModerate,
        canPost: isMember && (group.memberPostPermission === "members" ? true : canManage),
      },
      members: memberRows.map((m) => ({ role: m.role, joinedAt: m.createdAt, user: m.user })),
      pending,
      pinnedPost,
      restricted: false,
    });
  } catch (err) {
    if (isMissingSchema(err)) return jsonError("Groups are being set up — try again soon", 503);
    console.error("[social/groups/[id]] GET failed:", err);
    return jsonError("Failed to load group", 500);
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionUser();
  if (!session.user) return jsonError("Not authenticated", 401);
  const me = session.user.id;
  const { id } = await ctx.params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid JSON body");
  }

  try {
    const myMembership = await db.groupMember.findUnique({
      where: { groupId_userId: { groupId: id, userId: me } },
      select: { role: true, status: true },
    });
    if (!myMembership || myMembership.status !== "active" || (myMembership.role !== "owner" && myMembership.role !== "admin")) {
      return jsonError("Only the group owner and admins can edit this group", 403);
    }

    const existing = await db.group.findUnique({ where: { id }, select: { id: true, visibility: true } });
    if (!existing) return jsonError("Group not found", 404);

    const data: Record<string, unknown> = {};

    if (body.name !== undefined) {
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (name.length < 3 || name.length > 60) return jsonError("Group name must be 3-60 characters");
      data.name = name;
    }
    if (body.description !== undefined) {
      const d = typeof body.description === "string" ? body.description.trim().slice(0, 500) : "";
      data.description = d || null;
    }
    if (body.category !== undefined) {
      const CATEGORIES = ["youth", "bible-study", "prayer", "worship", "entrepreneurs", "church", "fellowship"];
      data.category = CATEGORIES.includes(String(body.category)) ? String(body.category) : "fellowship";
    }
    if (body.visibility !== undefined) {
      data.visibility = body.visibility === "private" ? "private" : "public";
    }
    if (body.joinMode !== undefined) {
      data.joinMode = body.joinMode === "approval" ? "approval" : "open";
      // Private groups always require approval.
      if (data.visibility === "private" || (data.visibility === undefined && existing.visibility === "private")) {
        data.joinMode = "approval";
      }
    }
    if (body.memberPostPermission !== undefined) {
      data.memberPostPermission = body.memberPostPermission === "admins" ? "admins" : "members";
    }

    const parsed = await parseGroupFields(body);
    if (parsed.error) return jsonError(parsed.error, parsed.status);
    Object.assign(data, parsed.data);

    const group = await db.group.update({
      where: { id },
      data,
      select: {
        id: true, name: true, description: true, category: true,
        visibility: true, coverGradient: true, coverImage: true, logoUrl: true,
        city: true, state: true, language: true, joinMode: true,
        memberPostPermission: true, rules: true, churchId: true, churchName: true,
        churchVerified: true,
      },
    });
    return Response.json({ group });
  } catch (err) {
    if (isMissingSchema(err)) return jsonError("Groups are being set up — try again soon", 503);
    console.error("[social/groups/[id]] PATCH failed:", err);
    return jsonError("Failed to update group", 500);
  }
}

function safeParseUrls(raw: string): string[] {
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((u): u is string => typeof u === "string") : [];
  } catch {
    return [];
  }
}
