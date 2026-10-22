import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getAuthUser } from "@/lib/auth-server";

const db = new PrismaClient();

/**
 * GET /api/rewards
 * Returns the authenticated user's rewards + streak info + milestones.
 */
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const streak = await db.userStreak.findUnique({ where: { userId: user.id } });
    const userRewards = await db.userReward.findMany({
      where: { userId: user.id },
      include: { reward: true, milestone: true },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    });
    const milestones = await db.streakMilestone.findMany({
      where: { active: true },
      orderBy: { streakDays: "asc" },
      include: { reward: true },
    });

    return NextResponse.json({
      streak: {
        currentStreak: streak?.currentStreak || 0,
        longestStreak: streak?.longestStreak || 0,
        totalActiveDays: streak?.totalActiveDays || 0,
      },
      rewards: userRewards,
      milestones,
    });
  } catch (error: any) {
    console.error("[rewards] GET error:", error);
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }
}
