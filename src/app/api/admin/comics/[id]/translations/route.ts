import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getAuthUser } from "@/lib/auth-server";

const db = new PrismaClient();

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
 * Upsert a translation for a panel (or a chapter title).
 *
 * Body (panel translation):
 *   type: "panel"
 *   panelId: string          — which panel's translation to upsert
 *   lang: string             — e.g. "en", "hi"
 *   title?: string           — panel title in this language
 *   narration?: string      — narration / story text
 *   captions?: string[]     — array of caption strings (speech bubbles)
 *
 * Body (chapter translation):
 *   type: "chapter"
 *   lang: string
 *   title?: string           — chapter title in this language
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
      // Chapter-level translation
      const title =
        typeof body.title === "string" && body.title.trim() ? body.title.trim() : null;

      const existing = await db.comicChapterTranslation.findUnique({
        where: {
          comicChapterId_lang: { comicChapterId: id, lang },
        },
      });

      if (existing) {
        const updated = await db.comicChapterTranslation.update({
          where: { id: existing.id },
          data: { title },
        });
        return NextResponse.json({
          success: true,
          mode: "updated",
          translation: {
            id: updated.id,
            lang: updated.lang,
            title: updated.title || "",
          },
        });
      } else {
        const created = await db.comicChapterTranslation.create({
          data: {
            comicChapterId: id,
            lang,
            title,
          },
        });
        return NextResponse.json({
          success: true,
          mode: "created",
          translation: {
            id: created.id,
            lang: created.lang,
            title: created.title || "",
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
