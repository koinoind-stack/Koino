import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getAuthUser } from "@/lib/auth-server";
import { revalidatePath } from "next/cache";

const db = new PrismaClient();

// Admin auth helper — same pattern as the other admin routes.
async function requireAdmin(): Promise<
  | { user: NonNullable<Awaited<ReturnType<typeof getAuthUser>>>; response: null }
  | { user: null; response: NextResponse }
> {
  const user = await getAuthUser();
  if (!user) {
    return {
      user: null,
      response: NextResponse.json({ error: "Authentication required" }, { status: 401 }),
    };
  }
  if (user.role !== "admin") {
    return {
      user: null,
      response: NextResponse.json({ error: "Admin access required" }, { status: 403 }),
    };
  }
  return { user, response: null };
}

function safeParseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

/**
 * GET /api/admin/questions
 * Admin-only — returns ALL user questions (any status) with optional filter.
 *
 * Optional query params:
 *   ?status=new       — only new questions
 *   ?status=answered  — only answered questions
 *   ?status=archived  — only archived questions
 *
 * Without ?status, returns ALL questions ordered by createdAt DESC.
 *
 * Response: { questions: [...], counts: { all, new, answered, archived } }
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.response) return auth.response;

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const validStatuses = ["new", "in_review", "answered", "turned_into_article", "archived"];
    const where = status && validStatuses.includes(status) ? { status } : {};

    let questions: any[] = [];
    let counts = { all: 0, new: 0, in_review: 0, answered: 0, turned_into_article: 0, archived: 0 };

    try {
      questions = await db.userQuestion.findMany({
        where,
        orderBy: [{ createdAt: "desc" }],
      });
      counts = {
        all: await db.userQuestion.count(),
        new: await db.userQuestion.count({ where: { status: "new" } }),
        in_review: await db.userQuestion.count({ where: { status: "in_review" } }),
        answered: await db.userQuestion.count({ where: { status: "answered" } }),
        turned_into_article: await db.userQuestion.count({ where: { status: "turned_into_article" } }),
        archived: await db.userQuestion.count({ where: { status: "archived" } }),
      };
    } catch (dbError: any) {
      const prismaCode = dbError?.code;
      const prismaMessage = dbError?.message;
      console.error("[api/admin/questions GET] Prisma error:", { code: prismaCode, message: prismaMessage });

      if (prismaCode === "P2021" || prismaCode === "P2022" || prismaCode === "P1003" ||
          /relation .* does not exist/i.test(prismaMessage || "") ||
          /table .* does not exist/i.test(prismaMessage || "")) {
        return NextResponse.json({
          error: "UserQuestion table not found in the database. The Prisma migration has not been applied to production yet.",
          prismaCode,
          questions: [],
          counts,
        }, { status: 500 });
      }
      throw dbError;
    }

    return NextResponse.json({
      questions: questions.map((q) => ({
        id: q.id,
        question: q.question,
        askerName: q.askerName || "Anonymous",
        askerEmail: q.askerEmail,
        askerUserId: q.askerUserId,
        category: q.category || "",
        answer: q.adminNotes || "", // admin's answer is stored in adminNotes
        status: q.status,
        articleId: q.articleId,
        createdAt: q.createdAt.toISOString(),
      })),
      counts,
    });
  } catch (error: any) {
    console.error("[api/admin/questions GET] Error:", error);
    return NextResponse.json({
      error: "Failed to load questions",
      detail: error?.message || String(error),
      code: error?.code,
      questions: [],
      counts: { all: 0, new: 0, in_review: 0, answered: 0, turned_into_article: 0, archived: 0 },
    }, { status: 500 });
  }
}

/**
 * POST /api/admin/questions
 * Admin-only — performs a moderation action on a question OR creates a new Q&A.
 *
 * Two modes:
 *
 * Mode 1 — Moderation action:
 *   Body: { id, action, answer? }
 *   Actions:
 *     answer   → sets adminNotes=answer, status='answered'
 *     close    → sets status='archived'
 *     reopen   → sets status='new', clears adminNotes
 *     review   → sets status='in_review'
 *
 * Mode 2 — Admin creates a Q&A (question + answer):
 *   Body: { question, answer, category?, askerName? }
 *   Creates a new UserQuestion with status='answered' and adminNotes=answer.
 *   This lets admin pre-populate the Q&A with common questions + answers.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.response) return auth.response;

    const body = await req.json();

    // ─── Mode 2: Admin creates a new Q&A ───
    // If `question` is present (and no `id`), create a new answered Q&A.
    if (body.question && !body.id) {
      const questionText = String(body.question).trim().slice(0, 2000);
      if (!questionText) {
        return NextResponse.json({ error: "Question is required." }, { status: 400 });
      }
      const answerText = body.answer ? String(body.answer).trim().slice(0, 10000) : "";
      const category = body.category ? String(body.category).slice(0, 100) : null;
      const askerName = body.askerName ? String(body.askerName).slice(0, 200) : "Koino";

      const question = await db.userQuestion.create({
        data: {
          question: questionText,
          askerName,
          askerEmail: auth.user.email,
          askerUserId: auth.user.id,
          category,
          status: answerText ? "answered" : "new",
          adminNotes: answerText || null,
        },
      });

      console.log(`[api/admin/questions POST] Admin-created Q&A: ${question.id} (by ${auth.user.email})`);

      try { revalidatePath("/", "layout"); } catch {}

      return NextResponse.json({
        success: true,
        questionId: question.id,
        status: question.status,
        message: answerText ? "Q&A created successfully." : "Question created successfully.",
      });
    }

    // ─── Mode 1: Moderation action ───
    const { id, action, answer } = body;

    if (!id || !action) {
      return NextResponse.json({ error: "Missing id or action" }, { status: 400 });
    }

    const validActions = ["answer", "close", "reopen", "review", "turn_into_article"];
    if (!validActions.includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const existing = await db.userQuestion.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    // ─── Turn Into Article ──────────────────────────────────────────
    // Creates a new KoinoArticle with contentType=APOLOGETICS, status=draft,
    // using the question as the title + starting content. Links the
    // UserQuestion.articleId to the new article + sets status=turned_into_article.
    // The article is NOT automatically published — admin must review/edit/publish.
    if (action === "turn_into_article") {
      // If already turned into an article, return the existing articleId
      if (existing.articleId) {
        return NextResponse.json({
          success: true,
          articleId: existing.articleId,
          message: "This question was already turned into an article.",
        });
      }

      // Generate a unique slug from the question text (first 80 chars)
      const slugBase = (existing.question.slice(0, 80) || "apologetics-question")
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/[\s_-]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80) || "apologetics-question";

      // De-duplicate slug
      let slug = slugBase;
      let n = 2;
      while (n < 22) {
        const clash = await db.koinoArticle.findUnique({
          where: { slug },
          select: { id: true },
        });
        if (!clash) break;
        slug = `${slugBase}-${n}`;
        n += 1;
      }

      // Create the article — DRAFT, not published
      const article = await db.koinoArticle.create({
        data: {
          title: existing.question.slice(0, 300) || "Apologetics Question",
          slug,
          contentType: "APOLOGETICS",
          category: existing.category,
          excerpt: `A reader asked: "${existing.question.slice(0, 200)}..."`,
          content: `## Question\n\n${existing.question}\n\n## Answer\n\n_Write your answer here..._`,
          authorName: "Koino",
          status: "draft", // CRITICAL: not auto-published
          reviewedBy: auth.user.id,
          reviewedAt: new Date(),
        },
      });

      // Link the question to the article + update status
      await db.userQuestion.update({
        where: { id },
        data: {
          status: "turned_into_article",
          articleId: article.id,
        },
      });

      console.log(`[api/admin/questions POST] Question ${id} → Article ${article.id} (draft, by ${auth.user.email})`);

      try { revalidatePath("/", "layout"); } catch {}

      return NextResponse.json({
        success: true,
        articleId: article.id,
        articleSlug: article.slug,
        message: "Question turned into a draft article. Edit and publish it from the Articles tab.",
      });
    }

    // ─── Other moderation actions (answer/close/reopen/review) ──────
    let newStatus = existing.status;
    let newAdminNotes = existing.adminNotes;

    switch (action) {
      case "answer":
        if (!answer || !String(answer).trim()) {
          return NextResponse.json({ error: "Answer text is required" }, { status: 400 });
        }
        newAdminNotes = String(answer).trim().slice(0, 10000);
        newStatus = "answered";
        break;
      case "close":
        newStatus = "archived";
        break;
      case "reopen":
        newStatus = "new";
        newAdminNotes = null; // clear the answer when reopening
        break;
      case "review":
        newStatus = "in_review";
        break;
    }

    const updated = await db.userQuestion.update({
      where: { id },
      data: {
        status: newStatus,
        adminNotes: newAdminNotes,
      },
    });

    console.log(`[api/admin/questions POST] Question ${id}: ${existing.status} → ${newStatus} (by ${auth.user.email})`);

    try { revalidatePath("/", "layout"); } catch {}

    return NextResponse.json({
      success: true,
      question: {
        id: updated.id,
        status: updated.status,
        answer: updated.adminNotes || "",
      },
    });
  } catch (error: any) {
    console.error("[api/admin/questions POST] Error:", error);
    return NextResponse.json({ error: "Failed to update question" }, { status: 500 });
  }
}
