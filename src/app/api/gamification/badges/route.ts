import { NextResponse } from "next/server";

import { getAuthUser } from "@/lib/auth-server";
import { db } from "@/lib/db";
import { BADGE_DEFINITIONS, checkAndAwardBadges } from "@/lib/badges";

/**
 * GET /api/gamification/badges
 * Returns all badge definitions + which badges the user has unlocked.
 *
 * POST /api/gamification/badges
 * Checks and awards any newly-earned badges.
 *
 * The award rules themselves live in src/lib/badges.ts and are shared with
 * /api/trivia/submit so quiz badges are granted the moment a quiz completes.
 */

export async function GET() {
  try {
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    const userId = authUser.id;

    const userBadges = await db.userBadge.findMany({
      where: { userId },
      orderBy: { unlockedAt: "desc" },
    });

    const unlockedMap = new Map(userBadges.map((b) => [b.badgeId, b]));

    return NextResponse.json({
      badges: BADGE_DEFINITIONS.map((def) => ({
        ...def,
        unlocked: unlockedMap.has(def.id),
        unlockedAt: unlockedMap.get(def.id)?.unlockedAt || null,
      })),
      totalUnlocked: userBadges.length,
      totalAvailable: BADGE_DEFINITIONS.length,
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

    const newlyAwarded = await checkAndAwardBadges(authUser.id);

    const totalUnlocked = await db.userBadge.count({ where: { userId: authUser.id } });

    return NextResponse.json({
      newlyAwarded,
      totalUnlocked,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
