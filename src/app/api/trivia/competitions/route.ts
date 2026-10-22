import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getAuthUser } from "@/lib/auth-server";

const db = new PrismaClient();

/**
 * GET /api/trivia/competitions
 *
 * Returns all competitions (live, upcoming, ended) for the public Trivia
 * Compete tab. Also returns the user's rank + attempts for live competitions.
 *
 * Public — no auth required to view competitions.
 * Auth required to see "your rank" + "your attempts" per competition.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    const now = new Date();

    const competitions = await db.triviaCompetition.findMany({
      where: { status: { in: ["scheduled", "live", "ended"] } },
      orderBy: [{ status: "asc" }, { startAt: "desc" }],
      include: {
        prize: true,
      },
    });

    // For each competition, compute time remaining + user's best score + rank
    const enriched = await Promise.all(
      competitions.map(async (c) => {
        const isLive = c.status === "live" && now >= c.startAt && now < c.endAt;
        const hasEnded = c.status === "ended" || now >= c.endAt;
        const timeRemaining = hasEnded ? 0 : c.endAt.getTime() - now.getTime();

        // Count participants (distinct users with attempts)
        const participantCount = await db.triviaCompetitionAttempt.count({
          where: { competitionId: c.id },
        });

        // If user is logged in, get their best score + rank
        let userBestScore: number | null = null;
        let userRank: number | null = null;
        let userAttemptsUsed: number = 0;

        if (user) {
          const attempts = await db.triviaCompetitionAttempt.findMany({
            where: { competitionId: c.id, userId: user.id },
            orderBy: { score: "desc" },
          });
          userAttemptsUsed = attempts.length;
          if (attempts.length > 0) {
            userBestScore = attempts[0].score;
            // Rank = number of users with a higher best score + 1
            const higherScorers = await db.triviaCompetitionAttempt.findMany({
              where: {
                competitionId: c.id,
                score: { gt: userBestScore },
              },
              distinct: ["userId"],
            });
            userRank = higherScorers.length + 1;
          }
        }

        return {
          id: c.id,
          title: c.title,
          description: c.description,
          imageUrl: c.imageUrl,
          type: c.type,
          category: c.category,
          difficulty: c.difficulty,
          questionCount: c.questionCount,
          attemptLimit: c.attemptLimit,
          winnerCount: c.winnerCount,
          rules: c.rules,
          status: isLive ? "live" : hasEnded ? "ended" : c.status,
          startAt: c.startAt,
          endAt: c.endAt,
          claimDeadlineDays: c.claimDeadlineDays,
          timeRemaining,
          participantCount,
          prize: c.prize
            ? {
                id: c.prize.id,
                name: c.prize.name,
                imageUrl: c.prize.imageUrl,
                description: c.prize.description,
                requiresShipping: c.prize.requiresShipping,
                remainingQuantity: c.prize.remainingQuantity,
              }
            : null,
          userBestScore,
          userRank,
          userAttemptsUsed,
          userAttemptsRemaining: Math.max(0, c.attemptLimit - userAttemptsUsed),
        };
      })
    );

    return NextResponse.json({ competitions: enriched });
  } catch (error: any) {
    console.error("[trivia/competitions] Error:", error);
    return NextResponse.json({ error: error?.message || "Failed to load competitions" }, { status: 500 });
  }
}
