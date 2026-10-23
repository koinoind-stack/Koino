import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { jsonError } from "@/lib/social/server";
import { isVideoCategory } from "@/lib/videos";
import type { Prisma } from "@prisma/client";

/**
 * Bible Movies & Video Library (Part 5) — public listing.
 *
 * GET /api/videos — published videos only. Supports:
 *   ?q=<text>          search title/summary/description
 *   ?category=<id>     one of VIDEO_CATEGORIES
 *   ?language=<code>   video language, subtitle or dub matches the code
 *   ?book=<bookId>     videos linked to a Bible book (BIBLE_BOOKS slug)
 *   ?chapter=<n>       with book: passage covers this chapter
 *   ?featured=1        only featured videos (feed rail + Featured section)
 *   ?sort=recent|title recent (default) | alphabetical
 *   ?cursor=<iso>      keyset pagination (createdAt cursor)
 *   ?take=<n>          page size, default 24, max 48
 *
 * Degrades to { videos: [] } when the Part-5 tables are not created yet
 * (SQL not run) so the site never breaks before migration.
 */

// Card shape shared by every listing (library, rails, related, reader section).
export const videoCardSelect = {
  id: true,
  slug: true,
  title: true,
  summary: true,
  thumbnailUrl: true,
  youtubeId: true,
  durationSec: true,
  category: true,
  language: true,
  featured: true,
  sourceName: true,
  createdAt: true,
  bibleRefs: {
    select: { bookId: true, chapterStart: true, verseStart: true, chapterEnd: true, verseEnd: true },
    orderBy: [{ bookId: "asc" }, { chapterStart: "asc" }],
  },
} satisfies Prisma.VideoSelect;

export type VideoCardRow = {
  id: string; slug: string; title: string; summary: string | null;
  thumbnailUrl: string | null; youtubeId: string | null; durationSec: number | null;
  category: string; language: string; featured: boolean; sourceName: string | null;
  createdAt: Date;
  bibleRefs: { bookId: string; chapterStart: number; verseStart: number | null; chapterEnd: number | null; verseEnd: number | null }[];
};

export function toVideoCard(v: VideoCardRow) {
  return {
    id: v.id,
    slug: v.slug,
    title: v.title,
    summary: v.summary,
    thumbnailUrl: v.thumbnailUrl,
    youtubeId: v.youtubeId,
    durationSec: v.durationSec,
    category: v.category,
    language: v.language,
    featured: v.featured,
    sourceName: v.sourceName,
    createdAt: v.createdAt,
    bibleRefs: v.bibleRefs,
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const category = searchParams.get("category")?.trim();
  const language = searchParams.get("language")?.trim();
  const book = searchParams.get("book")?.trim();
  const chapterParam = searchParams.get("chapter")?.trim();
  const featured = searchParams.get("featured") === "1";
  const sort = searchParams.get("sort") === "title" ? "title" : "recent";
  const cursor = searchParams.get("cursor")?.trim();
  const take = Math.min(Math.max(parseInt(searchParams.get("take") || "24", 10) || 24, 1), 48);
  const chapter = chapterParam ? parseInt(chapterParam, 10) : null;

  const where: Prisma.VideoWhereInput = { status: "published" };
  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { summary: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
    ];
  }
  if (category) {
    if (!isVideoCategory(category)) return jsonError("Unknown category", 400);
    where.category = category;
  }
  if (language) {
    // Understandable = audio, subtitle or dub in the requested language.
    // JSON string[] columns — match the quoted code token.
    where.OR = [
      ...(where.OR || []),
      { language },
      { subtitleLanguages: { contains: `"${language}"` } },
      { dubLanguages: { contains: `"${language}"` } },
    ];
  }
  if (featured) where.featured = true;
  if (book) {
    where.bibleRefs = {
      some: {
        bookId: book,
        // A passage "covers" the chapter when the ref's chapter range spans it.
        ...(chapter && Number.isFinite(chapter)
          ? { chapterStart: { lte: chapter }, chapterEnd: { gte: chapter } }
          : {}),
      },
    };
  }
  // Keyset pagination (createdAt is not unique → lt-filter, never Prisma cursor).
  if (cursor) {
    const d = new Date(cursor);
    if (!Number.isNaN(d.getTime())) where.createdAt = { lt: d };
  }

  try {
    const rows = await db.video.findMany({
      where,
      orderBy: sort === "title" ? [{ title: "asc" }] : [{ createdAt: "desc" }],
      take,
      select: videoCardSelect,
    });
    const hasMore = rows.length === take;
    return Response.json({
      videos: rows.map(toVideoCard),
      nextCursor: hasMore ? rows[rows.length - 1].createdAt.toISOString() : null,
    });
  } catch (err: unknown) {
    // P2021 = table does not exist (SQL not run yet) — degrade gracefully.
    const code = (err as { code?: string })?.code;
    if (code === "P2021" || code === "P2022") {
      return Response.json({ videos: [], nextCursor: null });
    }
    console.error("[videos] list failed:", err);
    return jsonError("Could not load videos", 500);
  }
}
