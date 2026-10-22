import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getAuthUser } from "@/lib/auth-server";

const db = new PrismaClient();

async function requireAdmin() {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") return null;
  return user;
}

/**
 * GET /api/admin/comics/stats
 *
 * Returns aggregate stats for the CMS dashboard. Computed in 1 query
 * (no N+1): every chapter with its panels (which include translations)
 * and a quiz link count.
 *
 * Response:
 *   {
 *     totalChapters, published, drafts, review, ready,
 *     totalPanels,
 *     chaptersMissingArtwork,         — count of chapters with ≥1 panel missing artwork
 *     panelsMissingArtwork,           — absolute count of panels missing artwork
 *     chaptersMissingEnglishTranslation,
 *     panelsMissingEnglishTranslation,
 *     chaptersMissingEnglishTitle,    — chapters with ≥1 panel missing EN title
 *     chaptersMissingEnglishNarration,— chapters with ≥1 panel missing EN narration
 *     chaptersMissingQuiz,            — count of chapters with 0 linked quiz questions
 *     chaptersWithCoverArt,            — count of chapters with coverArtUrl set
 *   }
 */
export async function GET() {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const chapters = await db.comicChapter.findMany({
      include: {
        panels: {
          include: { translations: true },
        },
        _count: { select: { quizLinks: true } },
      },
    });

    let totalPanels = 0;
    let chaptersMissingArtwork = 0;
    let panelsMissingArtwork = 0;
    let chaptersMissingEnglishTranslation = 0;
    let panelsMissingEnglishTranslation = 0;
    let chaptersMissingEnglishTitle = 0;
    let chaptersMissingEnglishNarration = 0;
    let chaptersMissingQuiz = 0;
    let chaptersWithCoverArt = 0;

    for (const c of chapters) {
      totalPanels += c.panels.length;

      let chapterHasMissingArtwork = false;
      let chapterHasMissingEn = false;
      let chapterHasMissingEnTitle = false;
      let chapterHasMissingEnNarration = false;

      for (const p of c.panels) {
        if (!p.artworkUrl || p.artworkUrl.trim().length === 0) {
          panelsMissingArtwork++;
          chapterHasMissingArtwork = true;
        }
        const en = p.translations.find((t) => t.lang === "en");
        if (!en) {
          panelsMissingEnglishTranslation++;
          chapterHasMissingEn = true;
        } else {
          if (!en.title || en.title.trim().length === 0) {
            chapterHasMissingEnTitle = true;
          }
          if (!en.narration || en.narration.trim().length === 0) {
            chapterHasMissingEnNarration = true;
          }
        }
      }

      if (chapterHasMissingArtwork) chaptersMissingArtwork++;
      if (chapterHasMissingEn) chaptersMissingEnglishTranslation++;
      if (chapterHasMissingEnTitle) chaptersMissingEnglishTitle++;
      if (chapterHasMissingEnNarration) chaptersMissingEnglishNarration++;
      if (c._count.quizLinks === 0) chaptersMissingQuiz++;
      if (c.coverArtUrl && c.coverArtUrl.trim().length > 0) chaptersWithCoverArt++;
    }

    return NextResponse.json({
      totalChapters: chapters.length,
      published: chapters.filter((c) => c.status === "published").length,
      drafts: chapters.filter((c) => c.status === "draft").length,
      review: chapters.filter((c) => c.status === "review").length,
      ready: chapters.filter((c) => c.status === "ready").length,
      totalPanels,
      chaptersMissingArtwork,
      panelsMissingArtwork,
      chaptersMissingEnglishTranslation,
      panelsMissingEnglishTranslation,
      chaptersMissingEnglishTitle,
      chaptersMissingEnglishNarration,
      chaptersMissingQuiz,
      chaptersWithCoverArt,
    });
  } catch (e: any) {
    console.error("[admin/comics/stats] GET error:", e);
    return NextResponse.json({ error: e.message || "Failed to compute stats" }, { status: 500 });
  }
}
