import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

/**
 * GET /api/comic/list
 *
 * Returns all active comic chapters (for the chapter selector / sidebar).
 * Does NOT include panel content — just chapter metadata.
 *
 * Response:
 *   { chapters: [{ id, comicId, bookId, chapter, title, coverArtUrl, sortOrder }] }
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
        coverArtUrl: true,
        sortOrder: true,
      },
    });

    return NextResponse.json({ chapters });
  } catch (error: any) {
    console.error("[comic/list] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to list comics" }, { status: 500 });
  }
}
