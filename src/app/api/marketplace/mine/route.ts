import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, jsonError } from "@/lib/social/server";
import { validateImages, str, int, validPrice, validPhone, validCategory, validLocation, serializeMemberListing } from "@/lib/marketplace";

/**
 * GET /api/marketplace/mine — the signed-in member's own listings (any status).
 */
export async function GET() {
  const session = await getSessionUser();
  if (!session.user) {
    if (session.code === "ACCOUNT_INACTIVE") return jsonError(session.error!, 403);
    return jsonError("Not authenticated", 401);
  }
  try {
    const rows = await db.marketplaceListing.findMany({
      where: { sellerId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return Response.json({
      listings: rows.map((r) => ({
        ...serializeMemberListing(r),
        status: r.status,
        rejectionReason: r.rejectionReason,
        reviewedAt: r.reviewedAt?.toISOString() || null,
      })),
    });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "P2021" || code === "P2022") return Response.json({ listings: [] });
    console.error("[marketplace/mine] failed:", err);
    return jsonError("Could not load your listings", 500);
  }
}
