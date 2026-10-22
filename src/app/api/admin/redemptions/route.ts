import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getAuthUser } from "@/lib/auth-server";

const db = new PrismaClient();

// JSON columns stored as TEXT in SQLite — always fall back to [] if malformed.
function safeParseArray(raw: string | null | undefined): any[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function requireAdmin() {
  const authUser = await getAuthUser();
  if (!authUser) return null;
  if (authUser.role !== "admin") return null;
  return authUser.id;
}

/**
 * GET /api/admin/redemptions
 *
 * Returns every gift redemption (newest first) joined with the user + gift.
 * Used by the admin "Redemptions" tab so admins can see who claimed what,
 * the size/color they picked, and the current fulfilment status.
 */
export async function GET(req: NextRequest) {
  try {
    const adminId = await requireAdmin();
    if (!adminId) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    // Optional ?status=pending filter
    const url = new URL(req.url);
    const statusFilter = url.searchParams.get("status");

    const redemptions = await db.giftRedemption.findMany({
      where: statusFilter ? { status: statusFilter } : undefined,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
        gift: { select: { id: true, giftId: true, title: true, imageUrl: true, tier: true } },
      },
    });

    return NextResponse.json({
      redemptions: redemptions.map((r) => ({
        id: r.id,
        userId: r.userId,
        userName: r.user?.name || "—",
        userEmail: r.user?.email || "",
        userImage: r.user?.image || null,
        giftId: r.giftId,
        giftTitle: r.gift?.title || "—",
        giftImage: r.gift?.imageUrl || null,
        giftTier: r.gift?.tier || "",
        pointsSpent: r.pointsSpent,
        status: r.status,
        selectedVariations: safeParseArray(r.selectedVariations),
        createdAt: r.createdAt.toISOString(),
      })),
      counts: {
        total: redemptions.length,
        pending: redemptions.filter((r) => r.status === "pending").length,
        contacted: redemptions.filter((r) => r.status === "contacted").length,
        shipped: redemptions.filter((r) => r.status === "shipped").length,
        delivered: redemptions.filter((r) => r.status === "delivered").length,
      },
    });
  } catch (e: any) {
    console.error("[admin/redemptions] GET error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

/**
 * PUT /api/admin/redemptions
 *
 * Body: { redemptionId, status }
 * Updates the fulfilment status of a single redemption.
 * Allowed values: "pending" | "contacted" | "shipped" | "delivered"
 */
export async function PUT(req: NextRequest) {
  try {
    const adminId = await requireAdmin();
    if (!adminId) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await req.json();
    const { redemptionId, status } = body;

    if (!redemptionId || typeof redemptionId !== "string") {
      return NextResponse.json({ error: "redemptionId required" }, { status: 400 });
    }

    const allowed = ["pending", "contacted", "shipped", "delivered"];
    if (!allowed.includes(status)) {
      return NextResponse.json(
        { error: `status must be one of: ${allowed.join(", ")}` },
        { status: 400 }
      );
    }

    const existing = await db.giftRedemption.findUnique({
      where: { id: redemptionId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Redemption not found" }, { status: 404 });
    }

    await db.giftRedemption.update({
      where: { id: redemptionId },
      data: { status },
    });

    return NextResponse.json({ success: true, redemptionId, status });
  } catch (e: any) {
    console.error("[admin/redemptions] PUT error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
