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
 * POST /api/admin/comics/[id]/panels
 *
 * Create a new panel at the end of the chapter's panel list.
 *
 * Body:
 *   panelId?      — optional override; auto-generated as "{BOOKABBR}{CH}-P{NN}" if absent
 *   verseStart    — required, int >= 1
 *   verseEnd      — required, int >= verseStart
 *   artworkUrl    — required (base64 data URL from ImagePicker or a hosted URL)
 *   altText?      — optional accessibility text
 *   audioUrl?     — optional URL to audio narration
 *   videoUrl?     — optional URL to video content
 *   sortOrder?    — optional; defaults to (max existing sortOrder) + 1
 *
 * On create, we auto-seed an empty English ComicPanelTranslation so the
 * chapter is never in a state where a panel has no English translation at all
 * (publishing validation depends on this).
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

    const chapter = await db.comicChapter.findUnique({ where: { id } });
    if (!chapter) {
      return NextResponse.json({ error: "Chapter not found" }, { status: 404 });
    }

    const { verseStart, verseEnd, artworkUrl, altText, audioUrl, videoUrl, sortOrder } = body;

    // ─── Validate verse range ───────────────────────────────────────
    const vs = parseInt(verseStart, 10);
    const ve = parseInt(verseEnd, 10);
    if (isNaN(vs) || vs < 1) {
      return NextResponse.json({ error: "verseStart must be a positive integer" }, { status: 400 });
    }
    if (isNaN(ve) || ve < vs) {
      return NextResponse.json(
        { error: "verseEnd must be >= verseStart" },
        { status: 400 }
      );
    }

    // ─── Validate artwork ───────────────────────────────────────────
    if (typeof artworkUrl !== "string" || artworkUrl.trim().length < 1) {
      return NextResponse.json(
        { error: "artworkUrl is required (use ImagePicker to upload an image)" },
        { status: 400 }
      );
    }

    // ─── Determine sortOrder ────────────────────────────────────────
    let nextSort: number;
    if (typeof sortOrder === "number" && !isNaN(sortOrder)) {
      nextSort = sortOrder;
    } else {
      const existing = await db.comicPanel.findFirst({
        where: { comicChapterId: id },
        orderBy: { sortOrder: "desc" },
        select: { sortOrder: true },
      });
      nextSort = existing ? existing.sortOrder + 1 : 1;
    }

    // ─── Auto-generate panelId if not provided ──────────────────────
    // Pattern: "{BOOKABBR}{CH}-P{NN}" where NN is 01, 02, etc.
    // Example: GEN2-P01, GEN2-P02, EX7-P03
    // We look up the highest existing panel counter for this chapter to avoid
    // collisions when panels have been deleted.
    let panelId = typeof body.panelId === "string" && body.panelId.trim() ? body.panelId.trim() : "";
    if (!panelId) {
      const bookAbbr = chapter.bookId.slice(0, 3).toUpperCase();
      const chapterStr = chapter.chapter;
      const existingPanels = await db.comicPanel.findMany({
        where: { comicChapterId: id },
        select: { panelId: true },
      });
      // Find max NN used so far for this chapter's panels
      let maxN = 0;
      const re = new RegExp(`^${bookAbbr}${chapterStr}-P(\\d+)$`, "i");
      for (const p of existingPanels) {
        const m = p.panelId.match(re);
        if (m) {
          const n = parseInt(m[1], 10);
          if (n > maxN) maxN = n;
        }
      }
      // Also account for any deleted-panel gaps by using nextSort as a fallback.
      const candidateN = Math.max(maxN + 1, nextSort);
      panelId = `${bookAbbr}${chapterStr}-P${String(candidateN).padStart(2, "0")}`;
    }

    // Ensure panelId is unique across the whole DB (it's @unique).
    const panelIdClash = await db.comicPanel.findUnique({ where: { panelId } });
    if (panelIdClash) {
      return NextResponse.json(
        { error: `panelId "${panelId}" already exists in another panel — choose a different ID` },
        { status: 409 }
      );
    }

    const created = await db.comicPanel.create({
      data: {
        panelId,
        comicChapterId: id,
        sortOrder: nextSort,
        artworkUrl: artworkUrl.trim(),
        altText: typeof altText === "string" && altText.trim() ? altText.trim() : null,
        verseStart: vs,
        verseEnd: ve,
        bookId: chapter.bookId,
        chapter: chapter.chapter,
        audioUrl: typeof audioUrl === "string" && audioUrl.trim() ? audioUrl.trim() : null,
        videoUrl: typeof videoUrl === "string" && videoUrl.trim() ? videoUrl.trim() : null,
      },
      include: { translations: true },
    });

    // Auto-seed an empty English translation row so the panel is never in a
    // "no English translation" state. Admins fill in title/narration via the
    // translations endpoint. This is required by publish-validation.
    await db.comicPanelTranslation.create({
      data: {
        panelId: created.panelId,
        lang: "en",
        title: null,
        narration: null,
        captions: "[]",
      },
    });

    return NextResponse.json({
      success: true,
      panel: {
        id: created.id,
        panelId: created.panelId,
        sortOrder: created.sortOrder,
        artworkUrl: created.artworkUrl,
        altText: created.altText || "",
        verseStart: created.verseStart,
        verseEnd: created.verseEnd,
        bookId: created.bookId,
        chapter: created.chapter,
        audioUrl: created.audioUrl || null,
        videoUrl: created.videoUrl || null,
        translations: [],
      },
    });
  } catch (e: any) {
    console.error("[admin/comics/[id]/panels] POST error:", e);
    return NextResponse.json({ error: e.message || "Failed to create panel" }, { status: 500 });
  }
}
