import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getAuthUser } from "@/lib/auth-server";
import { BIBLE_BOOKS } from "@/lib/bible-data";

const db = new PrismaClient();

// Admin auth helper — same pattern as /api/admin/gifts and /api/admin/redemptions.
// Returns the authenticated admin user object, or null if not authorized.
async function requireAdmin() {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") return null;
  return user;
}

// Validate bookId against BIBLE_BOOKS — guards against typos like "genesys".
function isValidBook(bookId: string): boolean {
  return BIBLE_BOOKS.some((b) => b.id === bookId);
}

function getBookChapterCount(bookId: string): number {
  const book = BIBLE_BOOKS.find((b) => b.id === bookId);
  return book?.chapters ?? 0;
}

// Build the canonical comicId slug. Pattern: "{book}-{chapter}".
// We strip non-alphanumeric chars from the bookId (e.g. "song_of_solomon" → "songofsolomon")
// so the comicId stays URL-friendly. bookId itself is preserved separately for joins.
function buildComicId(bookId: string, chapter: number): string {
  return `${bookId}-${chapter}`;
}

/**
 * GET /api/admin/comics
 *
 * Returns every comic chapter (regardless of status) with a panel count and
 * translation count per chapter, so the CMS dashboard can show stats without
 * N+1 queries from the client.
 *
 * Optional query params:
 *   status — "draft" | "review" | "ready" | "published" (filters chapters)
 *   book   — bookId filter (e.g. "genesis")
 *   q      — free-text search across title + comicId + description
 *
 * Response:
 *   { chapters: [{ id, comicId, bookId, chapter, title, description, status,
 *                  coverArtUrl, sortOrder, isActive, panelCount, translationCount,
 *                  quizCount, createdAt, updatedAt }] }
 */
export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const url = new URL(req.url);
    const status = url.searchParams.get("status") || undefined;
    const book = url.searchParams.get("book") || undefined;
    const q = url.searchParams.get("q")?.toLowerCase().trim() || undefined;

    const chapters = await db.comicChapter.findMany({
      where: {
        AND: [
          status ? { status } : {},
          book ? { bookId: book } : {},
          q
            ? {
                OR: [
                  { title: { contains: q, mode: "insensitive" } },
                  { comicId: { contains: q, mode: "insensitive" } },
                  { description: { contains: q, mode: "insensitive" } },
                ],
              }
            : {},
        ],
      },
      orderBy: [{ bookId: "asc" }, { chapter: "asc" }],
      include: {
        _count: {
          select: {
            panels: true,
            quizLinks: true,
          },
        },
        translations: { select: { lang: true } },
      },
    });

    return NextResponse.json({
      chapters: chapters.map((c) => ({
        id: c.id,
        comicId: c.comicId,
        bookId: c.bookId,
        chapter: c.chapter,
        title: c.title,
        description: c.description || "",
        status: c.status,
        coverArtUrl: c.coverArtUrl,
        sortOrder: c.sortOrder,
        isActive: c.isActive,
        panelCount: c._count.panels,
        translationCount: c.translations.length,
        quizCount: c._count.quizLinks,
        languages: c.translations.map((t) => t.lang),
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      })),
    });
  } catch (e: any) {
    console.error("[admin/comics] GET error:", e);
    return NextResponse.json({ error: e.message || "Failed to list comics" }, { status: 500 });
  }
}

/**
 * POST /api/admin/comics
 *
 * Create a new draft chapter. The chapter is created with status="draft" by default —
 * it will NOT be visible to end users until the admin explicitly publishes it via
 * /api/admin/comics/[id]/publish (which runs validation).
 *
 * Body:
 *   bookId    — required, must match BIBLE_BOOKS[].id
 *   chapter   — required, int >= 1, must be <= book.chapters
 *   title     — required (English default title)
 *   description? — optional short summary
 *   sortOrder?   — optional, defaults to 0
 *
 * The comicId is auto-generated from bookId+chapter so admins never have to think about it.
 */
export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await req.json();
    const { bookId, chapter, title, description, sortOrder } = body;

    // ─── Validate ────────────────────────────────────────────────────
    if (!bookId || typeof bookId !== "string" || !isValidBook(bookId)) {
      return NextResponse.json(
        { error: "Invalid bookId — must match a BIBLE_BOOKS id (e.g. 'genesis')" },
        { status: 400 }
      );
    }

    const chapterNum = parseInt(chapter, 10);
    if (isNaN(chapterNum) || chapterNum < 1) {
      return NextResponse.json({ error: "chapter must be a positive integer" }, { status: 400 });
    }

    const maxChapters = getBookChapterCount(bookId);
    if (chapterNum > maxChapters) {
      return NextResponse.json(
        { error: `${bookId} only has ${maxChapters} chapter(s) — cannot create chapter ${chapterNum}` },
        { status: 400 }
      );
    }

    if (!title || typeof title !== "string" || title.trim().length < 1) {
      return NextResponse.json({ error: "title is required (min 1 char)" }, { status: 400 });
    }

    // Check for duplicate (bookId + chapter) — enforced at DB level too, but we want
    // a friendly error message before the unique constraint fires.
    const existing = await db.comicChapter.findFirst({
      where: { bookId, chapter: chapterNum },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        { error: `A comic chapter for ${bookId} ${chapterNum} already exists` },
        { status: 409 }
      );
    }

    const comicId = buildComicId(bookId, chapterNum);

    const created = await db.comicChapter.create({
      data: {
        comicId,
        bookId,
        chapter: chapterNum,
        title: title.trim(),
        description: typeof description === "string" ? description.trim() || null : null,
        sortOrder: typeof sortOrder === "number" ? sortOrder : 0,
        status: "draft",
        isActive: true,
      },
    });

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
    });
  } catch (e: any) {
    console.error("[admin/comics] POST error:", e);
    return NextResponse.json({ error: e.message || "Failed to create chapter" }, { status: 500 });
  }
}
