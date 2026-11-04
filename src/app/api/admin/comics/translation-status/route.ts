import { NextRequest, NextResponse } from "next/server";

import { getAuthUser } from "@/lib/auth-server";
import { db } from "@/lib/db";

async function requireAdmin() {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") return null;
  return user;
}

// Acceptable language codes. Mirrors the Comic*Translation schema.
const VALID_LANGS = ["en", "hi", "bn", "te", "mr", "ta", "gu", "ur", "kn", "or", "ml", "pa", "as"];

/**
 * GET /api/admin/comics/translation-status
 *
 * Translation completion matrix for the whole comic library (CMS "Translations"
 * view). For every story (chapter) and every Koino scripture language it
 * reports the per-language state the admin needs to decide what to publish
 * next:
 *
 *   status: "published" | "draft" | "missing"
 *     published — chapter row published AND every panel has a published
 *                 translation in that language (safe to serve)
 *     draft     — rows exist but are drafts or only partially cover the story
 *     missing   — no rows at all for that language
 *
 * Response:
 *   { stories: [{ id, comicId, bookId, chapter, title, status,
 *                 panelCount, kidsFriendly,
 *                 languages: { [lang]: { status, panelsDone, panelTotal,
 *                                        chapterTitleDone } } }] }
 */
export async function GET() {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const chapters = await db.comicChapter.findMany({
      orderBy: [{ bookId: "asc" }, { chapter: "asc" }],
      select: {
        id: true,
        comicId: true,
        bookId: true,
        chapter: true,
        title: true,
        status: true,
        kidsFriendly: true,
        _count: { select: { panels: true } },
        translations: { select: { lang: true, status: true, title: true } },
        panels: {
          select: { panelId: true, translations: { select: { lang: true, status: true } } },
        },
      },
    });

    const stories = chapters.map((ch) => {
      const panelTotal = ch._count.panels;
      const languages: Record<
        string,
        { status: string; panelsDone: number; panelTotal: number; chapterTitleDone: boolean }
      > = {};

      for (const lang of VALID_LANGS) {
        const chapterRow = ch.translations.find((t) => t.lang === lang);
        const chapterTitleDone = !!chapterRow?.title?.trim();
        const chapterPublished = chapterRow?.status === "published";
        const panelsDone = ch.panels.filter(
          (p) => p.translations.some((t) => t.lang === lang && t.status === "published")
        ).length;
        const hasDraftPanel = ch.panels.some((p) =>
          p.translations.some((t) => t.lang === lang && t.status === "draft")
        );

        let status: string;
        if (panelsDone === 0 && !chapterRow && !hasDraftPanel) {
          status = "missing";
        } else if (
          panelTotal > 0 &&
          panelsDone === panelTotal &&
          chapterPublished &&
          (lang === "en" || chapterTitleDone)
        ) {
          status = "published";
        } else {
          status = "draft";
        }

        languages[lang] = { status, panelsDone, panelTotal, chapterTitleDone };
      }

      return {
        id: ch.id,
        comicId: ch.comicId,
        bookId: ch.bookId,
        chapter: ch.chapter,
        title: ch.title,
        status: ch.status,
        kidsFriendly: ch.kidsFriendly,
        panelCount: panelTotal,
        languages,
      };
    });

    return NextResponse.json({ stories });
  } catch (e: any) {
    console.error("[admin/comics/translation-status] GET error:", e);
    return NextResponse.json({ error: e.message || "Failed to load translation status" }, { status: 500 });
  }
}
