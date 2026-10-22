import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getAuthUser } from "@/lib/auth-server";

const db = new PrismaClient();

/**
 * GET /api/questions
 * Public — returns answered questions for the public Q&A display.
 *
 * Only questions with status='answered' are returned (those have an admin
 * response in adminNotes). Questions with status 'new', 'in_review',
 * 'turned_into_article', or 'archived' are NEVER exposed publicly.
 *
 * Optional query params:
 *   ?category=gods_existence — filter by category
 *   ?q=resurrection          — search by question text
 *
 * Sorted by createdAt DESC (newest first).
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category") || undefined;
    const q = searchParams.get("q")?.trim() || undefined;

    const where: any = {
      status: "answered",
      ...(category ? { category } : {}),
    };

    // Free-text search on the question text
    if (q) {
      where.question = { contains: q, mode: "insensitive" };
    }

    let questions: any[] = [];
    try {
      questions = await db.userQuestion.findMany({
        where,
        orderBy: [{ createdAt: "desc" }],
      });
    } catch (dbError: any) {
      // If the UserQuestion table doesn't exist yet (migration not applied),
      // return an empty list so the public Q&A shows the empty state.
      const prismaCode = dbError?.code;
      const prismaMessage = dbError?.message || "";
      if (prismaCode === "P2021" || prismaCode === "P2022" || prismaCode === "P1003" ||
          /relation .* does not exist/i.test(prismaMessage) ||
          /table .* does not exist/i.test(prismaMessage)) {
        console.warn("[api/questions GET] UserQuestion table not found — returning empty list.");
        return NextResponse.json({ questions: [] });
      }
      throw dbError;
    }

    return NextResponse.json({
      questions: questions.map((q) => ({
        id: q.id,
        question: q.question,
        askerName: q.askerName || "Anonymous",
        category: q.category || "",
        answer: q.adminNotes || "", // admin's answer is stored in adminNotes
        status: q.status,
        createdAt: q.createdAt.toISOString(),
      })),
    });
  } catch (error: any) {
    console.error("[api/questions GET] Error:", error);
    return NextResponse.json({ questions: [], error: "Failed to load questions" }, { status: 200 });
  }
}

/**
 * POST /api/questions
 * Authenticated — creates a new user question with status='new'.
 *
 * The question is NOT immediately visible publicly. Admin must review it
 * and answer it (setting status='answered' + adminNotes) before it
 * appears in the public Q&A list.
 *
 * Required fields: question (the question text)
 * Optional: askerName (defaults to "Anonymous"), category
 *
 * The authenticated user's ID + email are captured server-side from the
 * auth session — never trusted from the request body.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Please sign in to ask a question." }, { status: 401 });
    }

    const body = await req.json();

    // ─── Server-side validation ───
    if (!body.question || typeof body.question !== "string" || !body.question.trim()) {
      return NextResponse.json({ error: "Question is required." }, { status: 400 });
    }

    const questionText = String(body.question).trim().slice(0, 2000);
    const askerName = body.askerName
      ? String(body.askerName).trim().slice(0, 200)
      : user.name || user.email.split("@")[0];
    const category = body.category
      ? String(body.category).slice(0, 100)
      : null;

    // ─── Insert into DB with status='new' ───
    const question = await db.userQuestion.create({
      data: {
        question: questionText,
        askerName,
        askerEmail: user.email,
        askerUserId: user.id,
        category,
        status: "new", // CRITICAL: user-submitted questions always start as 'new'
      },
    });

    console.log(`[api/questions POST] Question created: ${question.id} (status=new, by ${user.email})`);

    return NextResponse.json({
      success: true,
      questionId: question.id,
      status: question.status,
      message: "Question submitted successfully. It will appear once answered by our team.",
    });
  } catch (error: any) {
    console.error("[api/questions POST] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to submit question. Please try again." },
      { status: 500 }
    );
  }
}
