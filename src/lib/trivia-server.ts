import { PrismaClient } from "@prisma/client";

// Create PrismaClient directly to avoid Turbopack module issues
const db = new PrismaClient();

/**
 * Trivia scoring logic — SERVER-SIDE ONLY.
 *
 * Core anti-farming rule:
 *   A question can award Faith Points to a particular user ONLY ONCE.
 *   Enforced by @@unique([userId, questionId]) on TriviaQuestionAttempt.
 *
 * Scoring:
 *   New question, correct answer: basePoints + streakBonus
 *   Already-scored question: 0 FP (even if correct)
 *   Practice mode: 0 FP always
 *   Wrong answer: 0 FP always
 */

export const DIFFICULTY_POINTS: Record<string, number> = {
  beginners: 10,
  intermediate: 20,
  skilled: 30,
  expert: 50,
};

export const TIMER_SECONDS: Record<string, number> = {
  beginners: 30,
  intermediate: 20,
  skilled: 15,
  expert: 10,
};

export const PRIZE_TIERS = [
  { minPoints: 0, title: "Faith Seeker", icon: "🌱" },
  { minPoints: 100, title: "Bible Student", icon: "📖" },
  { minPoints: 500, title: "Spiritual Disciple", icon: "✝️" },
  { minPoints: 1500, title: "Bible Teacher", icon: "🎓" },
  { minPoints: 3000, title: "Theology Scholar", icon: "🏆" },
  { minPoints: 5000, title: "Word Warrior", icon: "⚔️" },
  { minPoints: 10000, title: "Bible Master", icon: "👑" },
] as const;

export function getTier(points: number) {
  let current: any = PRIZE_TIERS[0];
  let next: (typeof PRIZE_TIERS)[number] | null = null;
  for (const tier of PRIZE_TIERS) {
    if (points >= tier.minPoints) {
      current = tier;
    } else if (!next) {
      next = tier;
      break;
    }
  }
  const progress = next
    ? Math.round(((points - current.minPoints) / (next.minPoints - current.minPoints)) * 100)
    : 100;
  return { current, next, progress };
}

/**
 * Fisher-Yates unbiased shuffle.
 * Replaces the biased Math.random() sort.
 */
export function fisherYatesShuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Get the set of questionIds that the user has ALREADY earned points for.
 * These questions will award 0 FP if answered again.
 */
export async function getScoredQuestionIds(userId: string): Promise<Set<string>> {
  const attempts = await db.triviaQuestionAttempt.findMany({
    where: { userId, pointsAwarded: { gt: 0 } },
    select: { questionId: true },
  });
  return new Set(attempts.map((a) => a.questionId));
}

/**
 * Select questions for a quiz, prioritizing UNSCORED questions.
 *
 * - EARN_POINTS mode: tries to give all new questions. If fewer new questions
 *   than requested, gives only what's available (user is told).
 * - PRACTICE mode: gives any questions (random), no points awarded.
 *
 * Returns: { questions, allNew, newCount, totalCount }
 */
export async function selectQuizQuestions(
  userId: string | null,
  difficulty: string,
  category: string,
  count: number,
  mode: "EARN_POINTS" | "PRACTICE"
) {
  // Get all active questions for this difficulty + category
  const allQuestions = await db.triviaQuestion.findMany({
    where: {
      difficulty,
      category,
      isActive: true,
    },
  });

  if (allQuestions.length === 0) {
    return { questions: [], allNew: false, newCount: 0, totalCount: 0 };
  }

  // For PRACTICE mode or unauthenticated users, just shuffle all
  if (mode === "PRACTICE" || !userId) {
    const shuffled = fisherYatesShuffle(allQuestions).slice(0, count);
    return {
      questions: shuffled,
      allNew: false,
      newCount: 0,
      totalCount: allQuestions.length,
    };
  }

  // EARN_POINTS mode: prioritize unseen questions
  const scoredIds = await getScoredQuestionIds(userId);
  const newQuestions = allQuestions.filter((q) => !scoredIds.has(q.questionId));
  const oldQuestions = allQuestions.filter((q) => scoredIds.has(q.questionId));

  // Shuffle both pools
  const shuffledNew = fisherYatesShuffle(newQuestions);
  const shuffledOld = fisherYatesShuffle(oldQuestions);

  // Take new questions first
  const selected = shuffledNew.slice(0, count);

  // If we don't have enough new questions, DON'T fill with old ones
  // (per user requirement: option A — tell user only X new questions available)
  // The UI will show how many new questions are available.

  return {
    questions: selected,
    allNew: selected.length === count,
    newCount: selected.length,
    totalCount: allQuestions.length,
  };
}

/**
 * Calculate streak bonus for a NEW correct answer.
 * Streak is the count of consecutive NEW correct answers in this session.
 *
 * streakBonus = Math.min(streak, 5) * 2
 * Max bonus: +10 FP
 *
 * IMPORTANT: Streak does NOT increment for already-scored questions.
 */
export function calculateStreakBonus(currentStreak: number): number {
  return Math.min(currentStreak, 5) * 2;
}

/**
 * Submit a quiz attempt — SERVER-SIDE ONLY.
 *
 * This is the core anti-farming function. It:
 * 1. Validates all question IDs and answers
 * 2. For each question, checks if the user already earned points (DB unique constraint)
 * 3. Awards points ONLY for new correct answers
 * 4. Records attempts (with unique constraint as DB-level protection)
 * 5. Updates user's totalPoints atomically
 * 6. Creates transaction history records
 * 7. Returns the verified result
 *
 * Race-condition protection: the @@unique([userId, questionId]) constraint
 * means if two requests try to create an attempt for the same user+question
 * simultaneously, only one succeeds. The other throws P2002, which we catch
 * and treat as "already scored" → 0 points.
 */
export async function submitQuiz(
  userId: string,
  sessionData: {
    difficulty: string;
    category: string;
    mode: "EARN_POINTS" | "PRACTICE";
    answers: { questionId: string; selectedAnswer: number }[];
  }
) {
  const { difficulty, category, mode, answers } = sessionData;

  // Validate difficulty and category
  if (!DIFFICULTY_POINTS[difficulty]) {
    throw new Error(`Invalid difficulty: ${difficulty}`);
  }

  // Fetch all questions for this quiz from the DB
  const questionIds = answers.map((a) => a.questionId);
  const questions = await db.triviaQuestion.findMany({
    where: { questionId: { in: questionIds } },
  });

  if (questions.length !== answers.length) {
    throw new Error("Some question IDs are invalid");
  }

  // Create a quiz session record
  const quizSession = await db.triviaQuizSession.create({
    data: {
      userId,
      difficulty,
      category,
      questionIds: JSON.stringify(questionIds),
      totalQuestions: answers.length,
      mode,
      score: 0,
      correctCount: 0,
      bestStreak: 0,
    },
  });

  // PRACTICE mode: no points, just record correctness
  if (mode === "PRACTICE") {
    let correctCount = 0;
    for (const answer of answers) {
      const q = questions.find((q) => q.questionId === answer.questionId)!;
      const isCorrect = answer.selectedAnswer === q.correctAnswer;
      if (isCorrect) correctCount++;

      // Record attempt with 0 points (practice)
      try {
        await db.triviaQuestionAttempt.create({
          data: {
            userId,
            questionId: answer.questionId,
            quizSessionId: quizSession.id,
            pointsAwarded: 0,
            answeredCorrectly: isCorrect,
          },
        });
      } catch {
        // Already has an attempt — that's fine for practice mode.
        // Just update the answeredCorrectly field.
        await db.triviaQuestionAttempt.updateMany({
          where: { userId, questionId: answer.questionId },
          data: { answeredCorrectly: isCorrect, quizSessionId: quizSession.id },
        });
      }
    }

    await db.triviaQuizSession.update({
      where: { id: quizSession.id },
      data: { correctCount, score: 0 },
    });

    return {
      mode: "PRACTICE",
      totalPointsEarned: 0,
      correctCount,
      totalQuestions: answers.length,
      newTotalPoints: (await db.user.findUnique({ where: { id: userId } }))!.totalPoints,
      questionResults: answers.map((a) => {
        const q = questions.find((q) => q.questionId === a.questionId)!;
        return {
          questionId: a.questionId,
          correct: a.selectedAnswer === q.correctAnswer,
          pointsAwarded: 0,
          alreadyScored: true, // in practice, everything is 0 points
        };
      }),
    };
  }

  // EARN_POINTS mode: the real scoring logic
  const scoredIds = await getScoredQuestionIds(userId);

  let totalPointsEarned = 0;
  let correctCount = 0;
  let currentStreak = 0;
  let bestStreak = 0;
  const questionResults: any[] = [];

  // Process each answer
  for (const answer of answers) {
    const q = questions.find((q) => q.questionId === answer.questionId)!;
    const isCorrect = answer.selectedAnswer === q.correctAnswer;
    const alreadyScored = scoredIds.has(answer.questionId);

    let pointsAwarded = 0;
    let streakBonus = 0;
    let reason = "";
    let attemptCreated = false;

    if (isCorrect && !alreadyScored) {
      // NEW correct answer — calculate points
      if (isCorrect) correctCount++;
      currentStreak++;
      bestStreak = Math.max(bestStreak, currentStreak);
      streakBonus = calculateStreakBonus(currentStreak);
      pointsAwarded = q.basePoints + streakBonus;

      reason = streakBonus > 0
        ? `CORRECT_${difficulty.toUpperCase()} + STREAK_BONUS`
        : `CORRECT_${difficulty.toUpperCase()}`;
    } else if (isCorrect && alreadyScored) {
      // Already scored — 0 FP, streak does NOT increment
      reason = "ALREADY_SCORED";
    } else {
      // Wrong answer — 0 FP, streak resets
      currentStreak = 0;
      reason = "INCORRECT";
    }

    // Create attempt record (unique constraint protects against double-scoring)
    // This is the RACE-CONDITION protection. The @@unique([userId, questionId])
    // constraint means only ONE attempt can ever exist per user+question.
    // If two requests try simultaneously, only one create() succeeds.
    try {
      await db.triviaQuestionAttempt.create({
        data: {
          userId,
          questionId: answer.questionId,
          quizSessionId: quizSession.id,
          pointsAwarded,
          answeredCorrectly: isCorrect,
        },
      });
      attemptCreated = true;

      // Create transaction record for awarded points
      if (pointsAwarded > 0) {
        await db.triviaPointTransaction.create({
          data: {
            userId,
            questionId: answer.questionId,
            quizSessionId: quizSession.id,
            points: pointsAwarded,
            reason,
          },
        });
      }
    } catch (e: any) {
      // P2002 = unique constraint violation — question already scored
      // This means another request already awarded points for this question.
      // Set pointsAwarded to 0 and DON'T add to totalPointsEarned.
      if (e.code === "P2002") {
        pointsAwarded = 0;
        streakBonus = 0;
        reason = "ALREADY_SCORED (race-condition blocked)";
        // Attempt already exists — update correctness only
        await db.triviaQuestionAttempt.updateMany({
          where: { userId, questionId: answer.questionId },
          data: { answeredCorrectly: isCorrect, quizSessionId: quizSession.id },
        });
      } else {
        throw e;
      }
    }

    // Only add to totalPointsEarned AFTER the unique constraint check passed.
    // This ensures race-condition losers don't get points.
    if (attemptCreated && pointsAwarded > 0) {
      totalPointsEarned += pointsAwarded;
    }

    questionResults.push({
      questionId: answer.questionId,
      correct: isCorrect,
      pointsAwarded,
      alreadyScored: !attemptCreated || alreadyScored,
      streakBonus,
    });
  }

  // Update user's totalPoints atomically — SERVER-SIDE ONLY
  if (totalPointsEarned > 0) {
    await db.user.update({
      where: { id: userId },
      data: { totalPoints: { increment: totalPointsEarned } },
    });
  }

  // Update quiz session
  await db.triviaQuizSession.update({
    where: { id: quizSession.id },
    data: {
      score: totalPointsEarned,
      correctCount,
      bestStreak,
    },
  });

  // Get fresh totalPoints
  const updatedUser = await db.user.findUnique({ where: { id: userId } });

  return {
    mode: "EARN_POINTS",
    totalPointsEarned,
    correctCount,
    totalQuestions: answers.length,
    newTotalPoints: updatedUser!.totalPoints,
    bestStreak,
    questionResults,
  };
}

/**
 * Claim a gift — SERVER-SIDE ONLY.
 *
 * 1. Validates user has enough totalPoints
 * 2. Checks no existing redemption (unique constraint)
 * 3. Deducts points atomically
 * 4. Creates redemption record
 *
 * Race-condition safe: if two requests try to claim simultaneously,
 * @@unique([userId, giftId]) prevents double-claiming.
 */
export async function claimGift(
  userId: string,
  giftId: string,
  selectedVariations: { name: string; value: string }[] = []
) {
  const gift = await db.gift.findFirst({
    where: { giftId, isActive: true },
  });

  if (!gift) {
    throw new Error("Gift not found");
  }

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new Error("User not found");
  }

  // Check existing redemption FIRST (before checking points)
  // This gives a clean "already claimed" error instead of "not enough points"
  const existing = await db.giftRedemption.findUnique({
    where: { userId_giftId: { userId, giftId } },
  });
  if (existing) {
    throw new Error("You have already claimed this gift");
  }

  // THEN check points
  if (user.totalPoints < gift.pointsRequired) {
    throw new Error(`Not enough points. Need ${gift.pointsRequired}, have ${user.totalPoints}`);
  }

  // Check stock
  if (gift.stock <= 0) {
    throw new Error("Gift out of stock");
  }

  // Use a transaction for atomicity
  const result = await db.$transaction([
    // Deduct points from user
    db.user.update({
      where: { id: userId },
      data: { totalPoints: { decrement: gift.pointsRequired } },
    }),
    // Create redemption record — includes selected variations for fulfilment
    db.giftRedemption.create({
      data: {
        userId,
        giftId,
        giftDbId: gift.id,
        pointsSpent: gift.pointsRequired,
        status: "pending",
        selectedVariations: JSON.stringify(selectedVariations || []),
      },
    }),
    // Decrement gift stock
    db.gift.update({
      where: { id: gift.id },
      data: { stock: { decrement: 1 } },
    }),
    // Create transaction record (giftId stored in reason since the model
    // doesn't have a giftId field — avoids schema migration)
    db.triviaPointTransaction.create({
      data: {
        userId,
        points: -gift.pointsRequired,
        reason: `GIFT_REDEMPTION:${gift.giftId}:${gift.title}`,
      },
    }),
  ]);

  return {
    success: true,
    giftTitle: gift.title,
    pointsSpent: gift.pointsRequired,
    newTotalPoints: result[0].totalPoints,
    selectedVariations,
  };
}
