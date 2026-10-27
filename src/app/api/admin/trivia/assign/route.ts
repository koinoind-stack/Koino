import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { db } from "@/lib/db";

/**
 * Admin: manually assign a Trivia Reward to a member.
 *
 * POST /api/admin/trivia/assign — { userId, giftId, adminNotes? }
 *
 * Atomic safeguards (interactive transaction):
 *  - gift must exist and be active
 *  - duplicate protection: @@unique([userId, giftId]) on GiftRedemption
 *    (P2002 → friendly "already has this reward" error)
 *  - physical rewards with tracked stock are conditionally decremented
 *    (never below zero); vouchers skip stock
 *  - no points are deducted (pointsSpent: 0, source: "admin_assigned")
 */

export async function POST(req: NextRequest) {
  try {
    const admin = await getAuthUser();
    if (!admin) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    if (admin.role !== "admin") return NextResponse.json({ error: "Admin access required" }, { status: 403 });

    const body = await req.json().catch(() => null);
    const userId = typeof body?.userId === "string" ? body.userId.trim() : "";
    const giftId = typeof body?.giftId === "string" ? body.giftId.trim() : "";
    const adminNotes = typeof body?.adminNotes === "string" && body.adminNotes.trim()
      ? body.adminNotes.trim().slice(0, 500) : null;
    if (!userId || !giftId) return NextResponse.json({ error: "userId and giftId are required" }, { status: 400 });

    const gift = await db.gift.findFirst({ where: { giftId, isActive: true } });
    if (!gift) return NextResponse.json({ error: "Reward not found or disabled" }, { status: 404 });

    const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, email: true, username: true } });
    if (!user) return NextResponse.json({ error: "Member not found" }, { status: 404 });

    const usesStock = gift.deliveryType !== "voucher" && gift.stock > 0;

    const result = await db.$transaction(async (tx) => {
      if (usesStock) {
        const stockUpdate = await tx.gift.updateMany({
          where: { id: gift.id, stock: { gt: 0 } },
          data: { stock: { decrement: 1 } },
        });
        if (stockUpdate.count !== 1) throw new Error("OUT_OF_STOCK");
      }
      return tx.giftRedemption.create({
        data: {
          userId,
          giftId,
          giftDbId: gift.id,
          pointsSpent: 0,
          status: "pending",
          selectedVariations: "[]",
          source: "admin_assigned",
          adminNotes: adminNotes ? `${adminNotes} (assigned by ${admin.email})` : `Assigned by ${admin.email}`,
        },
        select: { id: true, userId: true, giftId: true, status: true },
      });
    }).catch((e: unknown) => {
      if (e instanceof Error && e.message === "OUT_OF_STOCK") {
        throw new Error("Rewards exhausted — no remaining stock");
      }
      const code = (e as { code?: string })?.code;
      if (code === "P2002") throw new Error("This member has already claimed or been assigned this reward");
      throw e;
    });

    return NextResponse.json({ success: true, assignment: result, member: { email: user.email, username: user.username } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Could not assign the reward";
    console.error("[admin/trivia/assign] failed:", e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
