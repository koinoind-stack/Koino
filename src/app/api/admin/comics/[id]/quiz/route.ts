import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getAuthUser } from "@/lib/auth-server";

const db = new PrismaClient();

async function requireAdmin() {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") return null;
  return user;
}

function safeParseArray(raw: string | null | undefined): any[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * GET /api/admin/comics/[id]/quiz
 *
 * Returns the TriviaQuestion records linked to this chapter via the
 * ComicChapterQuiz join table. This is what powers the "Quiz Manager" in the
 * CMS editor — admins see the linked questions, can search TriviaQuestion to
 * add more, and can unlink.
 *
 * Optional query param: ?q=search — searches question text across ALL
 * TriviaQuestion records (used by the "search to add" UI). When ?q is set,
 * we return BOTH the linked list AND a separate "search results" array.
 *
 * Response (no ?q):
 *   { linked: [{ questionId, question, difficulty, category, sortOrder }] }
 * Response (with ?q):
 *   { linked: [...], searchResults: [{ questionId, question, difficulty, category }] }
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { id } = await params;

    // Verify chapter exists
    const chapter = await db.comicChapter.findUnique({
      where: { id },
      select: { id: true, title: true },
    });
    if (!chapter) {
      return NextResponse.json({ error: "Chapter not found" }, { status: 404 });
    }

    // Fetch linked questions, joined with their TriviaQuestion records.
    const links = await db.comicChapterQuiz.findMany({
      where: { comicChapterId: id },
      orderBy: { sortOrder: "asc" },
      include: {
        // ComicChapterQuiz.questionId is a STRING FK to TriviaQuestion.questionId.
        // We use a relation query but Prisma doesn't have a declared relation
        // here — so we do a manual lookup below.
      },
    });

    // Manual lookup: pull all the linked TriviaQuestion records in one query.
    const linkedQuestionIds = links.map((l) => l.questionId);
    const linkedQuestions = linkedQuestionIds.length
      ? await db.triviaQuestion.findMany({
          where: { questionId: { in: linkedQuestionIds } },
          select: {
            questionId: true,
            question: true,
            difficulty: true,
            category: true,
            bibleBook: true,
            isActive: true,
            options: true,
            correctAnswer: true,
          },
        })
      : [];

    const linkedMap = new Map(linkedQuestions.map((q) => [q.questionId, q]));

    const linked = links
      .map((l) => {
        const q = linkedMap.get(l.questionId);
        if (!q) {
          // Question was deleted from TriviaQuestion — return a placeholder
          // so the admin sees the dangling link and can unlink it.
          return {
            questionId: l.questionId,
            question: "[Deleted question]",
            difficulty: "—",
            category: "—",
            bibleBook: null,
            isActive: false,
            sortOrder: l.sortOrder,
            isDangling: true,
          };
        }
        return {
          questionId: q.questionId,
          question: q.question,
          difficulty: q.difficulty,
          category: q.category,
          bibleBook: q.bibleBook,
          isActive: q.isActive,
          sortOrder: l.sortOrder,
          isDangling: false,
        };
      });

    // Optional search
    const url = new URL(req.url);
    const q = url.searchParams.get("q")?.toLowerCase().trim() || "";

    let searchResults: any[] = [];
    if (q) {
      const matches = await db.triviaQuestion.findMany({
        where: {
          AND: [
            { isActive: true },
            {
              OR: [
                { question: { contains: q, mode: "insensitive" } },
                { questionId: { contains: q, mode: "insensitive" } },
                { bibleBook: { contains: q, mode: "insensitive" } },
                { topic: { contains: q, mode: "insensitive" } },
              ],
            },
          ],
        },
        take: 25,
        orderBy: { questionId: "asc" },
        select: {
          questionId: true,
          question: true,
          difficulty: true,
          category: true,
          bibleBook: true,
          options: true,
        },
      });

      searchResults = matches.map((m) => ({
        questionId: m.questionId,
        question: m.question,
        difficulty: m.difficulty,
        category: m.category,
        bibleBook: m.bibleBook,
        options: safeParseArray(m.options),
        // Tell the UI whether this question is already linked
        isLinked: linkedQuestionIds.includes(m.questionId),
      }));
    }

    return NextResponse.json({ linked, searchResults });
  } catch (e: any) {
    console.error("[admin/comics/[id]/quiz] GET error:", e);
    return NextResponse.json({ error: e.message || "Failed to load quiz links" }, { status: 500 });
  }
}

/**
 * POST /api/admin/comics/[id]/quiz
 *
 * Link an existing TriviaQuestion to this chapter. The questionId must exist
 * in TriviaQuestion — we don't auto-create questions here (admins use the
 * existing Trivia admin for that). The new link's sortOrder is set to
 * max(existing) + 1 so questions appear in the order they were added.
 *
 * Body: { questionId: string }
 *
 * The @@unique([comicChapterId, questionId]) on ComicChapterQuiz prevents
 * double-linking at the DB level.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const questionId = body.questionId;

    if (typeof questionId !== "string" || !questionId.trim()) {
      return NextResponse.json({ error: "questionId is required" }, { status: 400 });
    }

    // Verify chapter
    const chapter = await db.comicChapter.findUnique({ where: { id } });
    if (!chapter) {
      return NextResponse.json({ error: "Chapter not found" }, { status: 404 });
    }

    // Verify question exists
    const question = await db.triviaQuestion.findUnique({ where: { questionId } });
    if (!question) {
      return NextResponse.json({ error: `Trivia question "${questionId}" not found` }, { status: 404 });
    }

    // Find next sortOrder
    const existingLink = await db.comicChapterQuiz.findFirst({
      where: { comicChapterId: id },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    const nextSort = existingLink ? existingLink.sortOrder + 1 : 1;

    // Check for duplicate link (DB also enforces, but we want a friendly message)
    const dup = await db.comicChapterQuiz.findUnique({
      where: {
        comicChapterId_questionId: { comicChapterId: id, questionId },
      },
    });
    if (dup) {
      return NextResponse.json(
        { error: "This question is already linked to this chapter" },
        { status: 409 }
      );
    }

    await db.comicChapterQuiz.create({
      data: {
        comicChapterId: id,
        questionId,
        sortOrder: nextSort,
      },
    });

    return NextResponse.json({
      success: true,
      questionId,
      sortOrder: nextSort,
    });
  } catch (e: any) {
    console.error("[admin/comics/[id]/quiz] POST error:", e);
    return NextResponse.json({ error: e.message || "Failed to link question" }, { status: 500 });
  }
}
