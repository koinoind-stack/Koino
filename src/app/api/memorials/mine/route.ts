import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, jsonError } from "@/lib/social/server";

/**
 * GET /api/memorials/mine — the signed-in member's memorials (any status),
 * so creators can find their drafts and continue later, and see review
 * outcomes. Includes the memorials they were invited to co-manage.
 */
export async function GET(_req: NextRequest) {
  const session = await getSessionUser();
  if (!session.user) return jsonError("Not authenticated", 401);
  const me = session.user;

  try {
    const rows = await db.memorial.findMany({
      where: { managers: { some: { userId: me.id } } },
      orderBy: { updatedAt: "desc" },
      take: 50,
      select: {
        id: true,
        fullName: true,
        photoUrl: true,
        status: true,
        visibility: true,
        rejectionReason: true,
        creatorName: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return Response.json({ memorials: rows });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "P2021" || code === "P2022") return Response.json({ memorials: [] });
    console.error("[memorials/mine] failed:", err);
    return jsonError("Could not load your memorials", 500);
  }
}
