import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getAuthUser } from "@/lib/auth-server";

const db = new PrismaClient();

async function requireAdmin() {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") return null;
  return user;
}

/**
 * DELETE /api/admin/comics/[id]/quiz/[questionId]
 *
 * Unlink a TriviaQuestion from this chapter. This only deletes the
 * ComicChapterQuiz join row — the TriviaQuestion itself is untouched.
 *
 * Deleting the link does NOT roll back any TriviaQuestionAttempt records
 * already earned by users — those are scored by questionId, not by
 * chapter, so anti-farming is preserved across chapter changes.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; questionId: string }> }
) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { id, questionId } = await params;

    const existing = await db.comicChapterQuiz.findUnique({
      where: {
        comicChapterId_questionId: { comicChapterId: id, questionId },
      },
    });
    if (!existing) {
      return NextResponse.json({ error: "Quiz link not found" }, { status: 404 });
    }

    await db.comicChapterQuiz.delete({
      where: {
        comicChapterId_questionId: { comicChapterId: id, questionId },
      },
    });

    return NextResponse.json({ success: true, unlinkedQuestionId: questionId });
  } catch (e: any) {
    console.error("[admin/comics/[id]/quiz/[questionId]] DELETE error:", e);
    return NextResponse.json({ error: e.message || "Failed to unlink question" }, { status: 500 });
  }
}
