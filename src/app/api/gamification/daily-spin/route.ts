import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getAuthUser } from "@/lib/auth-server";

const db = new PrismaClient();

/**
 * GET /api/gamification/daily-spin
 * Returns whether user can spin today + their spin history.
 *
 * POST /api/gamification/daily-spin
 * Spins the wheel. Server picks random reward. One spin per day.
 */

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Reward configuration with probabilities (like a slot machine)
const REWARDS = [
  { type: "fp_5", value: 5, label: "5 Faith Points", icon: "✨", rarity: "common", weight: 35 },
  { type: "fp_10", value: 10, label: "10 Faith Points", icon: "⭐", rarity: "common", weight: 25 },
  { type: "fp_25", value: 25, label: "25 Faith Points", icon: "🌟", rarity: "uncommon", weight: 18 },
  { type: "fp_50", value: 50, label: "50 Faith Points", icon: "💫", rarity: "rare", weight: 10 },
  { type: "streak_freeze", value: 1, label: "Streak Freeze", icon: "🛡️", rarity: "rare", weight: 7 },
  { type: "double_fp", value: 1, label: "2x FP Next Quiz", icon: "🔥", rarity: "epic", weight: 3 },
  { type: "fp_100", value: 100, label: "100 Faith Points!", icon: "👑", rarity: "legendary", weight: 2 },
];

function pickReward() {
  const totalWeight = REWARDS.reduce((sum, r) => sum + r.weight, 0);
  let random = Math.random() * totalWeight;
  for (const reward of REWARDS) {
    random -= reward.weight;
    if (random <= 0) return reward;
  }
  return REWARDS[0]; // fallback
}

const RARITY_COLORS: Record<string, string> = {
  common: "#94A3B8",
  uncommon: "#22C55E",
  rare: "#3B82F6",
  epic: "#A855F7",
  legendary: "#F59E0B",
};

export async function GET() {
  try {
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const today = todayStr();
    const existingSpin = await db.dailySpin.findUnique({
      where: { userId_spinDate: { userId: authUser.id, spinDate: today } },
    });

    // Get last 7 spins for history
    const recentSpins = await db.dailySpin.findMany({
      where: { userId: authUser.id },
      orderBy: { createdAt: "desc" },
      take: 7,
    });

    return NextResponse.json({
      canSpin: !existingSpin,
      todayResult: existingSpin
        ? {
            type: existingSpin.rewardType,
            value: existingSpin.rewardValue,
            reward: REWARDS.find((r) => r.type === existingSpin.rewardType),
          }
        : null,
      history: recentSpins.map((s) => ({
        date: s.spinDate,
        type: s.rewardType,
        value: s.rewardValue,
        reward: REWARDS.find((r) => r.type === s.rewardType),
      })),
      rewards: REWARDS.map((r) => ({ ...r, color: RARITY_COLORS[r.rarity] })),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST() {
  try {
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    const userId = authUser.id;
    const today = todayStr();

    // Check if already spun today
    const existing = await db.dailySpin.findUnique({
      where: { userId_spinDate: { userId, spinDate: today } },
    });
    if (existing) {
      return NextResponse.json({
        error: "You already spun today. Come back tomorrow!",
        reward: REWARDS.find((r) => r.type === existing.rewardType),
      }, { status: 400 });
    }

    // Pick random reward
    const reward = pickReward();

    // Record the spin
    await db.dailySpin.create({
      data: {
        userId,
        rewardType: reward.type,
        rewardValue: reward.value,
        spinDate: today,
      },
    });

    // Award the reward
    if (reward.type.startsWith("fp_")) {
      // Award Faith Points
      await db.user.update({
        where: { id: userId },
        data: { totalPoints: { increment: reward.value } },
      });
      await db.triviaPointTransaction.create({
        data: {
          userId,
          points: reward.value,
          reason: `DAILY_SPIN:${reward.type}`,
        },
      });
    }
    // streak_freeze and double_fp rewards are stored but need client-side handling
    // (streak_freeze: stored in DailySpin, checked by streaks logic)
    // (double_fp: stored, checked by quiz submit — TODO: wire into submit)

    const updatedUser = await db.user.findUnique({ where: { id: userId } });

    return NextResponse.json({
      reward: { ...reward, color: RARITY_COLORS[reward.rarity] },
      newTotalPoints: updatedUser?.totalPoints || 0,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
