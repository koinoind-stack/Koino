import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { submitQuiz } from "@/lib/trivia-server";
import { checkAndAwardBadges } from "@/lib/badges";
import { db } from "@/lib/db";

/**
 * POST /api/trivia/submit
 *
 * Receives: { difficulty, category, mode, answers: [{ questionId, selectedAnswer }] }
 *
 * Server independently:
 * 1. Validates the user is authenticated
 * 2. Validates all question IDs exist in DB
 * 3. Checks which questions the user has already scored
 * 4. Verifies correct answers from DB (NOT from client)
 * 5. Calculates points: only NEW correct answers earn FP
 * 6. Creates attempt records (unique constraint = race-condition safe)
 * 7. Updates totalPoints atomically
 * 8. Creates transaction history
 *
 * The client NEVER tells the server how many points were earned.
 * The server calculates everything.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await req.json();
    const { difficulty, category, mode, answers } = body;

    // Validate input
    if (!difficulty || !category || !mode || !Array.isArray(answers)) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (!["EARN_POINTS", "PRACTICE"].includes(mode)) {
      return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
    }

    if (answers.length === 0 || answers.length > 15) {
      return NextResponse.json({ error: "Invalid number of answers" }, { status: 400 });
    }

    // Verify all questionIds are valid and belong to the right difficulty/category
    const questionIds = answers.map((a: any) => a.questionId);
    const dbQuestions = await db.triviaQuestion.findMany({
      where: { questionId: { in: questionIds } },
    });

    if (dbQuestions.length !== questionIds.length) {
      return NextResponse.json({ error: "Some question IDs are invalid" }, { status: 400 });
    }

    // Verify difficulty/category match the questions
    const mismatch = dbQuestions.some(
      (q) => q.difficulty !== difficulty || q.category !== category
    );
    if (mismatch) {
      return NextResponse.json({ error: "Question difficulty/category mismatch" }, { status: 400 });
    }

    // Submit to server-side scoring logic
    const result = await submitQuiz(user.id, {
      difficulty,
      category,
      mode,
      answers: answers.map((a: any) => ({
        questionId: a.questionId,
        selectedAnswer: Number(a.selectedAnswer),
      })),
    });

    // ─── DAILY SPIN "2x FP NEXT QUIZ" REWARD (double_fp) ───
    // The daily spin wheel stores rewardType "double_fp" (rewardValue 1) on
    // the day it was spun. This was previously never honored (dead TODO in
    // daily-spin/route.ts) — users won the epic reward and got nothing.
    // Honor it here: the first EARN_POINTS quiz of that day with a positive
    // score earns double points (base 1x + bonus 1x = 2x).
    //
    // Consumption is race-safe WITHOUT a schema migration: updateMany()
    // flips rewardValue 1 → 0 with an atomic conditional UPDATE, so exactly
    // one concurrent submit (count === 1) owns the reward. rewardType is
    // left untouched so GET /api/gamification/daily-spin keeps rendering the
    // won-reward card. Scoped to the spin's own day ("next quiz" = the quiz
    // played the day you spun).
    let doubleFpApplied = false;
    let bonusPoints = 0;
    if (mode === "EARN_POINTS" && result.totalPointsEarned > 0) {
      try {
        const now = new Date();
        const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
        const spin = await db.dailySpin.findUnique({
          where: { userId_spinDate: { userId: user.id, spinDate: today } },
        });
        if (spin && spin.rewardType === "double_fp") {
          const consumed = await db.dailySpin.updateMany({
            where: { id: spin.id, rewardType: "double_fp", rewardValue: 1 },
            data: { rewardValue: 0 },
          });
          if (consumed.count === 1) {
            bonusPoints = result.totalPointsEarned;
            doubleFpApplied = true;
            await db.$transaction([
              db.user.update({
                where: { id: user.id },
                data: { totalPoints: { increment: bonusPoints } },
              }),
              db.triviaPointTransaction.create({
                data: {
                  userId: user.id,
                  quizSessionId: result.sessionId,
                  points: bonusPoints,
                  reason: "DOUBLE_FP_BONUS",
                },
              }),
            ]);
            result.newTotalPoints = (result.newTotalPoints || 0) + bonusPoints;
          }
        }
      } catch (e) {
        // The reward must never break the quiz result — worst case it stays
        // armed (rewardValue stays 1) and the next quiz consumes it.
        console.error("[trivia/submit] double_fp handling failed:", e);
      }
    }

    // Include explanations + correct answers for the result screen
    const enrichedResults = result.questionResults.map((qr: any) => {
      const q = dbQuestions.find((q) => q.questionId === qr.questionId)!;
      return {
        ...qr,
        question: q.question,
        options: JSON.parse(q.options),
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        scriptureReference: q.scriptureReference,
      };
    });

    // ─── RETURN THE RESULT IMMEDIATELY ───
    // The answer result must be displayed to the user as fast as possible.
    // Streak recording + milestone checks + reward creation are secondary
    // operations that should NOT block the API response.
    //
    // We fire the streak recording as a non-blocking background operation.
    // If it fails, the user still gets their quiz result. The streak will
    // be recorded on the next trivia play or page load.

    // ─── BADGE CHECK (server-authoritative, runs on every scored quiz) ───
    // Without this the quiz badges (first_quiz, quiz_master, bible_scholar,
    // perfect_score, fp_*) could never be earned — nothing ran the check
    // after a quiz. The check is idempotent (@@unique on userId+badgeId) and
    // only a handful of indexed counts, so it can safely run inline: the
    // result screen wants to show "Badge Unlocked" immediately. Practice
    // mode is skipped — its badges all derive from scored sessions anyway.
    let newlyAwardedBadges: Awaited<ReturnType<typeof checkAndAwardBadges>> = [];
    if (mode === "EARN_POINTS") {
      try {
        newlyAwardedBadges = await checkAndAwardBadges(user.id);
      } catch (e) {
        // Never fail the quiz result over a badge hiccup — the next scored
        // quiz (or any POST /api/gamification/badges poll) re-runs the check.
        console.error("[trivia/submit] Badge check failed:", e);
      }
    }

    // Return immediately with the quiz result
    const responseBody = {
      ...result,
      questionResults: enrichedResults,
      newlyAwarded: newlyAwardedBadges,
      streak: null, // streak is recorded in background — don't block
      doubleFpApplied,
      bonusPoints,
    };

    // ─── FIRE-AND-FORGET: Record Faith Streak (non-blocking) ───
    // This runs AFTER the response is sent. The user sees their result
    // immediately, and the streak is recorded in the background.
    if (mode === "EARN_POINTS") {
      // Don't await — fire and forget
      recordStreakInBackground(user.id).catch((e) => {
        console.error("[trivia submit] Background streak recording error:", e);
      });
    }

    return NextResponse.json(responseBody);
  } catch (error: any) {
    console.error("[trivia/submit] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to submit quiz" }, { status: 500 });
  }
}

/**
 * Records the user's Faith Streak in the background (non-blocking).
 * This function is called via fire-and-forget after the quiz result
 * has already been returned to the user.
 *
 * It does:
 * 1. Check if streak already recorded today (idempotent)
 * 2. Update streak counter
 * 3. Check milestones + create rewards (idempotent via @@unique)
 *
 * If this fails, the user still gets their quiz result. The streak
 * will be recorded on the next trivia play or via /api/streak/record.
 */
async function recordStreakInBackground(userId: string): Promise<void> {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;

  let userStreak = await db.userStreak.findUnique({ where: { userId } });
  if (!userStreak) {
    userStreak = await db.userStreak.create({
      data: { userId, currentStreak: 0, longestStreak: 0, lastActiveDate: null, totalActiveDays: 0 },
    });
  }

  // Already active today — no-op
  if (userStreak.lastActiveDate === today) return;

  let newStreak: number;
  if (userStreak.lastActiveDate === yesterdayStr) {
    newStreak = userStreak.currentStreak + 1;
  } else if (!userStreak.lastActiveDate) {
    newStreak = 1;
  } else {
    newStreak = 1;
  }

  userStreak = await db.userStreak.update({
    where: { userId },
    data: {
      currentStreak: newStreak,
      longestStreak: Math.max(userStreak.longestStreak, newStreak),
      lastActiveDate: today,
      totalActiveDays: userStreak.totalActiveDays + 1,
    },
  });

  // Check milestones + create rewards (idempotent via @@unique)
  const milestones = await db.streakMilestone.findMany({
    where: { active: true, streakDays: newStreak },
    include: { reward: true },
  });

  for (const milestone of milestones) {
    if (!milestone.reward || !milestone.reward.active) continue;
    const existing = await db.userReward.findUnique({
      where: { userId_milestoneId: { userId, milestoneId: milestone.id } },
    });
    if (!existing) {
      let expiresAt: Date | null = null;
      if (milestone.reward.expiresAfterDays) {
        expiresAt = new Date(now.getTime() + milestone.reward.expiresAfterDays * 24 * 60 * 60 * 1000);
      }
      const redemptionCode = `KOINO-${milestone.streakDays}D-${userId.slice(-6).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
      await db.userReward.create({
        data: {
          userId,
          rewardId: milestone.rewardId,
          milestoneId: milestone.id,
          source: "streak_milestone",
          sourceMilestone: newStreak,
          status: "available",
          redemptionCode,
          expiresAt,
        },
      });
    }
  }
}
