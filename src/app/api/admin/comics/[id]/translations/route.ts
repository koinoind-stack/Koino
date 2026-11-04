import { NextRequest, NextResponse } from "next/server";

import { getAuthUser } from "@/lib/auth-server";
import { BIBLE_BOOKS } from "@/lib/bible-data";
import { db } from "@/lib/db";

async function requireAdmin() {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") return null;
  return user;
}

// Acceptable language codes. Mirrors the ComicPanelTranslation + ComicChapterTranslation schema.
const VALID_LANGS = ["en", "hi", "bn", "te", "mr", "ta", "gu", "ur", "kn", "or", "ml", "pa", "as"];

/**
 * POST /api/admin/comics/[id]/translations
 *
 * Upsert a translation for a panel (or a chapter title + story sections).
 *
 * Body (panel translation):
 *   type: "panel"
 *   panelId: string          — which panel's translation to upsert
 *   lang: string             — e.g. "en", "hi"
 *   title?: string           — panel title in this language
 *   narration?: string      — narration / story text
 *   captions?: string[]     — array of caption strings (speech bubbles)
 *   status?: string          — "draft" (default) | "published"
 *
 * Body (chapter translation):
 *   type: "chapter"
 *   lang: string
 *   title?: string           — chapter title in this language
 *   status?: string          — "draft" (default for new rows) | "published"
 *   introduction?: string    — Story Introduction section
 *   lesson?: string          — "What We Learn" section
 *   prayer?: string          — Short Prayer section
 *   keyVerse?: { book, chapter, start, end? } | null
 *                             — structured reference; the verse TEXT is always
 *                               fetched live from the Bible translation system
 *
 * Per-language publish model (Comic Bible redesign §6): translations are
 * drafted and published INDEPENDENTLY. Only "published" rows are ever served
 * to readers — a missing or draft language shows "coming soon", never
 * another language's text.
 *
 * We always normalize: missing fields are stored as null (panel) or null (chapter title).
 * Empty arrays for captions are stored as "[]" (the column's default).
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

    const type = body.type;
    const lang = typeof body.lang === "string" ? body.lang.trim().toLowerCase() : "";

    if (!VALID_LANGS.includes(lang)) {
      return NextResponse.json(
        { error: `Invalid lang "${lang}". Must be one of: ${VALID_LANGS.join(", ")}` },
        { status: 400 }
      );
    }

    // Per-language publish status — new rows default to draft so an
    // unfinished translation can never leak to readers.
    const status =
      body.status === "published" || body.status === "draft"
        ? body.status
        : "draft";

    // Verify chapter exists
    const chapter = await db.comicChapter.findUnique({ where: { id } });
    if (!chapter) {
      return NextResponse.json({ error: "Chapter not found" }, { status: 404 });
    }

    if (type === "panel") {
      const panelId = typeof body.panelId === "string" ? body.panelId.trim() : "";
      if (!panelId) {
        return NextResponse.json({ error: "panelId is required for type=panel" }, { status: 400 });
      }

      // Verify panel exists AND belongs to this chapter
      const panel = await db.comicPanel.findFirst({
        where: { panelId, comicChapterId: id },
      });
      if (!panel) {
        return NextResponse.json({ error: "Panel not found in this chapter" }, { status: 404 });
      }

      // Normalize inputs
      const title =
        typeof body.title === "string" && body.title.trim() ? body.title.trim() : null;
      const narration =
        typeof body.narration === "string" && body.narration.trim() ? body.narration.trim() : null;
      const captions = Array.isArray(body.captions)
        ? body.captions.filter((c: any) => typeof c === "string" && c.trim()).map((c: any) => c.trim())
        : [];

      // Upsert (insert-or-update) — ComicPanelTranslation has @@unique([panelId, lang])
      const existing = await db.comicPanelTranslation.findUnique({
        where: {
          panelId_lang: { panelId, lang },
        },
      });

      if (existing) {
        const updated = await db.comicPanelTranslation.update({
          where: { id: existing.id },
          data: {
            title,
            narration,
            captions: JSON.stringify(captions),
            status,
          },
        });
        return NextResponse.json({
          success: true,
          mode: "updated",
          translation: {
            id: updated.id,
            panelId: updated.panelId,
            lang: updated.lang,
            title: updated.title || "",
            narration: updated.narration || "",
            captions,
          },
        });
      } else {
        const created = await db.comicPanelTranslation.create({
          data: {
            panelId,
            lang,
            title,
            narration,
            captions: JSON.stringify(captions),
            status,
          },
        });
        return NextResponse.json({
          success: true,
          mode: "created",
          translation: {
            id: created.id,
            panelId: created.panelId,
            lang: created.lang,
            title: created.title || "",
            narration: created.narration || "",
            captions,
          },
        });
      }
    } else if (type === "chapter") {
      // Chapter-level translation: title + story sections + key verse ref.
      const title =
        typeof body.title === "string" && body.title.trim() ? body.title.trim() : null;
      const introduction =
        typeof body.introduction === "string" && body.introduction.trim()
          ? body.introduction.trim()
          : null;
      const lesson =
        typeof body.lesson === "string" && body.lesson.trim() ? body.lesson.trim() : null;
      const prayer =
        typeof body.prayer === "string" && body.prayer.trim() ? body.prayer.trim() : null;

      // Structured key verse. book must be a real Koino book slug; verse
      // numbers positive ints; start <= end (end defaults to start).
      let keyVerseBook: string | null = null;
      let keyVerseChapter: number | null = null;
      let keyVerseStart: number | null = null;
      let keyVerseEnd: number | null = null;
      if (body.keyVerse !== undefined && body.keyVerse !== null) {
        const kv = body.keyVerse;
        const kvBook = typeof kv.book === "string" ? kv.book.trim() : "";
        const kvChapter = parseInt(kv.chapter, 10);
        const kvStart = parseInt(kv.start, 10);
        const kvEndRaw = kv.end === undefined || kv.end === null || kv.end === "" ? kvStart : parseInt(kv.end, 10);
        if (!BIBLE_BOOKS.some((b) => b.id === kvBook)) {
          return NextResponse.json({ error: "keyVerse.book must be a BIBLE_BOOKS id" }, { status: 400 });
        }
        if (isNaN(kvChapter) || kvChapter < 1 || isNaN(kvStart) || kvStart < 1 || isNaN(kvEndRaw) || kvEndRaw < kvStart) {
          return NextResponse.json(
            { error: "keyVerse.chapter/start must be positive integers and end >= start" },
            { status: 400 }
          );
        }
        keyVerseBook = kvBook;
        keyVerseChapter = kvChapter;
        keyVerseStart = kvStart;
        keyVerseEnd = kvEndRaw;
      }

      const existing = await db.comicChapterTranslation.findUnique({
        where: {
          comicChapterId_lang: { comicChapterId: id, lang },
        },
      });

      const chapterData = {
        title,
        status,
        introduction,
        lesson,
        prayer,
        keyVerseBook,
        keyVerseChapter,
        keyVerseStart,
        keyVerseEnd,
      };

      if (existing) {
        const updated = await db.comicChapterTranslation.update({
          where: { id: existing.id },
          data: chapterData,
        });
        return NextResponse.json({
          success: true,
          mode: "updated",
          translation: {
            id: updated.id,
            lang: updated.lang,
            title: updated.title || "",
            status: updated.status,
          },
        });
      } else {
        const created = await db.comicChapterTranslation.create({
          data: {
            comicChapterId: id,
            lang,
            ...chapterData,
          },
        });
        return NextResponse.json({
          success: true,
          mode: "created",
          translation: {
            id: created.id,
            lang: created.lang,
            title: created.title || "",
            status: created.status,
          },
        });
      }
    } else {
      return NextResponse.json(
        { error: `type must be "panel" or "chapter"` },
        { status: 400 }
      );
    }
  } catch (e: any) {
    console.error("[admin/comics/[id]/translations] POST error:", e);
    return NextResponse.json({ error: e.message || "Failed to save translation" }, { status: 500 });
  }
}
