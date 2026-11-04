import { NextRequest, NextResponse } from "next/server";

import { getAuthUser } from "@/lib/auth-server";
import { db } from "@/lib/db";

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

/**
 * POST /api/admin/redemptions — reject a claim with an automatic points refund.
 * Body: { redemptionId, reason }
 *
 * Atomic transaction: deletes the claim (freeing the @@unique([userId, giftId])
 * slot so the member can fix issues and re-claim later), refunds the points
 * (unless the claim was admin-assigned with 0 points spent), restores gift
 * stock, and writes an auditable ledger row. Only claims still in
 * pending/contacted can be rejected — shipped/delivered gifts cannot.
 */
export async function POST(req: NextRequest) {
  try {
    const adminId = await requireAdmin();
    if (!adminId) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await req.json();
    const redemptionId = typeof body?.redemptionId === "string" ? body.redemptionId : "";
    const reason = typeof body?.reason === "string" && body.reason.trim()
      ? body.reason.trim().slice(0, 500) : "";
    if (!redemptionId) {
      return NextResponse.json({ error: "redemptionId required" }, { status: 400 });
    }
    if (!reason) {
      return NextResponse.json({ error: "Please give the member a short reason for the rejection" }, { status: 400 });
    }

    const existing = await db.giftRedemption.findUnique({
      where: { id: redemptionId },
      include: { gift: { select: { id: true, giftId: true, title: true } } },
    });
    if (!existing) {
      return NextResponse.json({ error: "Redemption not found" }, { status: 404 });
    }
    if (!["pending", "contacted"].includes(existing.status)) {
      return NextResponse.json(
        { error: `A claim that is ${existing.status} can no longer be rejected` },
        { status: 400 }
      );
    }

    await db.$transaction(async (tx) => {
      // 1. Remove the claim (frees the per-user uniqueness slot for re-claims).
      await tx.giftRedemption.delete({ where: { id: redemptionId } });

      // 2. Refund points (admin-assigned claims cost 0).
      if (existing.pointsSpent > 0) {
        await tx.user.update({
          where: { id: existing.userId },
          data: { totalPoints: { increment: existing.pointsSpent } },
        });
        await tx.triviaPointTransaction.create({
          data: {
            userId: existing.userId,
            points: existing.pointsSpent,
            reason: `GIFT_REDEMPTION_REFUND:${existing.gift.giftId}:${existing.gift.title} — ${reason}`,
          },
        });
      }

      // 3. Restore stock (capped +1 even if the gift was deleted meanwhile).
      await tx.gift.update({
        where: { id: existing.giftDbId },
        data: { stock: { increment: 1 } },
      }).catch(() => null);
    });

    return NextResponse.json({
      success: true,
      redemptionId,
      refunded: existing.pointsSpent,
      giftTitle: existing.gift.title,
    });
  } catch (e: unknown) {
    console.error("[admin/redemptions] POST error:", e);
    return NextResponse.json({ error: "Could not reject the claim" }, { status: 500 });
  }
}
