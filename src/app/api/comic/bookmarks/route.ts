import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { BIBLE_BOOKS } from "@/lib/bible-data";
import { db } from "@/lib/db";

function parsePages(raw: unknown): number[] | null {
  if (!Array.isArray(raw)) return null;
  const pages: number[] = [];
  for (const p of raw) {
    const n = typeof p === "number" ? p : parseInt(String(p), 10);
    if (!Number.isFinite(n) || n < 1 || n > 10000) return null;
    pages.push(Math.floor(n));
  }
  return Array.from(new Set(pages)).sort((a, b) => a - b);
}

/**
 * GET /api/comic/bookmarks
 *
 * All comic story bookmarks for the signed-in user, keyed
 * "${bookId}-${chapter}" → sorted bookmarked page numbers — the same shape
 * as the reader's localStorage store (cc_comic_bookmarks in ComicView), so
 * the reader can merge the two maps directly. A row existing means the story
 * is bookmarked in the member's library.
 *
 * Response: { bookmarks: { "1samuel-17": [3, 7], … } }
 */
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const rows = await db.comicBookmark.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      include: { comicChapter: { select: { bookId: true, chapter: true } } },
    });

    const bookmarks: Record<string, number[]> = {};
    for (const row of rows) {
      try {
        const parsed = JSON.parse(row.pages);
        // A row EXISTS means the story is bookmarked — pages may legitimately
        // be empty (story-level bookmark made in the library with no page
        // marks yet), and must still be reported.
        if (Array.isArray(parsed)) {
          bookmarks[`${row.comicChapter.bookId}-${row.comicChapter.chapter}`] = parsed
            .map((p) => (typeof p === "number" ? p : parseInt(String(p), 10)))
            .filter((p) => Number.isFinite(p) && p >= 1)
            .sort((a, b) => a - b);
        }
      } catch {
        /* corrupt row — treat as no bookmark */
      }
    }

    return NextResponse.json({ bookmarks });
  } catch (e: any) {
    console.error("[comic/bookmarks] GET error:", e);
    return NextResponse.json({ error: e.message || "Failed to load bookmarks" }, { status: 500 });
  }
}

/**
 * PUT /api/comic/bookmarks
 *
 * UPSERT one story's bookmark for the signed-in user. Two toggle sources,
 * one row per story:
 *   • READER page bookmarks — body { bookId, chapter, pages } — REPLACE
 *     semantics with the full sorted page list after every toggle. An EMPTY
 *     list removes the bookmark row (the user un-marked every page).
 *   • LIBRARY story bookmark — body { bookId, chapter, pages: [], storyLevel: true }
 *     — marks the story itself bookmarked with no page marks yet; an empty
 *     page list still CREATES the row.
 *
 * Response: { success: true, pages: number[], bookmarked: boolean }
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
    const pages = parsePages(body.pages);
    const storyLevel = body.storyLevel === true;

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
    if (pages === null) {
      return NextResponse.json({ error: "pages must be an array of page numbers" }, { status: 400 });
    }

    // Bookmarks may reference any story the member can read; published-only
    // keeps rows clean if a story is unpublished later.
    const comicChapter = await db.comicChapter.findUnique({
      where: { bookId_chapter: { bookId, chapter } },
      select: { id: true, status: true, isActive: true },
    });
    if (!comicChapter || !comicChapter.isActive || comicChapter.status !== "published") {
      return NextResponse.json({ error: "Comic story not found" }, { status: 404 });
    }

    if (pages.length === 0 && !storyLevel) {
      await db.comicBookmark.deleteMany({
        where: { userId: user.id, comicChapterId: comicChapter.id },
      });
      return NextResponse.json({ success: true, pages: [], bookmarked: false });
    }

    await db.comicBookmark.upsert({
      where: {
        userId_comicChapterId: { userId: user.id, comicChapterId: comicChapter.id },
      },
      create: {
        userId: user.id,
        comicChapterId: comicChapter.id,
        pages: JSON.stringify(pages),
      },
      update: { pages: JSON.stringify(pages) },
    });

    return NextResponse.json({ success: true, pages, bookmarked: true });
  } catch (e: any) {
    console.error("[comic/bookmarks] PUT error:", e);
    return NextResponse.json({ error: e.message || "Failed to save bookmark" }, { status: 500 });
  }
}
