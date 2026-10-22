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
 * POST /api/admin/comics/[id]/duplicate
 *
 * Clones a chapter into a new draft. Useful for creating a series of similar
 * chapters (e.g. "Genesis 3" from "Genesis 2") without re-uploading every panel.
 *
 * What gets copied:
 *   - Chapter metadata (bookId, chapter, title + " (Copy)" suffix, description,
 *     adminNotes, coverArtUrl, sortOrder)
 *   - Every panel (with new panelIds) — including artworkUrl, altText, verse range,
 *     audioUrl, videoUrl
 *   - Every panel translation (title, narration, captions)
 *   - Chapter translations
 *   - Quiz question links (so the new chapter starts with the same trivia questions)
 *
 * The duplicated chapter is ALWAYS created with status="draft" and isActive=true.
 * The admin must explicitly publish it after editing.
 *
 * The duplicated chapter can target a different (bookId, chapter) — pass them
 * in the body. If omitted, we error out (because duplicating into the same
 * slot would hit the unique constraint).
 *
 * Body:
 *   bookId?       — defaults to original bookId
 *   chapter?      — required (must not collide with original)
 *   title?        — defaults to "{originalTitle} (Copy)"
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

    const source = await db.comicChapter.findUnique({
      where: { id },
      include: {
        panels: {
          orderBy: { sortOrder: "asc" },
          include: { translations: true },
        },
        translations: true,
        quizLinks: true,
      },
    });

    if (!source) {
      return NextResponse.json({ error: "Source chapter not found" }, { status: 404 });
    }

    // ─── Resolve the new (bookId, chapter) target ────────────────────
    const newBookId = typeof body.bookId === "string" ? body.bookId : source.bookId;
    const newChapter =
      typeof body.chapter === "number"
        ? body.chapter
        : typeof body.chapter === "string"
        ? parseInt(body.chapter, 10)
        : NaN;

    if (isNaN(newChapter) || newChapter < 1) {
      return NextResponse.json(
        { error: "chapter is required and must be a positive integer" },
        { status: 400 }
      );
    }

    // Reject duplicate (bookId, chapter)
    const clash = await db.comicChapter.findFirst({
      where: { bookId: newBookId, chapter: newChapter },
      select: { id: true },
    });
    if (clash) {
      return NextResponse.json(
        { error: `A chapter for ${newBookId} ${newChapter} already exists` },
        { status: 409 }
      );
    }

    const newComicId = `${newBookId}-${newChapter}`;
    const newTitle =
      typeof body.title === "string" && body.title.trim()
        ? body.title.trim()
        : `${source.title} (Copy)`;

    // Create the new chapter
    const created = await db.comicChapter.create({
      data: {
        comicId: newComicId,
        bookId: newBookId,
        chapter: newChapter,
        title: newTitle,
        description: source.description,
        adminNotes: source.adminNotes,
        coverArtUrl: source.coverArtUrl,
        sortOrder: source.sortOrder,
        status: "draft", // always start as draft
        isActive: true,
      },
    });

    // ─── Clone panels + their translations ──────────────────────────
    const bookAbbr = newBookId.slice(0, 3).toUpperCase();
    for (let i = 0; i < source.panels.length; i++) {
      const sp = source.panels[i];
      // Generate a fresh panelId for the new chapter
      const newPanelId = `${bookAbbr}${newChapter}-P${String(i + 1).padStart(2, "0")}`;

      // Avoid the astronomically-unlikely case of an existing panel with the same ID
      const existing = await db.comicPanel.findUnique({ where: { panelId: newPanelId } });
      const finalPanelId = existing
        ? `${newPanelId}-${Date.now().toString(36)}`
        : newPanelId;

      const newPanel = await db.comicPanel.create({
        data: {
          panelId: finalPanelId,
          comicChapterId: created.id,
          sortOrder: sp.sortOrder,
          artworkUrl: sp.artworkUrl,
          altText: sp.altText,
          verseStart: sp.verseStart,
          verseEnd: sp.verseEnd,
          bookId: newBookId,
          chapter: newChapter,
          audioUrl: sp.audioUrl,
          videoUrl: sp.videoUrl,
        },
      });

      // Clone translations
      for (const tr of sp.translations) {
        await db.comicPanelTranslation.create({
          data: {
            panelId: newPanel.panelId,
            lang: tr.lang,
            title: tr.title,
            narration: tr.narration,
            captions: tr.captions,
          },
        });
      }
    }

    // ─── Clone chapter translations ─────────────────────────────────
    for (const tr of source.translations) {
      await db.comicChapterTranslation.create({
        data: {
          comicChapterId: created.id,
          lang: tr.lang,
          title: tr.title,
        },
      });
    }

    // ─── Clone quiz question links ──────────────────────────────────
    for (const ql of source.quizLinks) {
      await db.comicChapterQuiz.create({
        data: {
          comicChapterId: created.id,
          questionId: ql.questionId,
          sortOrder: ql.sortOrder,
        },
      });
    }

    return NextResponse.json({
      success: true,
      chapter: {
        id: created.id,
        comicId: created.comicId,
        bookId: created.bookId,
        chapter: created.chapter,
        title: created.title,
        status: created.status,
      },
      message: `Duplicated ${source.panels.length} panels, ${source.translations.length} chapter translations, and ${source.quizLinks.length} quiz links`,
    });
  } catch (e: any) {
    console.error("[admin/comics/[id]/duplicate] POST error:", e);
    return NextResponse.json({ error: e.message || "Failed to duplicate chapter" }, { status: 500 });
  }
}
