import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getAuthUser } from "@/lib/auth-server";
import { submitQuiz } from "@/lib/trivia-server";

const db = new PrismaClient();

/**
 * GET /api/comic/quiz/[comicChapterId]?lang=hi
 *
 * Returns quiz questions linked to this comic chapter.
 * Reuses the EXISTING TriviaQuestion records — no separate question table.
 * The same questionId works in both regular Trivia and Comic quiz.
 *
 * Response:
 *   { questions: [...], mode: "EARN_POINTS" | "PRACTICE", lang }
 *
 * POST /api/comic/quiz/[comicChapterId]
 *
 * Body: { mode, answers: [{ questionId, selectedAnswer }] }
 *
 * Scores the quiz using the EXISTING submitQuiz() function.
 * Anti-farming: same @@unique([userId, questionId]) applies.
 * A question scored in regular Trivia = 0 FP in Comic quiz, and vice versa.
 */

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ comicChapterId: string }> }
) {
  try {
    const { comicChapterId } = await params;
    const url = new URL(req.url);
    const lang = url.searchParams.get("lang") || "en";
    const mode = (url.searchParams.get("mode") || "EARN_POINTS") as "EARN_POINTS" | "PRACTICE";

    const validLangs = ["en", "hi", "bn", "te", "mr", "ta", "gu", "ur", "kn", "or", "ml", "pa", "as"];
    if (!validLangs.includes(lang)) {
      return NextResponse.json({ error: "Invalid language code" }, { status: 400 });
    }

    // Get quiz question IDs linked to this comic chapter
    const quizLinks = await db.comicChapterQuiz.findMany({
      where: { comicChapterId },
      orderBy: { sortOrder: "asc" },
      select: { questionId: true },
    });

    if (quizLinks.length === 0) {
      return NextResponse.json({ questions: [], message: "No quiz questions linked to this chapter" });
    }

    // EARN_POINTS mode requires authentication
    const user = await getAuthUser();
    if (mode === "EARN_POINTS" && !user) {
      return NextResponse.json({ error: "Authentication required for Earn Points mode" }, { status: 401 });
    }

    // Fetch the actual TriviaQuestion records
    const questionIds = quizLinks.map((q) => q.questionId);
    const questions = await db.triviaQuestion.findMany({
      where: { questionId: { in: questionIds }, isActive: true },
    });

    // Return with translations (same logic as /api/trivia/start)
    const formattedQuestions = questions.map((q) => {
      let translated: { question?: string; options?: string[]; explanation?: string } | null = null;
      try {
        const allTranslations = JSON.parse(q.translations || "{}");
        translated = allTranslations[lang] || null;
      } catch {
        // fall back to English
      }

      return {
        id: q.questionId,
        question: translated?.question || q.question,
        options: translated?.options || JSON.parse(q.options),
        difficulty: q.difficulty,
        category: q.category,
        basePoints: q.basePoints,
        scriptureReference: q.scriptureReference,
        explanation: translated?.explanation || q.explanation,
      };
    });

    return NextResponse.json({
      questions: formattedQuestions,
      mode,
      lang,
    });
  } catch (error: any) {
    console.error("[comic/quiz GET] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to load quiz" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ comicChapterId: string }> }
) {
  try {
    const { comicChapterId } = await params;
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await req.json();
    const { mode, answers } = body;

    if (!["EARN_POINTS", "PRACTICE"].includes(mode)) {
      return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
    }

    if (!Array.isArray(answers) || answers.length === 0 || answers.length > 15) {
      return NextResponse.json({ error: "Invalid answers" }, { status: 400 });
    }

    // Verify all questionIds are linked to this comic chapter
    const quizLinks = await db.comicChapterQuiz.findMany({
      where: { comicChapterId },
      select: { questionId: true },
    });
    const linkedIds = new Set(quizLinks.map((q) => q.questionId));

    // Fetch questions to get difficulty + category
    const questionIds = answers.map((a: any) => a.questionId);
    const dbQuestions = await db.triviaQuestion.findMany({
      where: { questionId: { in: questionIds } },
    });

    if (dbQuestions.length !== questionIds.length) {
      return NextResponse.json({ error: "Some question IDs are invalid" }, { status: 400 });
    }

    // Verify all questions are linked to this comic chapter
    const unlinked = questionIds.filter((id: string) => !linkedIds.has(id));
    if (unlinked.length > 0) {
      return NextResponse.json(
        { error: `Questions not linked to this comic chapter: ${unlinked.join(", ")}` },
        { status: 400 }
      );
    }

    // Get difficulty + category from the first question (all should match)
    const firstQ = dbQuestions[0];

    // Use the EXISTING submitQuiz() function — same anti-farming, same FP system
    const result = await submitQuiz(user.id, {
      difficulty: firstQ.difficulty,
      category: firstQ.category,
      mode,
      answers: answers.map((a: any) => ({
        questionId: a.questionId,
        selectedAnswer: Number(a.selectedAnswer),
      })),
    });

    // Enrich results with question content for the result screen
    const enrichedResults = result.questionResults.map((qr: any) => {
      const q = dbQuestions.find((dq) => dq.questionId === qr.questionId)!;
      return {
        ...qr,
        question: q.question,
        options: JSON.parse(q.options),
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        scriptureReference: q.scriptureReference,
      };
    });

    return NextResponse.json({
      ...result,
      questionResults: enrichedResults,
    });
  } catch (error: any) {
    console.error("[comic/quiz POST] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to submit quiz" }, { status: 500 });
  }
}
