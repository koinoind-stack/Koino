import { db } from "@/lib/db";

/**
 * Badge definitions + the single award-check used everywhere.
 *
 * The check is idempotent: UserBadge has @@unique([userId, badgeId]), so a
 * badge can never be granted twice no matter how many times this runs.
 *
 * Callers:
 *   - POST /api/gamification/badges (daily challenge + spin clients poll this)
 *   - /api/trivia/submit (badges are checked server-side on every scored quiz
 *     — before this, quiz badges like first_quiz / bible_scholar /
 *     perfect_score were UNREACHABLE because nothing ever ran the check
 *     after a quiz)
 */

export const BADGE_DEFINITIONS = [
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
] as const;

export type BadgeDefinition = (typeof BADGE_DEFINITIONS)[number];

export type NewlyAwardedBadge = {
  id: string;
  name: string;
  icon: string;
  description: string;
  unlockedAt: string;
};

/**
 * Re-evaluates every badge rule for the user and inserts rows for the ones
 * that are now satisfied but not yet stored. Returns ONLY the badges that
 * were newly created by this call (empty array = nothing new).
 */
export async function checkAndAwardBadges(userId: string): Promise<NewlyAwardedBadge[]> {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return [];

  const [quizSessions, correctAnswers, dailyChallengesCompleted, dailySpins, streakFreezesUsed] =
    await Promise.all([
      db.triviaQuizSession.count({ where: { userId, mode: "EARN_POINTS" } }),
      db.triviaQuestionAttempt.count({ where: { userId, answeredCorrectly: true } }),
      db.dailyChallengeAttempt.count({ where: { userId, isCorrect: true } }),
      db.dailySpin.count({ where: { userId } }),
      db.streakFreeze.count({ where: { userId } }),
    ]);

  // Perfect score = 100% on a 10+ question scored quiz.
  const perfectQuiz = await db.triviaQuizSession.findFirst({
    where: {
      userId,
      mode: "EARN_POINTS",
      totalQuestions: { gte: 10 },
      correctCount: { equals: db.triviaQuizSession.fields.totalQuestions },
    },
    select: { id: true },
  });

  const totalPoints = user.totalPoints;

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

  const existing = await db.userBadge.findMany({
    where: { userId },
    select: { badgeId: true },
  });
  const existingIds = new Set(existing.map((b) => b.badgeId));

  const newlyAwarded: NewlyAwardedBadge[] = [];
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
      newlyAwarded.push({
        id: def.id,
        name: def.name,
        icon: def.icon,
        description: def.description,
        unlockedAt: badge.unlockedAt.toISOString(),
      });
    }
  }

  return newlyAwarded;
}
