import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getAuthUser } from "@/lib/auth-server";

const db = new PrismaClient();

/**
 * POST /api/streak/record
 *
 * Records a streak day for the authenticated user. SERVER-AUTHORITATIVE:
 * - userId from auth session
 * - One calendar day = one streak day (idempotent — calling twice on the
 *   same day is a no-op)
 * - After recording, checks milestones and creates UserReward if eligible
 *
 * Body: { activity: "bible_reading" | "trivia_play" }
 * (activity is for future use — currently unified into one streak)
 *
 * Returns: { currentStreak, longestStreak, isActiveToday, newRewards: [] }
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Get today's date in server time (YYYY-MM-DD)
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;

    // Get or create user streak
    let streak = await db.userStreak.findUnique({ where: { userId: user.id } });
    if (!streak) {
      streak = await db.userStreak.create({
        data: { userId: user.id, currentStreak: 0, longestStreak: 0, lastActiveDate: null, totalActiveDays: 0 },
      });
    }

    // If already active today, no-op
    if (streak.lastActiveDate === today) {
      return NextResponse.json({
        currentStreak: streak.currentStreak,
        longestStreak: streak.longestStreak,
        isActiveToday: true,
        newRewards: [],
      });
    }

    // Calculate new streak
    let newStreak: number;
    if (streak.lastActiveDate === yesterdayStr) {
      // Continued streak
      newStreak = streak.currentStreak + 1;
    } else if (!streak.lastActiveDate) {
      // First ever activity
      newStreak = 1;
    } else {
      // Streak broken — restart at 1
      newStreak = 1;
    }

    // Update streak
    streak = await db.userStreak.update({
      where: { userId: user.id },
      data: {
        currentStreak: newStreak,
        longestStreak: Math.max(streak.longestStreak, newStreak),
        lastActiveDate: today,
        totalActiveDays: streak.totalActiveDays + 1,
      },
    });

    // ─── Check milestones + create rewards (idempotent) ───
    const newRewards: any[] = [];
    const milestones = await db.streakMilestone.findMany({
      where: { active: true, streakDays: newStreak },
      include: { reward: true },
    });

    for (const milestone of milestones) {
      if (!milestone.reward || !milestone.reward.active) continue;

      // Check if user already has this milestone reward (once-ever default)
      // @@unique([userId, milestoneId]) prevents duplicates
      const existing = await db.userReward.findUnique({
        where: {
          userId_milestoneId: { userId: user.id, milestoneId: milestone.id },
        },
      });

      if (!existing) {
        // Calculate expiration
        let expiresAt: Date | null = null;
        if (milestone.reward.expiresAfterDays) {
          expiresAt = new Date(now.getTime() + milestone.reward.expiresAfterDays * 24 * 60 * 60 * 1000);
        }

        // Generate a unique redemption code
        const redemptionCode = `KOINO-${milestone.streakDays}D-${user.id.slice(-6).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

        const userReward = await db.userReward.create({
          data: {
            userId: user.id,
            rewardId: milestone.rewardId,
            milestoneId: milestone.id,
            source: "streak_milestone",
            sourceMilestone: newStreak,
            status: "available",
            redemptionCode,
            expiresAt,
          },
          include: { reward: true, milestone: true },
        });
        newRewards.push(userReward);
      }
    }

    return NextResponse.json({
      currentStreak: streak.currentStreak,
      longestStreak: streak.longestStreak,
      isActiveToday: true,
      newRewards,
    });
  } catch (error: any) {
    // If it's a unique constraint violation (duplicate milestone reward),
    // it means the reward was already created — return success
    if (error?.code === "P2002") {
      return NextResponse.json({ message: "Streak recorded (reward already exists)" });
    }
    console.error("[streak/record] Error:", error);
    return NextResponse.json({ error: error?.message || "Failed to record streak" }, { status: 500 });
  }
}

/**
 * GET /api/streak/record
 * Returns the current user's streak info + available rewards.
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
      orderBy: { createdAt: "desc" },
    });

    // Get active milestones for progress display
    const milestones = await db.streakMilestone.findMany({
      where: { active: true },
      orderBy: { streakDays: "asc" },
      include: { reward: true },
    });

    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;

    const currentStreak = streak?.currentStreak || 0;
    const isActiveToday = streak?.lastActiveDate === today;
    // If last active was yesterday, streak is "alive" but not yet done today
    const displayStreak = streak?.lastActiveDate === today || streak?.lastActiveDate === yesterdayStr
      ? currentStreak
      : 0;

    return NextResponse.json({
      streak: {
        currentStreak: displayStreak,
        longestStreak: streak?.longestStreak || 0,
        totalActiveDays: streak?.totalActiveDays || 0,
        isActiveToday,
        lastActiveDate: streak?.lastActiveDate || null,
      },
      rewards: userRewards,
      milestones,
    });
  } catch (error: any) {
    console.error("[streak/record] GET error:", error);
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }
}
