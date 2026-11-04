import { NextRequest, NextResponse } from "next/server";

import { getAuthUser } from "@/lib/auth-server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { canonicalizeBibleRef } from "@/lib/bible-ref";

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

// Canonicalize an array of raw reference strings for storage. Any invalid ref
// fails the request with a clear message — refs are NEVER stored unvalidated.
function canonicalizeRefs(raw: unknown): { refs: string[] } | { error: string } {
  if (raw == null) return { refs: [] };
  const list = Array.isArray(raw)
    ? raw.map((v) => (typeof v === "string" ? v : String(v ?? "")))
    : typeof raw === "string"
      ? raw.split(",")
      : [];
  const refs: string[] = [];
  for (const item of list) {
    const trimmed = item.trim();
    if (!trimmed) continue;
    const result = canonicalizeBibleRef(trimmed);
    if ("error" in result) return { error: `Bible reference "${trimmed}": ${result.error}` };
    if (!refs.includes(result.canonical)) refs.push(result.canonical);
    if (refs.length >= 20) break;
  }
  return { refs };
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
          /table .* does not exist/i.test(prismaMessage || "") ||
          /column .* does not exist/i.test(prismaMessage || "")) {
        // Migration window: the PART 2 columns may not exist yet. Retry with
        // only the pre-PART-2 columns so the admin Q&A list still works.
        try {
          const legacy = await db.userQuestion.findMany({
            where,
            orderBy: [{ createdAt: "desc" }],
            select: {
              id: true, question: true, askerName: true, askerEmail: true,
              askerUserId: true, category: true, status: true, adminNotes: true,
              articleId: true, createdAt: true,
            },
          });
          return NextResponse.json({
            questions: legacy.map((q) => ({
              id: q.id,
              question: q.question,
              askerName: q.askerName || "Anonymous",
              askerEmail: q.askerEmail,
              askerUserId: q.askerUserId,
              category: q.category || "",
              answer: q.adminNotes || "",
              answeredByName: null,
              bibleRefs: [] as string[],
              contributorAnswer: null,
              contributorAnswerName: null,
              contributorAnswerStatus: null,
              status: q.status,
              articleId: q.articleId,
              createdAt: q.createdAt.toISOString(),
            })),
            counts,
            migrationPending: true,
          });
        } catch {
          return NextResponse.json({
            error: "UserQuestion table not found in the database. The Prisma migration has not been applied to production yet.",
            prismaCode,
            questions: [],
            counts,
          }, { status: 500 });
        }
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
        answeredByName: q.answeredByName || null,
        bibleRefs: safeParseJson<string[]>(q.bibleRefs, []),
        contributorAnswer: q.contributorAnswer || null,
        contributorAnswerName: q.contributorAnswerName || null,
        contributorAnswerStatus: q.contributorAnswerStatus || null,
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

      // PART 2: optional validated Bible references on admin-created Q&As
      let refsJson = "[]";
      if (body.bibleRefs != null) {
        const refs = canonicalizeRefs(body.bibleRefs);
        if ("error" in refs) {
          return NextResponse.json({ error: refs.error }, { status: 400 });
        }
        refsJson = JSON.stringify(refs.refs);
      }

      const question = await db.userQuestion.create({
        data: {
          question: questionText,
          askerName,
          askerEmail: auth.user.email,
          askerUserId: auth.user.id,
          category,
          status: answerText ? "answered" : "new",
          adminNotes: answerText || null,
          bibleRefs: refsJson,
          answeredByName: answerText ? auth.user.name || "Koino Team" : null,
          answeredByUserId: answerText ? auth.user.id : null,
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

    const validActions = [
      "answer", "close", "reopen", "review", "turn_into_article",
      "update", // PART 2: edit question text / category / bibleRefs
      "approve_contributor_answer", // PART 2: promote a contributor's proposed answer
      "reject_contributor_answer", // PART 2: reject a contributor's proposed answer
    ];
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
          content: `## Question\n\n${existing.question}\n\n## Answer\n\n${existing.adminNotes?.trim() || "_Write your answer here..._"}`,
          authorName: existing.answeredByName || "Koino",
          status: "draft", // CRITICAL: not auto-published
          // PART 2: preserve everything — refs, attribution, back-link
          bibleRefs: existing.bibleRefs || "[]",
          sourceQuestionId: existing.id,
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

    // PART 2: edit question text / category / bibleRefs without touching status.
    if (action === "update") {
      const data: any = {};
      if (Object.prototype.hasOwnProperty.call(body, "question")) {
        const q = typeof body.question === "string" ? body.question.trim() : "";
        if (!q) return NextResponse.json({ error: "Question text cannot be empty" }, { status: 400 });
        data.question = q.slice(0, 2000);
      }
      if (Object.prototype.hasOwnProperty.call(body, "category")) {
        const c = typeof body.category === "string" ? body.category.trim() : "";
        data.category = c ? c.slice(0, 100) : null;
      }
      if (Object.prototype.hasOwnProperty.call(body, "bibleRefs")) {
        const refs = canonicalizeRefs(body.bibleRefs);
        if ("error" in refs) return NextResponse.json({ error: refs.error }, { status: 400 });
        data.bibleRefs = JSON.stringify(refs.refs);
      }
      const updatedQ = await db.userQuestion.update({ where: { id }, data });
      try { revalidatePath("/", "layout"); } catch {}
      return NextResponse.json({
        success: true,
        question: {
          id: updatedQ.id,
          status: updatedQ.status,
          question: updatedQ.question,
          category: updatedQ.category,
          bibleRefs: safeParseJson<string[]>(updatedQ.bibleRefs, []),
        },
      });
    }

    // PART 2: contributor answer review.
    if (action === "approve_contributor_answer" || action === "reject_contributor_answer") {
      if (!existing.contributorAnswer || existing.contributorAnswerStatus !== "pending") {
        return NextResponse.json({ error: "No pending contributor answer on this question" }, { status: 400 });
      }
      if (action === "approve_contributor_answer") {
        // The proposal becomes the OFFICIAL answer, credited to the contributor.
        const updatedQ = await db.userQuestion.update({
          where: { id },
          data: {
            adminNotes: existing.contributorAnswer,
            answeredByName: existing.contributorAnswerName,
            answeredByUserId: existing.contributorAnswerUserId,
            contributorAnswerStatus: "approved",
            status: "answered",
          },
        });
        try { revalidatePath("/", "layout"); } catch {}
        console.log(`[api/admin/questions POST] Contributor answer approved on ${id} (by ${auth.user.email})`);
        return NextResponse.json({
          success: true,
          question: { id: updatedQ.id, status: updatedQ.status, answer: updatedQ.adminNotes || "", answeredByName: updatedQ.answeredByName },
        });
      }
      const updatedQ = await db.userQuestion.update({
        where: { id },
        data: { contributorAnswerStatus: "rejected" },
      });
      try { revalidatePath("/", "layout"); } catch {}
      return NextResponse.json({
        success: true,
        question: { id: updatedQ.id, status: updatedQ.status, contributorAnswerStatus: updatedQ.contributorAnswerStatus },
      });
    }

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

    const updateData: any = {
      status: newStatus,
      adminNotes: newAdminNotes,
    };
    // PART 2: attribute the official answer to whoever wrote it
    if (action === "answer" && newStatus === "answered") {
      updateData.answeredByName = auth.user.name || "Koino Team";
      updateData.answeredByUserId = auth.user.id;
    }

    const updated = await db.userQuestion.update({
      where: { id },
      data: updateData,
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
