import { db } from "@/lib/db";
import { getSessionUser, jsonError } from "@/lib/social/server";

/**
 * GET /api/churches/mine — the signed-in member's own church listings
 * (ANY status: PENDING, PUBLISHED, REJECTED, CANCELLED).
 *
 * This is the "My Listings" tab of the Church Directory: owners see the
 * review state of what they submitted (public /api/churches only ever
 * returns PUBLISHED, so pending/rejected listings would be invisible
 * there) and can edit each listing via PATCH /api/churches/[id].
 *
 * Shape mirrors /api/businesses/mine and the public /api/churches payload
 * (snake_case display fields) so the UI can render the same cards.
 * is_owner is always true here — every row belongs to the caller by
 * definition (server-filtered on createdById, never on client input).
 */
export async function GET() {
  const session = await getSessionUser();
  if (!session.user) {
    if (session.code === "ACCOUNT_INACTIVE") return jsonError(session.error!, 403);
    return jsonError("Not authenticated", 401);
  }

  try {
    const rows = await db.church.findMany({
      where: { createdById: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        name: true,
        description: true,
        denomination: true,
        type: true,
        state: true,
        city: true,
        address: true,
        location: true,
        whatsappNumber: true,
        contactPhone: true,
        contactEmail: true,
        website: true,
        serviceTimes: true,
        languages: true,
        coverImage: true,
        coverGradient: true,
        status: true,
        rejectionReason: true,
        verified: true,
        featured: true,
        createdAt: true,
        _count: { select: { followers: true } },
      },
    });

    return Response.json({
      churches: rows.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        denomination: c.denomination,
        type: c.type || "Church",
        state: c.state || "",
        city: c.city || "",
        address: c.address,
        location: c.location,
        whatsapp_number: c.whatsappNumber,
        contactPhone: c.contactPhone,
        contactEmail: c.contactEmail,
        website: c.website,
        service_times: safeParseJson(c.serviceTimes, []),
        languages: safeParseJson(c.languages, []),
        cover_image: c.coverImage || undefined,
        cover_gradient: c.coverGradient,
        status: c.status,
        rejectionReason: c.rejectionReason,
        verified: c.verified,
        featured: c.featured,
        followers_count: c._count.followers,
        is_owner: true,
        createdAt: c.createdAt.toISOString(),
      })),
    });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    // Migration not applied yet → empty list, not a 500 (same contract as
    // the public /api/churches GET and /api/businesses/mine).
    if (code === "P2021" || code === "P2022") return Response.json({ churches: [] });
    console.error("[churches/mine] failed:", err);
    return jsonError("Could not load your listings", 500);
  }
}

function safeParseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
