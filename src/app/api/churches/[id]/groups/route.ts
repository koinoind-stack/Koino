import { NextRequest } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/churches/[id]/groups — PUBLIC endpoint for the church detail view.
 *
 * Returns the PUBLIC groups affiliated with a PUBLISHED church. Display-only:
 * this proves nothing about authorisation — the official-affiliation badge is
 * a separate admin-controlled flag (Group.churchVerified) and linking never
 * grants any group permissions to church staff.
 *
 * Only safe, public-card fields are returned. Private groups are NEVER
 * included here (they are member-only everywhere outside the group itself).
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  try {
    const church = await db.church.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!church || church.status !== "PUBLISHED") {
      return Response.json({ groups: [] });
    }

    const rows = await db.group.findMany({
      where: { churchId: id, visibility: "public" },
      orderBy: { createdAt: "desc" },
      take: 24,
      select: {
        id: true,
        name: true,
        description: true,
        category: true,
        coverGradient: true,
        logoUrl: true,
        city: true,
        state: true,
        churchVerified: true,
        _count: { select: { members: { where: { status: "active" } } } },
      },
    });

    return Response.json({
      groups: rows.map(({ _count, ...g }) => ({ ...g, memberCount: _count.members })),
    });
  } catch (err) {
    // Missing table/columns (migration window) → empty list, never a 500.
    const e = err as { code?: string; message?: string };
    if (e?.code === "P2021" || e?.code === "P2022" || /does not exist/i.test(e?.message || "")) {
      return Response.json({ groups: [] });
    }
    console.error("[api/churches/[id]/groups] GET failed:", err);
    return Response.json({ groups: [], error: "Failed to load groups" }, { status: 500 });
  }
}
