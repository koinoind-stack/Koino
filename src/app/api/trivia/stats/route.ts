import { NextResponse } from "next/server";
import { getAuthUserFromDB } from "@/lib/auth-server";
import { getTier } from "@/lib/trivia-server";
import { db } from "@/lib/db";

/**
 * GET /api/trivia/stats
 *
 * Returns the authenticated user's verified stats from the SERVER.
 * The browser never stores these — this is the source of truth.
 */
export async function GET() {
  try {
    const user = await getAuthUserFromDB();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    // Count how many unique questions this user has scored
    const scoredCount = await db.triviaQuestionAttempt.count({
      where: { userId: user.id, pointsAwarded: { gt: 0 } },
    });

    // Count total available questions
    const totalQuestions = await db.triviaQuestion.count({
      where: { isActive: true },
    });

    // Get quiz sessions
    const quizSessions = await db.triviaQuizSession.count({
      where: { userId: user.id },
    });

    // Get best streak across all sessions
    const bestStreakResult = await db.triviaQuizSession.findFirst({
      where: { userId: user.id, mode: "EARN_POINTS" },
      orderBy: { bestStreak: "desc" },
      select: { bestStreak: true },
    });

    const tier = getTier(user.totalPoints);

    return NextResponse.json({
      totalPoints: user.totalPoints,
      gamesPlayed: quizSessions,
      bestStreak: bestStreakResult?.bestStreak || 0,
      questionsScored: scoredCount,
      totalQuestions,
      tier: tier.current,
      nextTier: tier.next,
      tierProgress: tier.progress,
      // Migration notice: if user has old localStorage points, show this
      migrationNotice: "Faith Points are now tracked securely. Your verified balance is shown above.",
    });
  } catch (error: any) {
    console.error("[trivia/stats] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
