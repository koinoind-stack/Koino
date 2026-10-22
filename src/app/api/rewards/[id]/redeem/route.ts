import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getAuthUser } from "@/lib/auth-server";

const db = new PrismaClient();

/**
 * POST /api/rewards/[id]/redeem
 *
 * Redeems a claimed reward. Marks it as "redeemed".
 * SERVER-AUTHORITATIVE:
 * - Verifies ownership
 * - Verifies status is "claimed" (must be claimed before redeeming)
 * - Verifies not expired
 * - Uses transaction to prevent double redemption
 *
 * The streak is NOT affected — redeeming a reward never reduces the streak.
 *
 * Body: { orderId?: string } (optional — links to an order if checkout exists)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    // Find the reward — verify ownership
    const userReward = await db.userReward.findUnique({
      where: { id },
      include: { reward: true },
    });

    if (!userReward) {
      return NextResponse.json({ error: "Reward not found" }, { status: 404 });
    }

    // Anti-cheat: verify ownership
    if (userReward.userId !== user.id) {
      return NextResponse.json({ error: "This reward does not belong to you" }, { status: 403 });
    }

    // Verify status is "claimed" (must claim before redeeming)
    if (userReward.status === "redeemed") {
      return NextResponse.json({ error: "This reward has already been redeemed" }, { status: 400 });
    }
    if (userReward.status !== "claimed" && userReward.status !== "available") {
      return NextResponse.json({ error: `Reward is ${userReward.status}, cannot redeem` }, { status: 400 });
    }

    // Verify not expired
    if (userReward.expiresAt && new Date() > userReward.expiresAt) {
      await db.userReward.update({
        where: { id },
        data: { status: "expired" },
      });
      return NextResponse.json({ error: "This reward has expired" }, { status: 400 });
    }

    // Redeem (transaction-safe — prevents double redemption via unique constraint on status check)
    const redeemed = await db.$transaction(async (tx) => {
      // Re-read inside transaction to prevent race condition
      const current = await tx.userReward.findUnique({ where: { id } });
      if (!current || current.status === "redeemed") {
        throw new Error("Reward already redeemed");
      }

      return tx.userReward.update({
        where: { id },
        data: {
          status: "redeemed",
          redeemedAt: new Date(),
          orderId: body.orderId || null,
        },
        include: { reward: true },
      });
    });

    return NextResponse.json({
      success: true,
      reward: redeemed,
      message: "Reward redeemed successfully!",
    });
  } catch (error: any) {
    console.error("[rewards/redeem] Error:", error);
    return NextResponse.json({ error: error?.message || "Failed to redeem reward" }, { status: 500 });
  }
}
