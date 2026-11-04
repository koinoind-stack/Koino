import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Same accepted set as GET /api/comic/[bookId]/[chapter] and the admin
// translations endpoint — one canonical list of comic content languages.
const VALID_LANGS = ["en", "hi", "bn", "te", "mr", "ta", "gu", "ur", "kn", "or", "ml", "pa", "as"];

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
 * Query params:
 *   lang — "en" (default), "te", "hi", … When the chapter has a translation
 *          for that language its title is returned; otherwise the English
 *          (or base) title with titleIsFallback=true.
 *
 * Response:
 *   { chapters: [{ id, comicId, bookId, chapter, title, titleIsFallback,
 *                  description, coverArtUrl, sortOrder, panelCount }] }
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const lang = (url.searchParams.get("lang") || "en").toLowerCase();
    if (!VALID_LANGS.includes(lang)) {
      return NextResponse.json(
        { error: `Invalid language code. Allowed: ${VALID_LANGS.join(", ")}` },
        { status: 400 }
      );
    }

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
        // Only the title is needed here — panel text lives in the reader API.
        translations: { select: { lang: true, title: true } },
        _count: { select: { panels: true } },
      },
    });

    const mapped = chapters.map((ch) => {
      const langTitle = ch.translations.find((tr) => tr.lang === lang)?.title;
      const englishTitle = ch.translations.find((tr) => tr.lang === "en")?.title;
      const title = langTitle || englishTitle || ch.title;
      return {
        id: ch.id,
        comicId: ch.comicId,
        bookId: ch.bookId,
        chapter: ch.chapter,
        title,
        // true when we had to fall back (requested lang had no translation)
        titleIsFallback: !langTitle && lang !== "en",
        description: ch.description,
        coverArtUrl: ch.coverArtUrl,
        sortOrder: ch.sortOrder,
        panelCount: ch._count.panels,
      };
    });

    return NextResponse.json({ chapters: mapped, lang });
  } catch (error: any) {
    console.error("[comic/list] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to list comics" }, { status: 500 });
  }
}
