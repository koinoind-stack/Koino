import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

/**
 * GET /api/articles?type=APOLOGETICS&category=God+%26+Existence&q=resurrection
 * Public — returns published articles. Only status="published" are returned.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");
    const category = searchParams.get("category");
    const q = searchParams.get("q");
    const featured = searchParams.get("featured") === "true";
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);

    const where: any = { status: "published" };
    if (type) where.contentType = type;
    if (category) where.category = category;
    if (featured) where.featured = true;
    if (q) {
      where.OR = [
        { title: { contains: q, mode: "insensitive" } },
        { excerpt: { contains: q, mode: "insensitive" } },
        { content: { contains: q, mode: "insensitive" } },
      ];
    }

    const articles = await db.koinoArticle.findMany({
      where,
      orderBy: [{ featured: "desc" }, { publishedAt: "desc" }],
      take: limit,
      select: {
        id: true,
        title: true,
        slug: true,
        contentType: true,
        category: true,
        excerpt: true,
        shortAnswer: true,
        coverImageUrl: true,
        authorName: true,
        authorId: true,
        difficulty: true,
        featured: true,
        bibleRefs: true,
        publishedAt: true,
        viewCount: true,
      },
    });

    return NextResponse.json({ articles });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }
}
