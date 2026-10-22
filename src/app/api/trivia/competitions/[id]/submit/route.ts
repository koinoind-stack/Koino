import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getAuthUser } from "@/lib/auth-server";

const db = new PrismaClient();

/**
 * POST /api/trivia/competitions/[id]/submit
 *
 * Submits answers for a competition attempt. SERVER-AUTHORITATIVE scoring.
 *
 * The attempt was already created by POST /api/trivia/competitions/[id]/start,
 * which returned an `attemptId`. The client sends:
 *   { attemptId, answers: [{ questionId, selectedAnswer }] }
 *
 * The server:
 *   1. Verifies the attempt belongs to the authenticated user (anti-cheat)
 *   2. Verifies the competition is still live (server time)
 *   3. Validates answers against the actual TriviaQuestion records (server-side)
 *   4. Calculates score server-side (competition score, NOT lifetime FP)
 *   5. Updates the attempt record (not creating a new one)
 *   6. Awards lifetime FP for NEW questions (anti-farming via existing constraint)
 *
 * Returns: { score, correctCount, totalQuestions, accuracy, durationMs, rank, fpAwarded, competitionScore }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { id: competitionId } = await params;
    const body = await req.json();
    const attemptId: string | undefined = body.attemptId;
    const answers: { questionId: string; selectedAnswer: number }[] = body.answers || [];
    const startTime: string | undefined = body.startTime;

    if (!attemptId) {
      return NextResponse.json({ error: "Missing attemptId (call /start first)" }, { status: 400 });
    }
    if (!Array.isArray(answers) || answers.length === 0) {
      return NextResponse.json({ error: "No answers provided" }, { status: 400 });
    }

    // ─── 1. Find the attempt + verify ownership ───
    const attempt = await db.triviaCompetitionAttempt.findUnique({
      where: { id: attemptId },
    });
    if (!attempt) {
      return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
    }
    // Anti-cheat: the attempt must belong to the authenticated user
    if (attempt.userId !== user.id) {
      return NextResponse.json({ error: "Attempt does not belong to this user" }, { status: 403 });
    }
    // The attempt must be for the correct competition
    if (attempt.competitionId !== competitionId) {
      return NextResponse.json({ error: "Attempt is for a different competition" }, { status: 400 });
    }
    // Prevent duplicate submission — if score > 0, the attempt was already submitted
    if (attempt.score > 0 || attempt.correctCount > 0) {
      return NextResponse.json({ error: "This attempt has already been submitted" }, { status: 403 });
    }

    // ─── 2. Verify competition is still live (server time, not client time) ───
    const competition = await db.triviaCompetition.findUnique({
      where: { id: competitionId },
    });
    if (!competition) {
      return NextResponse.json({ error: "Competition not found" }, { status: 404 });
    }
    const now = new Date();
    const isLive = competition.status === "live" && now >= competition.startAt && now < competition.endAt;
    if (!isLive) {
      return NextResponse.json({ error: "Competition has ended — submissions are closed" }, { status: 403 });
    }

    // ─── 3. Fetch the actual questions to validate answers ───
    // The attempt.questionIds contains the server-selected question IDs.
    const attemptQuestionIds: string[] = JSON.parse(attempt.questionIds);
    const questions = await db.triviaQuestion.findMany({
      where: { questionId: { in: attemptQuestionIds } },
    });

    // ─── 4. Calculate score server-side ───
    let correctCount = 0;
    let totalPoints = 0;
    const attemptStart = startTime ? new Date(startTime) : attempt.createdAt;
    const durationMs = Math.max(0, now.getTime() - attemptStart.getTime());

    for (const answer of answers) {
      const question = questions.find((q) => q.questionId === answer.questionId);
      if (!question) continue;
      if (answer.selectedAnswer === question.correctAnswer) {
        correctCount++;
        totalPoints += question.basePoints;
      }
    }

    const accuracy = answers.length > 0 ? correctCount / answers.length : 0;

    // ─── 5. Update the attempt record (not create a new one) ───
    await db.triviaCompetitionAttempt.update({
      where: { id: attemptId },
      data: {
        score: totalPoints,
        correctCount,
        accuracy,
        durationMs,
      },
    });

    // ─── 6. Award lifetime Faith Points for NEW questions ───
    // Anti-farming: @@unique([userId, questionId]) prevents earning FP twice
    // for the same question, regardless of where it was asked.
    let fpAwarded = 0;
    for (const answer of answers) {
      const question = questions.find((q) => q.questionId === answer.questionId);
      if (!question) continue;
      if (answer.selectedAnswer === question.correctAnswer) {
        const existing = await db.triviaQuestionAttempt.findUnique({
          where: {
            userId_questionId: { userId: user.id, questionId: question.questionId },
          },
        });
        if (!existing) {
          await db.$transaction([
            db.triviaQuestionAttempt.create({
              data: {
                userId: user.id,
                questionId: question.questionId,
                quizSessionId: null,
                pointsAwarded: question.basePoints,
                answeredCorrectly: true,
              },
            }),
            db.triviaPointTransaction.create({
              data: {
                userId: user.id,
                questionId: question.questionId,
                points: question.basePoints,
                reason: `COMPETITION_${competition.type.toUpperCase()}_${question.difficulty.toUpperCase()}`,
              },
            }),
            db.user.update({
              where: { id: user.id },
              data: { totalPoints: { increment: question.basePoints } },
            }),
          ]);
          fpAwarded += question.basePoints;
        }
      }
    }

    // ─── 7. Calculate the user's rank ───
    const higherScorers = await db.triviaCompetitionAttempt.findMany({
      where: { competitionId, score: { gt: totalPoints } },
      distinct: ["userId"],
    });
    const rank = higherScorers.length + 1;

    // ─── 8. Record Faith Streak (server-authoritative) ───
    // Competition quiz counts as a qualifying activity for the streak.
    // One calendar day = one streak day (idempotent).
    let streakResult: any = null;
    try {
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;

      let userStreak = await db.userStreak.findUnique({ where: { userId: user.id } });
      if (!userStreak) {
        userStreak = await db.userStreak.create({
          data: { userId: user.id, currentStreak: 0, longestStreak: 0, lastActiveDate: null, totalActiveDays: 0 },
        });
      }

      if (userStreak.lastActiveDate !== today) {
        let newStreak: number;
        if (userStreak.lastActiveDate === yesterdayStr) {
          newStreak = userStreak.currentStreak + 1;
        } else if (!userStreak.lastActiveDate) {
          newStreak = 1;
        } else {
          newStreak = 1;
        }

        userStreak = await db.userStreak.update({
          where: { userId: user.id },
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
            where: { userId_milestoneId: { userId: user.id, milestoneId: milestone.id } },
          });
          if (!existing) {
            let expiresAt: Date | null = null;
            if (milestone.reward.expiresAfterDays) {
              expiresAt = new Date(now.getTime() + milestone.reward.expiresAfterDays * 24 * 60 * 60 * 1000);
            }
            const redemptionCode = `KOINO-${milestone.streakDays}D-${user.id.slice(-6).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
            await db.userReward.create({
              data: {
                userId: user.id,
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

        streakResult = { currentStreak: userStreak.currentStreak, newStreakDay: true };
      } else {
        streakResult = { currentStreak: userStreak.currentStreak, newStreakDay: false };
      }
    } catch (e) {
      // Streak recording failure should not fail the quiz submission
      console.error("[trivia submit] Streak recording error:", e);
    }

    return NextResponse.json({
      attemptId,
      score: totalPoints,
      correctCount,
      totalQuestions: answers.length,
      accuracy,
      durationMs,
      rank,
      fpAwarded,
      competitionScore: totalPoints,
      streak: streakResult,
    });
  } catch (error: any) {
    console.error("[trivia/competitions/submit] Error:", error);
    return NextResponse.json({ error: error?.message || "Failed to submit" }, { status: 500 });
  }
}
