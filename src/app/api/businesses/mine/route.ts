import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, jsonError } from "@/lib/social/server";
import { safeParseArray } from "@/lib/marketplace";

/**
 * GET /api/businesses/mine — the signed-in member's own submissions (any status).
 */
export async function GET() {
  const session = await getSessionUser();
  if (!session.user) {
    if (session.code === "ACCOUNT_INACTIVE") return jsonError(session.error!, 403);
    return jsonError("Not authenticated", 401);
  }
  try {
    const rows = await db.business.findMany({
      where: { ownerId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true, name: true, description: true, category: true, state: true, city: true,
        images: true, coverGradient: true, status: true, rejectionReason: true,
        verified: true, featured: true, createdAt: true,
      },
    });
    return Response.json({
      businesses: rows.map((b) => ({
        ...b,
        images: safeParseArray(b.images),
        createdAt: b.createdAt.toISOString(),
      })),
    });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "P2021" || code === "P2022") return Response.json({ businesses: [] });
    console.error("[businesses/mine] failed:", err);
    return jsonError("Could not load your submissions", 500);
  }
}
