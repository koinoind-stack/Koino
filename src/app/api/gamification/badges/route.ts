import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getAuthUser } from "@/lib/auth-server";

const db = new PrismaClient();

/**
 * GET /api/gamification/badges
 * Returns all badge definitions + which badges the user has unlocked.
 *
 * POST /api/gamification/badges
 * Checks and awards any newly-earned badges.
 */

// Badge definitions
const BADGE_DEFINITIONS = [
  { id: "first_streak", name: "First Streak", icon: "🔥", description: "Maintain a 3-day streak" },
  { id: "week_warrior", name: "Week Warrior", icon: "⚔️", description: "Maintain a 7-day streak" },
  { id: "month_master", name: "Month Master", icon: "🏆", description: "Maintain a 30-day streak" },
  { id: "first_quiz", name: "First Steps", icon: "🎯", description: "Complete your first quiz" },
  { id: "quiz_master", name: "Quiz Master", icon: "🎓", description: "Complete 10 quizzes" },
  { id: "quiz_addict", name: "Quiz Addict", icon: "💊", description: "Complete 50 quizzes" },
  { id: "bible_scholar", name: "Bible Scholar", icon: "📖", description: "Answer 100 questions correctly" },
  { id: "perfect_score", name: "Perfectionist", icon: "💯", description: "Get 100% on a 10+ question quiz" },
  { id: "fp_500", name: "Faithful", icon: "✨", description: "Earn 500 Faith Points" },
  { id: "fp_5000", name: "Warrior of the Word", icon: "⚔️", description: "Earn 5,000 Faith Points" },
  { id: "fp_10000", name: "Bible Master", icon: "👑", description: "Earn 10,000 Faith Points" },
  { id: "daily_devotee", name: "Daily Devotee", icon: "🌟", description: "Complete 7 daily challenges" },
  { id: "lucky_spinner", name: "Lucky Spinner", icon: "🎰", description: "Spin the daily wheel 7 times" },
  { id: "streak_freeze_user", name: "Protected", icon: "🛡️", description: "Use a streak freeze" },
];

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
    const userId = authUser.id;

    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Get user stats for badge checking
    const quizSessions = await db.triviaQuizSession.count({
      where: { userId, mode: "EARN_POINTS" },
    });
    const correctAnswers = await db.triviaQuestionAttempt.count({
      where: { userId, answeredCorrectly: true },
    });
    const dailyChallengesCompleted = await db.dailyChallengeAttempt.count({
      where: { userId, isCorrect: true },
    });
    const dailySpins = await db.dailySpin.count({ where: { userId } });
    const streakFreezesUsed = await db.streakFreeze.count({ where: { userId } });

    // Check for perfect score quiz (100% on 10+ questions)
    const perfectQuiz = await db.triviaQuizSession.findFirst({
      where: {
        userId,
        mode: "EARN_POINTS",
        totalQuestions: { gte: 10 },
        correctCount: { equals: db.triviaQuizSession.fields.totalQuestions },
      },
    });

    // Check for 7-day streak (from localStorage streaks — stored in DB in production)
    // For now, we check totalPoints as a proxy
    const totalPoints = user.totalPoints;

    // Determine which badges should be unlocked
    const checks: Record<string, boolean> = {
      first_streak: dailyChallengesCompleted >= 1 || quizSessions >= 3, // simplified
      week_warrior: quizSessions >= 10, // simplified
      month_master: quizSessions >= 30, // simplified
      first_quiz: quizSessions >= 1,
      quiz_master: quizSessions >= 10,
      quiz_addict: quizSessions >= 50,
      bible_scholar: correctAnswers >= 100,
      perfect_score: !!perfectQuiz,
      fp_500: totalPoints >= 500,
      fp_5000: totalPoints >= 5000,
      fp_10000: totalPoints >= 10000,
      daily_devotee: dailyChallengesCompleted >= 7,
      lucky_spinner: dailySpins >= 7,
      streak_freeze_user: streakFreezesUsed >= 1,
    };

    // Get existing badges
    const existing = await db.userBadge.findMany({ where: { userId } });
    const existingIds = new Set(existing.map((b) => b.badgeId));

    // Award new badges
    const newlyAwarded: any[] = [];
    for (const def of BADGE_DEFINITIONS) {
      if (checks[def.id] && !existingIds.has(def.id)) {
        const badge = await db.userBadge.create({
          data: {
            userId,
            badgeId: def.id,
            badgeName: def.name,
            badgeIcon: def.icon,
            badgeDescription: def.description,
          },
        });
        newlyAwarded.push({ ...def, unlockedAt: badge.unlockedAt });
      }
    }

    return NextResponse.json({
      newlyAwarded,
      totalUnlocked: existing.length + newlyAwarded.length,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
