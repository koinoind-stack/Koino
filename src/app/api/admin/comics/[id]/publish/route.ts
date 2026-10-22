import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getAuthUser } from "@/lib/auth-server";
import { BIBLE_BOOKS } from "@/lib/bible-data";

const db = new PrismaClient();

async function requireAdmin() {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") return null;
  return user;
}

/**
 * Validate that a chapter is ready to be published.
 *
 * Returns an array of error strings. If the array is empty, the chapter
 * passes all validation and can be published. This is called both server-side
 * (this file) and conceptually client-side (BibleComicsAdmin can show the
 * same list of failures before the user clicks Publish).
 *
 * Rules:
 *   1. Chapter has a title (non-empty)
 *   2. At least 1 panel exists
 *   3. Every panel has artworkUrl
 *   4. Every panel has an English translation (title + narration)
 *   5. Every panel has a valid verse range (verseStart >= 1, verseStart <= verseEnd)
 *   6. Chapter number is valid for the bookId (<= book.chapters)
 */
function validateChapterForPublish(
  chapter: {
    title: string;
    bookId: string;
    chapter: number;
    panels: Array<{
      artworkUrl: string;
      verseStart: number;
      verseEnd: number;
      translations: Array<{ lang: string; title: string | null; narration: string | null }>;
    }>;
  },
  bookMaxChapters: number
): string[] {
  const errors: string[] = [];

  if (!chapter.title || chapter.title.trim().length < 1) {
    errors.push("Chapter has no title");
  }

  if (!chapter.panels || chapter.panels.length === 0) {
    errors.push("Chapter has no panels (add at least 1 panel)");
  }

  if (chapter.chapter < 1 || chapter.chapter > bookMaxChapters) {
    errors.push(
      `Chapter number ${chapter.chapter} is out of range for ${chapter.bookId} (max ${bookMaxChapters})`
    );
  }

  for (const panel of chapter.panels || []) {
    if (!panel.artworkUrl || panel.artworkUrl.trim().length < 1) {
      errors.push(`Panel is missing artwork`);
    }
    if (panel.verseStart < 1) {
      errors.push(`Panel has invalid verseStart (${panel.verseStart})`);
    }
    if (panel.verseEnd < panel.verseStart) {
      errors.push(
        `Panel has verseEnd (${panel.verseEnd}) < verseStart (${panel.verseStart})`
      );
    }
    const en = panel.translations.find((t) => t.lang === "en");
    if (!en) {
      errors.push(`Panel is missing English translation`);
    } else {
      if (!en.title || en.title.trim().length < 1) {
        errors.push(`Panel is missing English title`);
      }
      if (!en.narration || en.narration.trim().length < 1) {
        errors.push(`Panel is missing English narration`);
      }
    }
  }

  return errors;
}

/**
 * POST /api/admin/comics/[id]/publish
 *
 * Runs validation. If the chapter passes, sets status="published" and
 * isActive=true. If it fails, returns the list of errors so the CMS can show
 * them in a toast / inline.
 *
 * Response (success): { success: true, status: "published" }
 * Response (failure): { success: false, errors: ["...", "..."] } (status 422)
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

    const chapter = await db.comicChapter.findUnique({
      where: { id },
      include: {
        panels: {
          include: { translations: true },
        },
      },
    });

    if (!chapter) {
      return NextResponse.json({ error: "Chapter not found" }, { status: 404 });
    }

    const book = BIBLE_BOOKS.find((b) => b.id === chapter.bookId);
    if (!book) {
      return NextResponse.json(
        { success: false, errors: [`Unknown bookId "${chapter.bookId}"`] },
        { status: 422 }
      );
    }

    const errors = validateChapterForPublish(
      {
        title: chapter.title,
        bookId: chapter.bookId,
        chapter: chapter.chapter,
        panels: chapter.panels.map((p) => ({
          artworkUrl: p.artworkUrl,
          verseStart: p.verseStart,
          verseEnd: p.verseEnd,
          translations: p.translations.map((t) => ({
            lang: t.lang,
            title: t.title,
            narration: t.narration,
          })),
        })),
      },
      book.chapters
    );

    if (errors.length > 0) {
      return NextResponse.json(
        { success: false, errors, message: "Chapter fails publishing requirements" },
        { status: 422 }
      );
    }

    const updated = await db.comicChapter.update({
      where: { id },
      data: { status: "published", isActive: true },
    });

    return NextResponse.json({
      success: true,
      status: updated.status,
      message: `Chapter "${updated.title}" is now published — visible to all users`,
    });
  } catch (e: any) {
    console.error("[admin/comics/[id]/publish] POST error:", e);
    return NextResponse.json({ error: e.message || "Failed to publish chapter" }, { status: 500 });
  }
}
