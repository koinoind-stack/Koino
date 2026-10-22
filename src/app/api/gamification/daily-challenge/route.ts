import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getAuthUser } from "@/lib/auth-server";

const db = new PrismaClient();

/**
 * GET /api/gamification/daily-challenge
 * Returns today's challenge question (without correct answer).
 * Auto-creates a challenge if one doesn't exist for today.
 *
 * POST /api/gamification/daily-challenge
 * Body: { selectedAnswer: number }
 * Submits the daily challenge answer. Server verifies and awards 2x FP.
 */

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function GET() {
  try {
    const authUser = await getAuthUser();
    const userId = authUser?.id;

    const today = todayStr();

    // Get or create today's challenge
    let challenge = await db.dailyChallenge.findUnique({
      where: { challengeDate: today },
    });

    if (!challenge) {
      // Pick a random question for today's challenge
      const count = await db.triviaQuestion.count({ where: { isActive: true } });
      const randomIdx = Math.floor(Math.random() * count);
      const question = await db.triviaQuestion.findFirst({
        take: 1,
        skip: randomIdx,
        where: { isActive: true },
      });

      if (!question) {
        return NextResponse.json({ error: "No questions available" }, { status: 500 });
      }

      challenge = await db.dailyChallenge.create({
        data: {
          challengeDate: today,
          questionId: question.questionId,
          multiplier: 2,
        },
      });
    }

    // Get the question (without correctAnswer)
    const question = await db.triviaQuestion.findUnique({
      where: { questionId: challenge.questionId },
    });

    if (!question) {
      return NextResponse.json({ error: "Challenge question not found" }, { status: 500 });
    }

    // Check if user already answered
    let userAttempt: any = null;
    if (userId) {
      userAttempt = await db.dailyChallengeAttempt.findUnique({
        where: {
          userId_challengeId: { userId, challengeId: challenge.id },
        },
      });
    }

    return NextResponse.json({
      challenge: {
        id: challenge.id,
        date: challenge.challengeDate,
        multiplier: challenge.multiplier,
        question: {
          id: question.questionId,
          question: question.question,
          options: JSON.parse(question.options),
          difficulty: question.difficulty,
          category: question.category,
          basePoints: question.basePoints,
          scriptureReference: question.scriptureReference,
        },
        userAttempt: userAttempt
          ? {
              isCorrect: userAttempt.isCorrect,
              pointsAwarded: userAttempt.pointsAwarded,
              selectedAnswer: userAttempt.selectedAnswer,
            }
          : null,
      },
      isAuthenticated: !!userId,
    });
  } catch (e: any) {
    console.error("[daily-challenge GET] Error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthUser();
    if (!authUser) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    const userId = authUser.id;

    const body = await req.json();
    const { selectedAnswer } = body;

    if (typeof selectedAnswer !== "number") {
      return NextResponse.json({ error: "Missing selectedAnswer" }, { status: 400 });
    }

    const today = todayStr();
    const challenge = await db.dailyChallenge.findUnique({
      where: { challengeDate: today },
    });

    if (!challenge) {
      return NextResponse.json({ error: "No challenge today" }, { status: 404 });
    }

    // Check if already answered (unique constraint = anti-farming)
    const existing = await db.dailyChallengeAttempt.findUnique({
      where: { userId_challengeId: { userId, challengeId: challenge.id } },
    });
    if (existing) {
      return NextResponse.json({
        error: "You already answered today's challenge",
        attempt: existing,
      }, { status: 400 });
    }

    // Get the question to verify the answer
    const question = await db.triviaQuestion.findUnique({
      where: { questionId: challenge.questionId },
    });
    if (!question) {
      return NextResponse.json({ error: "Question not found" }, { status: 500 });
    }

    const isCorrect = selectedAnswer === question.correctAnswer;
    let pointsAwarded = 0;

    if (isCorrect) {
      // Award 2x the base points
      pointsAwarded = question.basePoints * challenge.multiplier;

      // Create attempt record
      await db.dailyChallengeAttempt.create({
        data: {
          userId,
          challengeId: challenge.id,
          selectedAnswer,
          isCorrect: true,
          pointsAwarded,
        },
      });

      // Create transaction
      await db.triviaPointTransaction.create({
        data: {
          userId,
          points: pointsAwarded,
          reason: `DAILY_CHALLENGE_2X:${question.difficulty}`,
        },
      });

      // Update user's totalPoints
      await db.user.update({
        where: { id: userId },
        data: { totalPoints: { increment: pointsAwarded } },
      });
    } else {
      // Record incorrect attempt (0 points)
      await db.dailyChallengeAttempt.create({
        data: {
          userId,
          challengeId: challenge.id,
          selectedAnswer,
          isCorrect: false,
          pointsAwarded: 0,
        },
      });
    }

    const updatedUser = await db.user.findUnique({ where: { id: userId } });

    return NextResponse.json({
      isCorrect,
      pointsAwarded,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation,
      scriptureReference: question.scriptureReference,
      newTotalPoints: updatedUser?.totalPoints || 0,
    });
  } catch (e: any) {
    console.error("[daily-challenge POST] Error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
