import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/comic/list
 *
 * Returns all active comic chapters (for the chapter selector / sidebar).
 * Does NOT include panel content — just chapter metadata.
 *
 * `description` is the editorial summary authored in the CMS (shown on
 * library chapter cards). `panelCount` comes from the ComicPanel relation
 * (shown on cards + used for a rough reading-time estimate).
 *
 * Response:
 *   { chapters: [{ id, comicId, bookId, chapter, title, description,
 *                  coverArtUrl, sortOrder, panelCount }] }
 */
export async function GET() {
  try {
    const chapters = await db.comicChapter.findMany({
      where: { isActive: true, status: "published" },
      orderBy: [{ bookId: "asc" }, { chapter: "asc" }],
      select: {
        id: true,
        comicId: true,
        bookId: true,
        chapter: true,
        title: true,
        description: true,
        coverArtUrl: true,
        sortOrder: true,
        _count: { select: { panels: true } },
      },
    });

    const mapped = chapters.map((ch) => ({
      id: ch.id,
      comicId: ch.comicId,
      bookId: ch.bookId,
      chapter: ch.chapter,
      title: ch.title,
      description: ch.description,
      coverArtUrl: ch.coverArtUrl,
      sortOrder: ch.sortOrder,
      panelCount: ch._count.panels,
    }));

    return NextResponse.json({ chapters: mapped });
  } catch (error: any) {
    console.error("[comic/list] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to list comics" }, { status: 500 });
  }
}
