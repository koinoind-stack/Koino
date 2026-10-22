import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTier } from "@/lib/trivia-server";

/**
 * GET /api/trivia/leaderboard
 *
 * Returns real leaderboard data from the database.
 * Ranks users by lifetime Faith Points (server-side totalPoints).
 *
 * No client can submit their own score — this is read-only from DB.
 */
export async function GET() {
  try {
    const topUsers = await db.user.findMany({
      where: { totalPoints: { gt: 0 } },
      orderBy: { totalPoints: "desc" },
      take: 50,
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        totalPoints: true,
      },
    });

    const leaderboard = topUsers.map((u, i) => {
      const tier = getTier(u.totalPoints);
      // Show name, or derive from email if no name set
      const displayName = u.name || u.email.split("@")[0];
      // Mask email for privacy: show only first 2 chars + ***
      const maskedEmail = u.email.length > 4
        ? u.email.slice(0, 2) + "***" + u.email.slice(u.email.indexOf("@"))
        : "***";
      return {
        rank: i + 1,
        name: displayName,
        emailMasked: maskedEmail,
        image: u.image,
        points: u.totalPoints,
        tier: tier.current.title,
        tierIcon: tier.current.icon,
      };
    });

    return NextResponse.json({ leaderboard });
  } catch (error: any) {
    console.error("[trivia/leaderboard] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
