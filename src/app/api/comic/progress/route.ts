import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { BIBLE_BOOKS } from "@/lib/bible-data";
import { db } from "@/lib/db";

/**
 * GET /api/comic/progress
 *
 * All comic reading progress for the signed-in user, keyed
 * "${bookId}-${chapter}" — the exact shape of the reader's localStorage
 * store (cc_comic_progress in @/lib/bible-data), so the reader/library can
 * merge the two maps directly. Server progress is how "resume on another
 * device" works; guests simply never call this.
 *
 * Response: { progress: { "1samuel-17": { bookId, chapter, lastPanel,
 *                          totalPanels, completed, startedAt, updatedAt }, … } }
 */
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const rows = await db.comicReadingProgress.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      include: { comicChapter: { select: { bookId: true, chapter: true } } },
    });

    const progress: Record<
      string,
      {
        bookId: string;
        chapter: number;
        lastPanel: number;
        totalPanels: number;
        completed: boolean;
        startedAt: number;
        updatedAt: number;
      }
    > = {};
    for (const row of rows) {
      progress[`${row.comicChapter.bookId}-${row.comicChapter.chapter}`] = {
        bookId: row.comicChapter.bookId,
        chapter: row.comicChapter.chapter,
        lastPanel: row.lastPanel,
        totalPanels: row.totalPanels,
        completed: row.completed,
        startedAt: row.startedAt.getTime(),
        updatedAt: row.updatedAt.getTime(),
      };
    }

    return NextResponse.json({ progress });
  } catch (e: any) {
    console.error("[comic/progress] GET error:", e);
    return NextResponse.json({ error: e.message || "Failed to load progress" }, { status: 500 });
  }
}

/**
 * PUT /api/comic/progress
 *
 * UPSERT one story's progress for the signed-in user. The unique
 * (userId, comicChapterId) constraint guarantees a single row per story —
 * duplicate progress records are impossible by construction.
 *
 * Body: { bookId, chapter, lastPanel, totalPanels }
 *   • bookId must be a real Koino Bible book (BIBLE_BOOKS) and chapter within
 *     its chapter count — progress can only exist for stories anchored to the
 *     existing Bible.
 *   • lastPanel/totalPanels are clamped to sane ranges; `completed` is
 *     computed SERVER-SIDE (never trusted from the client).
 *   • Progress never regresses: the stored lastPanel is the highest ever
 *     seen (same merge policy as the local store).
 *
 * Response: { success: true, progress: { …same shape as GET entries… } }
 */
export async function PUT(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await req.json();
    const bookId = typeof body.bookId === "string" ? body.bookId : "";
    const chapter =
      typeof body.chapter === "number" ? body.chapter : parseInt(body.chapter, 10);
    const lastPanelRaw =
      typeof body.lastPanel === "number" ? body.lastPanel : parseInt(body.lastPanel, 10);
    const totalPanelsRaw =
      typeof body.totalPanels === "number" ? body.totalPanels : parseInt(body.totalPanels, 10);

    if (!bookId || !BIBLE_BOOKS.some((b) => b.id === bookId)) {
      return NextResponse.json({ error: "Invalid bookId" }, { status: 400 });
    }
    const book = BIBLE_BOOKS.find((b) => b.id === bookId)!;
    if (!Number.isFinite(chapter) || chapter < 1 || chapter > book.chapters) {
      return NextResponse.json(
        { error: `chapter must be between 1 and ${book.chapters} for ${bookId}` },
        { status: 400 }
      );
    }
    if (!Number.isFinite(lastPanelRaw) || lastPanelRaw < 0) {
      return NextResponse.json({ error: "Invalid lastPanel" }, { status: 400 });
    }
    if (!Number.isFinite(totalPanelsRaw) || totalPanelsRaw < 0 || totalPanelsRaw > 10000) {
      return NextResponse.json({ error: "Invalid totalPanels" }, { status: 400 });
    }

    // The story must exist AND be published — progress rows never dangle on
    // unpublished/deleted content.
    const comicChapter = await db.comicChapter.findUnique({
      where: { bookId_chapter: { bookId, chapter } },
      select: { id: true, status: true, isActive: true },
    });
    if (!comicChapter || !comicChapter.isActive || comicChapter.status !== "published") {
      return NextResponse.json({ error: "Comic story not found" }, { status: 404 });
    }

    const incomingLastPanel = Math.min(
      Math.floor(lastPanelRaw),
      Math.max(Math.floor(totalPanelsRaw), 0)
    );
    const totalPanels = Math.floor(totalPanelsRaw);

    // Read-merge-upsert: lastPanel is the highest ever seen (never regresses),
    // completed is always computed server-side from the merged value.
    const existing = await db.comicReadingProgress.findUnique({
      where: {
        userId_comicChapterId: { userId: user.id, comicChapterId: comicChapter.id },
      },
      select: { lastPanel: true },
    });
    const lastPanel = Math.max(incomingLastPanel, existing?.lastPanel ?? 0);
    const completed = totalPanels > 0 && lastPanel >= totalPanels;

    const row = await db.comicReadingProgress.upsert({
      where: {
        userId_comicChapterId: { userId: user.id, comicChapterId: comicChapter.id },
      },
      create: {
        userId: user.id,
        comicChapterId: comicChapter.id,
        lastPanel,
        totalPanels,
        completed,
      },
      update: { lastPanel, totalPanels, completed },
    });

    return NextResponse.json({
      success: true,
      progress: {
        bookId,
        chapter,
        lastPanel: row.lastPanel,
        totalPanels: row.totalPanels,
        completed: row.completed,
        startedAt: row.startedAt.getTime(),
        updatedAt: row.updatedAt.getTime(),
      },
    });
  } catch (e: any) {
    console.error("[comic/progress] PUT error:", e);
    return NextResponse.json({ error: e.message || "Failed to save progress" }, { status: 500 });
  }
}

/**
 * DELETE /api/comic/progress
 *
 * Reset progress — "Reset progress if desired" (spec Part 2 §4).
 *   ?bookId=&chapter=  → reset ONE story
 *   (no params)        → reset EVERYTHING for the signed-in user
 *
 * Response: { success: true, deleted: <n> }
 */
export async function DELETE(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const url = new URL(req.url);
    const bookId = url.searchParams.get("bookId");
    const chapterStr = url.searchParams.get("chapter");

    if (bookId && chapterStr) {
      const chapter = parseInt(chapterStr, 10);
      if (!Number.isFinite(chapter)) {
        return NextResponse.json({ error: "Invalid chapter" }, { status: 400 });
      }
      const comicChapter = await db.comicChapter.findUnique({
        where: { bookId_chapter: { bookId, chapter } },
        select: { id: true },
      });
      if (!comicChapter) {
        return NextResponse.json({ success: true, deleted: 0 });
      }
      const deleted = await db.comicReadingProgress.deleteMany({
        where: { userId: user.id, comicChapterId: comicChapter.id },
      });
      return NextResponse.json({ success: true, deleted: deleted.count });
    }

    const deleted = await db.comicReadingProgress.deleteMany({ where: { userId: user.id } });
    return NextResponse.json({ success: true, deleted: deleted.count });
  } catch (e: any) {
    console.error("[comic/progress] DELETE error:", e);
    return NextResponse.json({ error: e.message || "Failed to reset progress" }, { status: 500 });
  }
}
