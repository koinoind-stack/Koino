import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

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
 * GET /api/comic/[bookId]/[chapter]
 *
 * Returns a comic chapter with all panels + their translations for the
 * requested language. Falls back to English for any missing translations.
 *
 * Query params:
 *   lang — "en" (default), "hi", "te", etc.
 *
 * Response:
 *   { chapter: { id, comicId, bookId, chapter, title, coverArtUrl, panels: [...] } }
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ bookId: string; chapter: string }> }
) {
  try {
    const { bookId, chapter: chapterStr } = await params;
    const chapter = parseInt(chapterStr, 10);

    if (isNaN(chapter) || chapter < 1) {
      return NextResponse.json({ error: "Invalid chapter number" }, { status: 400 });
    }

    // Get lang from query string
    const url = new URL(req.url);
    const lang = url.searchParams.get("lang") || "en";
    const validLangs = ["en", "hi", "bn", "te", "mr", "ta", "gu", "ur", "kn", "or", "ml", "pa", "as"];
    if (!validLangs.includes(lang)) {
      return NextResponse.json({ error: "Invalid language code" }, { status: 400 });
    }

    // Find the comic chapter — only PUBLISHED chapters are visible to users
    const comicChapter = await db.comicChapter.findFirst({
      where: { bookId, chapter, isActive: true, status: "published" },
      include: {
        panels: {
          orderBy: { sortOrder: "asc" },
          include: {
            translations: true,
          },
        },
        translations: true,
      },
    });

    if (!comicChapter) {
      return NextResponse.json({ error: "Comic chapter not found" }, { status: 404 });
    }

    // Build the response — pick the right translation for each panel
    const chapterTranslation = comicChapter.translations.find((t) => t.lang === lang);
    const englishChapterTranslation = comicChapter.translations.find((t) => t.lang === "en");

    const panels = comicChapter.panels.map((panel) => {
      const panelTranslation = panel.translations.find((t) => t.lang === lang);
      const englishPanelTranslation = panel.translations.find((t) => t.lang === "en");

      // Use translated content if available, fall back to English
      const activeTranslation = panelTranslation || englishPanelTranslation;

      return {
        panelId: panel.panelId,
        sortOrder: panel.sortOrder,
        artworkUrl: panel.artworkUrl,
        verseStart: panel.verseStart,
        verseEnd: panel.verseEnd,
        bookId: panel.bookId,
        chapter: panel.chapter,
        audioUrl: panel.audioUrl || null,
        videoUrl: panel.videoUrl || null,
        title: activeTranslation?.title || null,
        narration: activeTranslation?.narration || null,
        captions: safeParseArray(activeTranslation?.captions),
        isFallback: !panelTranslation && !!englishPanelTranslation && lang !== "en",
        hasTranslation: !!panelTranslation,
      };
    });

    return NextResponse.json({
      chapter: {
        id: comicChapter.id,
        comicId: comicChapter.comicId,
        bookId: comicChapter.bookId,
        chapter: comicChapter.chapter,
        title: chapterTranslation?.title || englishChapterTranslation?.title || comicChapter.title,
        coverArtUrl: comicChapter.coverArtUrl,
        sortOrder: comicChapter.sortOrder,
        panels,
        // Whether the chapter title is a fallback
        titleIsFallback: !chapterTranslation && !!englishChapterTranslation && lang !== "en",
      },
      lang,
    });
  } catch (error: any) {
    console.error("[comic GET] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to load comic" }, { status: 500 });
  }
}
