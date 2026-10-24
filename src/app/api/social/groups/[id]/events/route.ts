import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, jsonError } from "@/lib/social/server";
import { isMissingSchema } from "@/lib/social/group-fields";

/**
 * GET /api/social/groups/[id]/events — events created inside a group.
 *
 * Reuses the EXISTING Event table (no duplicate event store). Visibility is
 * enforced server-side:
 *   - members-only events ("groupVisibility" = "members") are returned only
 *     to active members of the group;
 *   - private groups hide ALL their events from non-members;
 *   - public events from public groups are also eligible for the main
 *     Events section once an admin publishes them (status = PUBLISHED).
 *
 * Group members see PENDING events too (marked with a review badge so
 * managers know they're awaiting platform approval).
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionUser();
  if (!session.user) return jsonError("Not authenticated", 401);
  const me = session.user.id;
  const { id: groupId } = await ctx.params;

  try {
    const group = await db.group.findUnique({
      where: { id: groupId },
      select: { id: true, visibility: true },
    });
    if (!group) return jsonError("Group not found", 404);

    const membership = await db.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: me } },
      select: { status: true },
    });
    const isMember = membership?.status === "active";
    const isPublic = group.visibility === "public";

    // Private group + non-member: no event data at all.
    if (!isPublic && !isMember) {
      return Response.json({ events: [], restricted: true });
    }

    // Members-only events leak nothing to non-members.
    const where: Record<string, unknown> = { groupId };
    if (!isMember) where.groupVisibility = "public";

    const rows = await db.event.findMany({
      where,
      orderBy: { startDate: "asc" },
      take: 60,
      select: {
        id: true,
        title: true,
        description: true,
        startDate: true,
        endDate: true,
        startTime: true,
        endTime: true,
        allDay: true,
        location: true,
        venueName: true,
        eventType: true,
        isOnline: true,
        onlineUrl: true,
        registrationType: true,
        ticketUrl: true,
        isFree: true,
        price: true,
        organizerName: true,
        organizerEmail: true,
        organizerPhone: true,
        whatsappNumber: true,
        category: true,
        coverImage: true,
        coverGradient: true,
        status: true,
        featured: true,
        groupVisibility: true,
        createdById: true,
        createdAt: true,
      },
    });

    return Response.json({
      events: rows.map((e) => ({
        ...e,
        startDate: e.startDate.toISOString(),
        endDate: e.endDate ? e.endDate.toISOString() : null,
        createdAt: e.createdAt.toISOString(),
      })),
      restricted: false,
    });
  } catch (err) {
    if (isMissingSchema(err)) return jsonError("Group events are being set up — try again soon", 503);
    console.error("[social/groups/[id]/events] GET failed:", err);
    return jsonError("Failed to load group events", 500);
  }
}
