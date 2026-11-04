import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { rateLimit } from "@/lib/social/rate-limit";
import { requireContributor } from "@/lib/apologetics-server";

/**
 * GET /api/contributor/answers — open questions a contributor could answer.
 * Returns questions with status "new" or "in_review" (never asks' emails),
 * newest first, plus whether this contributor already has a pending proposal.
 */
export async function GET() {
  try {
    const guard = await requireContributor("CAN_WRITE_ANSWERS");
    if (guard.response) return guard.response;

    const questions = await db.userQuestion.findMany({
      where: { status: { in: ["new", "in_review"] } },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        question: true,
        category: true,
        status: true,
        createdAt: true,
        contributorAnswerUserId: true,
        contributorAnswerStatus: true,
      },
    });

    return NextResponse.json({
      questions: questions.map((q) => ({
        id: q.id,
        question: q.question,
        category: q.category || "",
        status: q.status,
        createdAt: q.createdAt.toISOString(),
        myProposal: q.contributorAnswerUserId === guard.contributor.userId ? q.contributorAnswerStatus : null,
      })),
    });
  } catch (error: any) {
    console.error("[api/contributor/answers GET] Error:", error);
    return NextResponse.json({ error: "Failed to load open questions" }, { status: 500 });
  }
}

/**
 * POST /api/contributor/answers — an approved contributor proposes an answer
 * to a user question. The proposal is stored on the question with status
 * "pending" and is NOT public; an admin reviews it via the admin Q&A tab and
 * either approves it (becomes the official answer, credited to the
 * contributor) or rejects it.
 *
 * Requires the CAN_WRITE_ANSWERS permission on the Contributor record.
 * Body: { questionId, answer }
 */
export async function POST(req: NextRequest) {
  try {
    const guard = await requireContributor("CAN_WRITE_ANSWERS");
    if (guard.response) return guard.response;
    const contributor = guard.contributor;

    if (!rateLimit(`contributor:answer:${contributor.userId}`, 10, 60 * 60_000)) {
      return NextResponse.json({ error: "Too many answer proposals. Try again later." }, { status: 429 });
    }

    const body = await req.json().catch(() => ({}));
    const questionId = typeof body.questionId === "string" ? body.questionId : "";
    const answer = typeof body.answer === "string" ? body.answer.trim() : "";

    if (!questionId) {
      return NextResponse.json({ error: "questionId is required" }, { status: 400 });
    }
    if (!answer || answer.length < 20) {
      return NextResponse.json({ error: "Answer is required (min 20 characters)" }, { status: 400 });
    }
    if (answer.length > 10_000) {
      return NextResponse.json({ error: "Answer is too long (max 10000 characters)" }, { status: 400 });
    }

    const question = await db.userQuestion.findUnique({ where: { id: questionId } });
    if (!question) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }
    if (["archived", "turned_into_article"].includes(question.status)) {
      return NextResponse.json({ error: "This question is closed for answers" }, { status: 400 });
    }

    // Upsert: re-proposing replaces the contributor's own previous proposal.
    await db.userQuestion.update({
      where: { id: questionId },
      data: {
        contributorAnswer: answer,
        contributorAnswerName: contributor.displayName,
        contributorAnswerUserId: contributor.userId,
        contributorAnswerStatus: "pending",
      },
    });

    return NextResponse.json({
      success: true,
      message: "Answer submitted for review. An admin will approve it before it is published.",
    });
  } catch (error: any) {
    console.error("[api/contributor/answers POST] Error:", error);
    return NextResponse.json({ error: error?.message || "Failed to submit answer" }, { status: 500 });
  }
}
