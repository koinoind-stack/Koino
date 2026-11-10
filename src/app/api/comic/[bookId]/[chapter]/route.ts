import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

function safeParseArray(raw: string | null | undefined): any[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const VALID_LANGS = ["en", "hi", "bn", "te", "mr", "ta", "gu", "ur", "kn", "or", "ml", "pa", "as"] as const;
type Lang = (typeof VALID_LANGS)[number];

/**
 * GET /api/comic/[bookId]/[chapter]
 *
 * Returns a comic story (chapter) with all pages (panels) + their
 * translations for the requested language.
 *
 * MULTILINGUAL CONTRACT (Comic Bible redesign):
 *   • Artwork is language-independent — ONE image per page.
 *   • Only translation rows with status "published" are ever served. A draft
 *     translation is treated exactly like a missing one.
 *   • If the requested language does not fully cover the story, the response
 *     explicitly says so (languages[] availability map + langAvailable flag
 *     + per-panel isFallback) — the reader surfaces a "coming soon" notice
 *     instead of silently showing another language's text.
 *   • English (the base language) is served as the explicit fallback content,
 *     clearly flagged, never presented as the requested language.
 *
 * Query params:
 *   lang — "en" (default), "hi", "te", etc. (one of VALID_LANGS)
 *
 * Response:
 *   { chapter: {
 *       id, comicId, bookId, chapter, title, coverArtUrl, sortOrder,
 *       kidsFriendly, pageMode,
 *       titleIsFallback, langAvailable,
 *       introduction?, lesson?, prayer?, keyVerse {book,chapter,start,end} | null,
 *       languages: [{ lang, label, available, publishedPanels, totalPanels }],
 *       panels: [{ panelId, sortOrder, artworkUrl, altText, verseStart,
 *                  verseEnd, bookId, chapter, audioUrl, videoUrl,
 *                  title, narration, captions, isFallback, hasTranslation }] } }
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
    if (!VALID_LANGS.includes(lang as Lang)) {
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

    const totalPanels = comicChapter.panels.length;

    // ─── Per-language availability map (published rows only) ────────────────
    // A panel "has" a language when a PUBLISHED translation row exists for it.
    // A language is "available" for the story when every page is covered
    // (and, for non-English, the chapter-level translation is published too).
    const publishedPanelsByLang = new Map<string, number>();
    for (const panel of comicChapter.panels) {
      for (const tr of panel.translations) {
        if (tr.status !== "published") continue;
        publishedPanelsByLang.set(tr.lang, (publishedPanelsByLang.get(tr.lang) || 0) + 1);
      }
    }
    const publishedChapterLangs = new Set(
      comicChapter.translations.filter((t) => t.status === "published").map((t) => t.lang)
    );

    const languages = VALID_LANGS.map((l) => {
      const covered = publishedPanelsByLang.get(l) || 0;
      // English is the base language: it is available when its panel rows
      // (if any exist) are all published — a panel without an English row
      // simply renders with narration only, which has always been valid.
      const chapterOk =
        l === "en" ? true : publishedChapterLangs.has(l);
      const available = totalPanels === 0 ? false : covered >= totalPanels && chapterOk;
      return { lang: l, available, publishedPanels: covered, totalPanels };
    });
    const requestedEntry = languages.find((l) => l.lang === lang)!;
    const langAvailable = lang === "en" ? true : requestedEntry.available;

    // ─── Pick translations for the requested language ────────────────────────
    // English fallback is EXPLICIT: served content is flagged per panel and
    // at chapter level. Draft rows are never served.
    const chapterTranslation = langAvailable
      ? comicChapter.translations.find((t) => t.lang === lang && t.status === "published")
      : comicChapter.translations.find((t) => t.lang === "en" && t.status === "published");
    const englishChapterTranslation = comicChapter.translations.find(
      (t) => t.lang === "en" && t.status === "published"
    );

    const panels = comicChapter.panels.map((panel) => {
      const panelTranslation = langAvailable
        ? panel.translations.find((t) => t.lang === lang && t.status === "published")
        : undefined;
      const englishPanelTranslation = panel.translations.find(
        (t) => t.lang === "en" && t.status === "published"
      );

      // Use translated content if available, fall back to English explicitly
      const activeTranslation = panelTranslation || englishPanelTranslation;

      return {
        panelId: panel.panelId,
        sortOrder: panel.sortOrder,
        artworkUrl: panel.artworkUrl,
        altText: panel.altText || null,
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

    // ─── Localized story sections (only from PUBLISHED rows) ─────────────────
    const activeChapterTranslation = chapterTranslation || englishChapterTranslation;
    const keyVerse =
      activeChapterTranslation?.keyVerseBook &&
      activeChapterTranslation?.keyVerseChapter &&
      activeChapterTranslation?.keyVerseStart
        ? {
            book: activeChapterTranslation.keyVerseBook,
            chapter: activeChapterTranslation.keyVerseChapter,
            start: activeChapterTranslation.keyVerseStart,
            end: activeChapterTranslation.keyVerseEnd ?? activeChapterTranslation.keyVerseStart,
          }
        : null;

    return NextResponse.json({
      chapter: {
        id: comicChapter.id,
        comicId: comicChapter.comicId,
        bookId: comicChapter.bookId,
        chapter: comicChapter.chapter,
        title: chapterTranslation?.title || englishChapterTranslation?.title || comicChapter.title,
        coverArtUrl: comicChapter.coverArtUrl,
        sortOrder: comicChapter.sortOrder,
        kidsFriendly: comicChapter.kidsFriendly,
        pageMode: comicChapter.pageMode === "spread" ? "spread" : "individual",
        introduction: activeChapterTranslation?.introduction || null,
        lesson: activeChapterTranslation?.lesson || null,
        prayer: activeChapterTranslation?.prayer || null,
        keyVerse,
        panels,
        // Whether the chapter title is a fallback
        titleIsFallback: !chapterTranslation && !!englishChapterTranslation && lang !== "en",
        // Whether the requested language fully covers this story — the reader
        // uses this to show a "coming soon" notice instead of silently
        // substituting English.
        langAvailable,
        // Availability map across all Koino scripture languages.
        languages,
      },
      lang,
    });
  } catch (error: any) {
    console.error("[comic GET] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to load comic" }, { status: 500 });
  }
}
