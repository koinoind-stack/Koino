import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getAuthUser } from "@/lib/auth-server";

const db = new PrismaClient();

/**
 * POST /api/trivia/competitions/[id]/start
 *
 * Starts a new competition attempt for the authenticated user.
 * SERVER-AUTHORITATIVE:
 * - Verifies user is authenticated
 * - Verifies competition exists + is LIVE (server time, not client time)
 * - Verifies user has not exceeded attemptLimit (DB count)
 * - Selects questions SERVER-SIDE (client never chooses which questions)
 * - Creates an attempt record (binding userId + competitionId)
 * - Returns questions WITHOUT correct answers (question text + options only)
 *
 * Returns: { attemptId, questions: [{ id, question, options, category, difficulty }] }
 *
 * SECURITY: The correct answer is NEVER sent to the browser. The client
 * only sees question text + options. The server validates answers on submit.
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

    // ─── 1. Validate competition exists + is live ───
    const competition = await db.triviaCompetition.findUnique({
      where: { id: competitionId },
    });
    if (!competition) {
      return NextResponse.json({ error: "Competition not found" }, { status: 404 });
    }

    const now = new Date();
    const isLive = competition.status === "live" && now >= competition.startAt && now < competition.endAt;
    if (!isLive) {
      return NextResponse.json(
        { error: "Competition is not live or has ended" },
        { status: 403 }
      );
    }

    // ─── 2. Enforce attempt limit (server-side, race-condition-safe) ───
    const attemptCount = await db.triviaCompetitionAttempt.count({
      where: { competitionId, userId: user.id },
    });
    if (attemptCount >= competition.attemptLimit) {
      return NextResponse.json(
        {
          error: `Attempt limit reached. You've used ${attemptCount}/${competition.attemptLimit} attempts.`,
          attemptsUsed: attemptCount,
          attemptLimit: competition.attemptLimit,
        },
        { status: 403 }
      );
    }

    // ─── 3. Server-side question selection ───
    // Select `questionCount` random questions matching the competition's
    // category + difficulty. If "mixed", select from any category/difficulty.
    // The client NEVER sees which questions will be asked until this endpoint
    // returns them — and even then, the correct answer is stripped.
    const where: any = { isActive: true };
    if (competition.category !== "mixed") {
      where.category = competition.category;
    }
    if (competition.difficulty !== "mixed") {
      where.difficulty = competition.difficulty;
    }

    // Fetch all matching question IDs, then randomly select the required count
    const allMatching = await db.triviaQuestion.findMany({
      where,
      select: { questionId: true, question: true, options: true, category: true, difficulty: true, translations: true },
    });

    if (allMatching.length === 0) {
      return NextResponse.json(
        { error: "No questions available for this competition's category/difficulty" },
        { status: 500 }
      );
    }

    // Shuffle + take the required count
    const shuffled = [...allMatching].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, Math.min(competition.questionCount, shuffled.length));

    // ─── 4. Create the attempt record (pre-bound to userId + competitionId) ───
    const attempt = await db.triviaCompetitionAttempt.create({
      data: {
        competitionId,
        userId: user.id,
        questionIds: JSON.stringify(selected.map((q) => q.questionId)),
        score: 0,
        correctCount: 0,
        totalQuestions: selected.length,
        accuracy: 0,
        durationMs: 0,
      },
    });

    // ─── 5. Return questions WITHOUT correct answers ───
    // Parse options from JSON string, strip correctAnswer + explanation
    const questionsForClient = selected.map((q, idx) => {
      let options: string[] = [];
      try {
        options = JSON.parse(q.options);
      } catch {
        options = [];
      }
      return {
        index: idx,
        questionId: q.questionId,
        question: q.question,
        options,
        category: q.category,
        difficulty: q.difficulty,
      };
    });

    return NextResponse.json({
      attemptId: attempt.id,
      competitionId,
      competitionTitle: competition.title,
      questionCount: selected.length,
      attemptNumber: attemptCount + 1,
      attemptLimit: competition.attemptLimit,
      startedAt: attempt.createdAt,
      questions: questionsForClient,
    });
  } catch (error: any) {
    console.error("[trivia/competitions/start] Error:", error);
    return NextResponse.json({ error: error?.message || "Failed to start" }, { status: 500 });
  }
}
