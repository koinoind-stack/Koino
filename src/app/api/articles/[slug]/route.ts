import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

/**
 * GET /api/articles/[slug]
 * Public — returns a single published article by slug. Increments view count.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const article = await db.koinoArticle.findUnique({
      where: { slug },
      include: {
        author: {
          select: { id: true, displayName: true, slug: true, profilePhoto: true, verified: true, churchRole: true, church: true, bio: true },
        },
        series: true,
      },
    });

    if (!article || article.status !== "published") {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    // Check if it should be visible (scheduled but not yet time)
    if (article.scheduledAt && new Date() < article.scheduledAt) {
      return NextResponse.json({ error: "Article not yet published" }, { status: 404 });
    }

    // Increment view count (fire-and-forget)
    db.koinoArticle.update({
      where: { id: article.id },
      data: { viewCount: { increment: 1 } },
    }).catch(() => {});

    return NextResponse.json({ article });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message }, { status: 500 });
  }
}
