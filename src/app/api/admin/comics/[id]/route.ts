import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getAuthUser } from "@/lib/auth-server";
import { BIBLE_BOOKS } from "@/lib/bible-data";

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

function isValidBook(bookId: string): boolean {
  return BIBLE_BOOKS.some((b) => b.id === bookId);
}

function getBookChapterCount(bookId: string): number {
  const book = BIBLE_BOOKS.find((b) => b.id === bookId);
  return book?.chapters ?? 0;
}

/**
 * GET /api/admin/comics/[id]
 *
 * Returns a single comic chapter with ALL panels (sorted by sortOrder) and
 * every translation for each panel. Used by the CMS editor view.
 *
 * Response shape mirrors /api/comic/[bookId]/[chapter] but includes raw
 * translation rows instead of pre-picking a single lang.
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

    const chapter = await db.comicChapter.findUnique({
      where: { id },
      include: {
        panels: {
          orderBy: { sortOrder: "asc" },
          include: {
            translations: true,
          },
        },
        translations: true,
        quizLinks: {
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    if (!chapter) {
      return NextResponse.json({ error: "Chapter not found" }, { status: 404 });
    }

    return NextResponse.json({
      chapter: {
        id: chapter.id,
        comicId: chapter.comicId,
        bookId: chapter.bookId,
        chapter: chapter.chapter,
        title: chapter.title,
        description: chapter.description || "",
        adminNotes: chapter.adminNotes || "",
        status: chapter.status,
        coverArtUrl: chapter.coverArtUrl,
        sortOrder: chapter.sortOrder,
        isActive: chapter.isActive,
        createdAt: chapter.createdAt.toISOString(),
        updatedAt: chapter.updatedAt.toISOString(),
        chapterTranslations: chapter.translations.map((t) => ({
          id: t.id,
          lang: t.lang,
          title: t.title || "",
        })),
        panels: chapter.panels.map((p) => ({
          id: p.id,
          panelId: p.panelId,
          sortOrder: p.sortOrder,
          artworkUrl: p.artworkUrl,
          altText: p.altText || "",
          verseStart: p.verseStart,
          verseEnd: p.verseEnd,
          bookId: p.bookId,
          chapter: p.chapter,
          audioUrl: p.audioUrl || null,
          videoUrl: p.videoUrl || null,
          translations: p.translations.map((t) => ({
            id: t.id,
            lang: t.lang,
            title: t.title || "",
            narration: t.narration || "",
            captions: safeParseArray(t.captions),
          })),
        })),
        quizLinks: chapter.quizLinks.map((q) => ({
          id: q.id,
          questionId: q.questionId,
          sortOrder: q.sortOrder,
        })),
      },
    });
  } catch (e: any) {
    console.error("[admin/comics/[id]] GET error:", e);
    return NextResponse.json({ error: e.message || "Failed to load chapter" }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/comics/[id]
 *
 * Update chapter-level fields. Admins can edit the title, description, status,
 * cover image, and admin notes here. Panel-level edits go through /panels/[panelId].
 *
 * Body (any subset of):
 *   title, description, adminNotes, coverArtUrl, sortOrder, bookId, chapter, status
 *
 * If bookId or chapter changes, the comicId is regenerated to match.
 */
export async function PATCH(
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

    const existing = await db.comicChapter.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Chapter not found" }, { status: 404 });
    }

    const data: any = {};

    // ─── Optional bookId / chapter move ─────────────────────────────
    // If the admin changes either one, we need to:
    //   1. Validate the new combo
    //   2. Make sure no OTHER chapter already occupies that (bookId, chapter) slot
    //   3. Regenerate comicId
    //   4. Cascade-update denormalized bookId/chapter on every panel
    const newBookId = typeof body.bookId === "string" ? body.bookId : existing.bookId;
    const newChapter =
      typeof body.chapter === "number"
        ? body.chapter
        : parseInt(body.chapter, 10) || existing.chapter;

    if (newBookId !== existing.bookId || newChapter !== existing.chapter) {
      if (!isValidBook(newBookId)) {
        return NextResponse.json({ error: "Invalid bookId" }, { status: 400 });
      }
      if (newChapter < 1 || newChapter > getBookChapterCount(newBookId)) {
        return NextResponse.json(
          {
            error: `chapter must be between 1 and ${getBookChapterCount(newBookId)} for ${newBookId}`,
          },
          { status: 400 }
        );
      }
      const clash = await db.comicChapter.findFirst({
        where: {
          AND: [{ bookId: newBookId }, { chapter: newChapter }, { id: { not: id } }],
        },
        select: { id: true },
      });
      if (clash) {
        return NextResponse.json(
          { error: `Another chapter already exists for ${newBookId} ${newChapter}` },
          { status: 409 }
        );
      }

      data.bookId = newBookId;
      data.chapter = newChapter;
      data.comicId = `${newBookId}-${newChapter}`;
    }

    // ─── Standard scalar updates ───────────────────────────────────
    if (typeof body.title === "string") {
      if (body.title.trim().length < 1) {
        return NextResponse.json({ error: "title cannot be empty" }, { status: 400 });
      }
      data.title = body.title.trim();
    }
    if (body.description !== undefined) {
      data.description =
        typeof body.description === "string" && body.description.trim()
          ? body.description.trim()
          : null;
    }
    if (body.adminNotes !== undefined) {
      data.adminNotes =
        typeof body.adminNotes === "string" && body.adminNotes.trim()
          ? body.adminNotes.trim()
          : null;
    }
    if (body.coverArtUrl !== undefined) {
      data.coverArtUrl =
        typeof body.coverArtUrl === "string" && body.coverArtUrl.trim()
          ? body.coverArtUrl.trim()
          : null;
    }
    if (typeof body.sortOrder === "number") {
      data.sortOrder = body.sortOrder;
    }
    if (typeof body.status === "string") {
      const allowed = ["draft", "review", "ready", "published"];
      if (!allowed.includes(body.status)) {
        return NextResponse.json(
          { error: `status must be one of: ${allowed.join(", ")}` },
          { status: 400 }
        );
      }
      // NOTE: setting status to "published" here is allowed for admin convenience
      // (it skips validation). The dedicated /publish endpoint runs validation
      // before publishing. This is intentional — admins sometimes need to
      // manually fix a chapter that was incorrectly marked published.
      data.status = body.status;
    }

    // If we moved the chapter, cascade-update the denormalized book/chapter on
    // every existing panel so verse lookups still work.
    if (data.bookId || data.chapter) {
      await db.comicPanel.updateMany({
        where: { comicChapterId: id },
        data: {
          bookId: data.bookId ?? existing.bookId,
          chapter: data.chapter ?? existing.chapter,
        },
      });
    }

    const updated = await db.comicChapter.update({ where: { id }, data });

    return NextResponse.json({
      success: true,
      chapter: {
        id: updated.id,
        comicId: updated.comicId,
        bookId: updated.bookId,
        chapter: updated.chapter,
        title: updated.title,
        status: updated.status,
      },
    });
  } catch (e: any) {
    console.error("[admin/comics/[id]] PATCH error:", e);
    return NextResponse.json({ error: e.message || "Failed to update chapter" }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/comics/[id]
 *
 * Hard-delete a chapter and all of its panels, translations, and quiz links.
 * The ComicPanel/ComicPanelTranslation/ComicChapterQuiz cascade rules in the
 * Prisma schema handle the cleanup automatically.
 *
 * We use hard-delete (not soft-delete) because comic chapters are content —
 * if an admin deletes one, they mean it. The chapter's quizLinks reference
 * trivia questions that belong to a different system; cascading the delete
 * just unlinks them (the TriviaQuestion rows themselves stay).
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { id } = await params;

    const existing = await db.comicChapter.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Chapter not found" }, { status: 404 });
    }

    await db.comicChapter.delete({ where: { id } });

    return NextResponse.json({ success: true, deletedId: id });
  } catch (e: any) {
    console.error("[admin/comics/[id]] DELETE error:", e);
    return NextResponse.json({ error: e.message || "Failed to delete chapter" }, { status: 500 });
  }
}
