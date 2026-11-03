import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { selectQuizQuestions } from "@/lib/trivia-server";
import { getTriviaTePack } from "@/lib/i18n/content/trivia-te-pack";

/**
 * POST /api/trivia/start
 *
 * Returns questions for a quiz, prioritizing UNSCORED questions.
 *
 * Body: { difficulty, category, count, mode, lang }
 * mode: "EARN_POINTS" | "PRACTICE"
 * lang: optional — "en" (default), "hi", "bn", "te", "mr", "ta", "gu",
 *       "ur", "kn", "or", "ml", "pa", "as". If a question has a translation
 *       for the requested language, the translated question + options +
 *       explanation are returned. Otherwise falls back to English.
 *
 * Response: { questions, newCount, totalCount, allNew, mode, lang }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { difficulty, category, count = 10, mode = "EARN_POINTS", lang = "en" } = body;

    // Validate
    if (!difficulty || !category) {
      return NextResponse.json({ error: "Missing difficulty or category" }, { status: 400 });
    }

    if (!["beginners", "intermediate", "skilled", "expert"].includes(difficulty)) {
      return NextResponse.json({ error: "Invalid difficulty" }, { status: 400 });
    }

    if (!["full_bible", "new_testament", "old_testament", "apologetics", "life_faith", "jesus"].includes(category)) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }

    if (!["EARN_POINTS", "PRACTICE"].includes(mode)) {
      return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
    }

    const validLangs = ["en", "hi", "bn", "te", "mr", "ta", "gu", "ur", "kn", "or", "ml", "pa", "as"];
    if (!validLangs.includes(lang)) {
      return NextResponse.json({ error: "Invalid language code" }, { status: 400 });
    }

    const user = await getAuthUser();

    // EARN_POINTS mode requires authentication
    if (mode === "EARN_POINTS" && !user) {
      return NextResponse.json({ error: "Authentication required for Earn Points mode" }, { status: 401 });
    }

    const result = await selectQuizQuestions(
      user?.id || null,
      difficulty,
      category,
      Math.min(Math.max(1, count), 15),
      mode
    );

    // Return questions WITHOUT correct answers (client doesn't know which is right).
    // Translation priority per question (Telugu ONLY — every other language uses
    // the DB-translations path or English):
    //   (1) DB `translations` column — populated offline by an operator, wins
    //       if present (the production source of truth when it exists).
    //   (2) Static Telugu content pack shipped with the build
    //       (src/lib/i18n/content/trivia-te.json) — covers the questions the
    //       DB does not yet translate; no runtime translation, no production
    //       DB writes. Loaded only when the requested language is Telugu.
    //   (3) English original — honest fallback for any question missing from
    //       both, so a Telugu quiz never 500s on a gap.
    // The correct-answer index is NEVER changed by translation: only the
    // option TEXT is translated, position-for-position.
    const tePack = lang === "te" ? getTriviaTePack() : null;
    const questions = result.questions.map((q) => {
      let translated: { question?: string; options?: string[]; explanation?: string } | null = null;
      try {
        const allTranslations = JSON.parse(q.translations || "{}");
        translated = allTranslations[lang] || null;
      } catch {
        // Malformed JSON — fall back to the pack or English
      }
      const packed = tePack?.[q.questionId] || null;

      return {
        id: q.questionId,
        question: translated?.question || packed?.q || q.question,
        options: translated?.options || packed?.options || JSON.parse(q.options),
        difficulty: q.difficulty,
        category: q.category,
        basePoints: q.basePoints,
        scriptureReference: q.scriptureReference,
        explanation: translated?.explanation || packed?.explanation || q.explanation,
      };
    });

    return NextResponse.json({
      questions,
      newCount: result.newCount,
      totalCount: result.totalCount,
      allNew: result.allNew,
      mode,
      lang,
    });
  } catch (error: any) {
    console.error("[trivia/start] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to start quiz" }, { status: 500 });
  }
}
