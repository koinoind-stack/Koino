import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getAuthUser } from "@/lib/auth-server";

const db = new PrismaClient();

/**
 * GET /api/trivia/competitions/[id]/leaderboard
 *
 * Returns the competition leaderboard (best attempt per user, ranked).
 * Public — no auth required to view the leaderboard.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: competitionId } = await params;
    const user = await getAuthUser();

    const allAttempts = await db.triviaCompetitionAttempt.findMany({
      where: { competitionId },
      orderBy: [
        { score: "desc" },
        { correctCount: "desc" },
        { accuracy: "desc" },
        { durationMs: "asc" },
        { createdAt: "asc" },
      ],
      include: {
        user: {
          select: { id: true, username: true, name: true, image: true },
        },
      },
    });

    // Deduplicate by userId (keep only best per user)
    const bestPerUser = new Map<string, typeof allAttempts[0]>();
    for (const attempt of allAttempts) {
      if (!bestPerUser.has(attempt.userId)) {
        bestPerUser.set(attempt.userId, attempt);
      }
    }

    const ranked = Array.from(bestPerUser.values()).map((a, i) => ({
      rank: i + 1,
      userId: a.userId,
      username: a.user.username || a.user.name || "Anonymous",
      image: a.user.image,
      score: a.score,
      correctCount: a.correctCount,
      totalQuestions: a.totalQuestions,
      accuracy: a.accuracy,
      isCurrentUser: user?.id === a.userId,
    }));

    const myRank = user ? ranked.find((r) => r.isCurrentUser) : null;

    return NextResponse.json({
      leaderboard: ranked,
      myRank: myRank ? { rank: myRank.rank, score: myRank.score, correctCount: myRank.correctCount, accuracy: myRank.accuracy } : null,
      totalParticipants: ranked.length,
    });
  } catch (error: any) {
    console.error("[trivia/competitions/leaderboard] Error:", error);
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }
}
