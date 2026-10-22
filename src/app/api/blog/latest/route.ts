import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

// Single PrismaClient instance at module scope — same pattern as the other
// public read endpoints (/api/articles, /api/blog/page.tsx).
const db = new PrismaClient();

/**
 * GET /api/blog/latest
 *
 * Public — returns the latest published posts (default 3, max 10).
 * Used by the landing page ("From the Koino Community") and the App Home
 * ("Latest from Koino") to surface recent blog content.
 *
 * Returns ONLY the public-safe fields needed by cards:
 *   id, title, slug, excerpt, featuredImage, category, author, publishedAt
 *
 * Never returns draft content. Future-scheduled posts (publishedAt > now)
 * are also excluded — the publishedAt filter handles that.
 *
 * Ordering mirrors /blog/page.tsx: featured first, then by publishedAt desc.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "3"), 10);

    const posts = await db.blogPost.findMany({
      where: {
        published: true,
        // Only posts whose publishedAt is in the past (or null = immediately visible).
        OR: [{ publishedAt: null }, { publishedAt: { lte: new Date() } }],
      },
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        featuredImage: true,
        category: true,
        author: true,
        publishedAt: true,
      },
      orderBy: [{ featured: "desc" }, { publishedAt: "desc" }],
      take: limit,
    });

    // Serialize Date → ISO string for a stable JSON shape on the client.
    return NextResponse.json({
      posts: posts.map((p) => ({
        ...p,
        publishedAt: p.publishedAt ? p.publishedAt.toISOString() : null,
      })),
    });
  } catch (error: any) {
    // Fail soft — landing/App Home should silently hide the section rather
    // than 500. Returns 200 with an empty list so the client treats it as
    // "no posts available".
    console.error("[api/blog/latest] Error:", error);
    return NextResponse.json(
      { posts: [], error: "Failed to load posts" },
      { status: 200 }
    );
  }
}
