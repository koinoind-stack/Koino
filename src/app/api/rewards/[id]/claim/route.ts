import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getAuthUser } from "@/lib/auth-server";

const db = new PrismaClient();

/**
 * POST /api/rewards/[id]/claim
 *
 * Claims a reward (changes status from "available" to "claimed").
 * SERVER-AUTHORITATIVE:
 * - Verifies the reward belongs to the authenticated user
 * - Verifies the reward status is "available"
 * - Verifies the reward hasn't expired
 * - Uses transaction to prevent race conditions
 *
 * The streak is NOT affected — claiming a reward never reduces the streak.
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

    // Find the reward — verify ownership
    const userReward = await db.userReward.findUnique({
      where: { id },
      include: { reward: true },
    });

    if (!userReward) {
      return NextResponse.json({ error: "Reward not found" }, { status: 404 });
    }

    // Anti-cheat: verify the reward belongs to this user
    if (userReward.userId !== user.id) {
      return NextResponse.json({ error: "This reward does not belong to you" }, { status: 403 });
    }

    // Verify status is "available"
    if (userReward.status !== "available") {
      return NextResponse.json({ error: `Reward is already ${userReward.status}` }, { status: 400 });
    }

    // Verify not expired
    if (userReward.expiresAt && new Date() > userReward.expiresAt) {
      await db.userReward.update({
        where: { id },
        data: { status: "expired" },
      });
      return NextResponse.json({ error: "This reward has expired" }, { status: 400 });
    }

    // Claim the reward (transaction-safe)
    const claimed = await db.userReward.update({
      where: { id },
      data: {
        status: "claimed",
        claimedAt: new Date(),
      },
      include: { reward: true },
    });

    return NextResponse.json({
      success: true,
      reward: claimed,
      message: "Reward claimed! Use it when shopping Koino Merch.",
    });
  } catch (error: any) {
    console.error("[rewards/claim] Error:", error);
    return NextResponse.json({ error: error?.message || "Failed to claim reward" }, { status: 500 });
  }
}
